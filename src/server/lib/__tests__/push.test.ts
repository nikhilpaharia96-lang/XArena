import { describe, expect, it, vi } from "vitest";
import { makeDb, seedUser } from "@/server/providers/__tests__/helpers";
import { drainOutbox, MAX_ATTEMPTS, MAX_SUBS_PER_USER, pushConfig, removeSubscription, saveSubscription, urlForNotification, type PushSender } from "../push";

const sub = (n: number) => ({ endpoint: `https://push.example.com/send/${n}`, keys: { p256dh: "p".repeat(20), auth: "a".repeat(10) } });
const notify = (db: ReturnType<typeof makeDb>, userId: string, id: string, extra: Partial<{ type: string; data: string; isRead: number }> = {}) =>
  db.prepare("INSERT INTO Notification (id, userId, type, title, body, data, isRead, createdAt) VALUES (?, ?, ?, 'T', 'B', ?, ?, ?)")
    .run(id, userId, extra.type ?? "SYSTEM", extra.data ?? "{}", extra.isRead ?? 0, new Date().toISOString());
const outbox = (db: ReturnType<typeof makeDb>) => db.prepare("SELECT notificationId, attempts FROM PushOutbox").all();
const code = (fn: () => unknown) => { try { fn(); } catch (e) { return (e as { code?: string }).code; } return "NO_ERROR"; };
const ok: PushSender = async () => {};

describe("config", () => {
  it("is disabled until both VAPID keys exist", () => {
    expect(pushConfig({} as NodeJS.ProcessEnv)).toBeNull();
    expect(pushConfig({ VAPID_PUBLIC_KEY: "a" } as unknown as NodeJS.ProcessEnv)).toBeNull();
    expect(pushConfig({ VAPID_PUBLIC_KEY: "a", VAPID_PRIVATE_KEY: "b" } as unknown as NodeJS.ProcessEnv)).toMatchObject({ publicKey: "a", subject: "mailto:support@xarena.app" });
  });
});

describe("subscriptions", () => {
  it("validates: https only, keys required", () => {
    const db = makeDb(); const u = seedUser(db, { n: 1 }).userId;
    expect(code(() => saveSubscription(db, u, { ...sub(1), endpoint: "http://internal/x" }, null))).toBe("INVALID_SUBSCRIPTION");
    expect(code(() => saveSubscription(db, u, { ...sub(1), endpoint: "not a url" }, null))).toBe("INVALID_SUBSCRIPTION");
    expect(code(() => saveSubscription(db, u, { endpoint: sub(1).endpoint, keys: { p256dh: "", auth: "x" } }, null))).toBe("INVALID_SUBSCRIPTION");
  });

  it("upserts per device, reports created only once, and moves a device to the new account", () => {
    const db = makeDb(); const a = seedUser(db, { n: 1 }).userId; const b = seedUser(db, { n: 2 }).userId;
    expect(saveSubscription(db, a, sub(1), "UA").created).toBe(true);
    expect(saveSubscription(db, a, sub(1), "UA").created).toBe(false);
    expect(saveSubscription(db, b, sub(1), "UA").created).toBe(true); // same phone, other account
    expect(db.prepare("SELECT userId FROM PushSubscription").all()).toEqual([{ userId: b }]);
    removeSubscription(db, a, sub(1).endpoint); // not the owner → no-op
    expect(db.prepare("SELECT COUNT(*) AS n FROM PushSubscription").get()).toEqual({ n: 1 });
    removeSubscription(db, b, sub(1).endpoint);
    expect(db.prepare("SELECT COUNT(*) AS n FROM PushSubscription").get()).toEqual({ n: 0 });
  });

  it(`keeps at most ${MAX_SUBS_PER_USER} devices per user`, () => {
    const db = makeDb(); const a = seedUser(db, { n: 1 }).userId;
    for (let i = 0; i < MAX_SUBS_PER_USER + 3; i++) saveSubscription(db, a, sub(i), null, new Date(2026, 10, 1, 0, i));
    expect(db.prepare("SELECT COUNT(*) AS n FROM PushSubscription").get()).toEqual({ n: MAX_SUBS_PER_USER });
  });
});

describe("outbox queueing (DB trigger)", () => {
  it("queues a notification only for users who have a subscription", () => {
    const db = makeDb(); const a = seedUser(db, { n: 1 }).userId; const b = seedUser(db, { n: 2 }).userId;
    saveSubscription(db, a, sub(1), null);
    notify(db, a, "n1"); notify(db, b, "n2");
    expect(outbox(db)).toEqual([{ notificationId: "n1", attempts: 0 }]);
  });
});

describe("drainOutbox", () => {
  it("sends the payload to every device of the user, then clears the queue", async () => {
    const db = makeDb(); const a = seedUser(db, { n: 1 }).userId;
    saveSubscription(db, a, sub(1), null); saveSubscription(db, a, sub(2), null);
    notify(db, a, "n1", { type: "TEAM_INVITE" });
    const send = vi.fn<PushSender>(async () => {});
    const s = await drainOutbox(db, send);
    expect(s.sent).toBe(2);
    expect(send).toHaveBeenCalledTimes(2);
    expect(JSON.parse(send.mock.calls[0][1])).toEqual({ title: "T", body: "B", url: "/teams", tag: "n1" });
    expect(send.mock.calls[0][2]).toMatchObject({ TTL: 86400 });
    expect(outbox(db)).toEqual([]);
  });

  it("skips notifications already read, and nothing is sent when there are no subscribers", async () => {
    const db = makeDb(); const a = seedUser(db, { n: 1 }).userId;
    saveSubscription(db, a, sub(1), null);
    notify(db, a, "n1", { isRead: 1 });
    const send = vi.fn<PushSender>(async () => {});
    expect((await drainOutbox(db, send)).skipped).toBe(1);
    expect(send).not.toHaveBeenCalled();
    expect(outbox(db)).toEqual([]);
  });

  it("deletes subscriptions the push service says are gone (404/410)", async () => {
    const db = makeDb(); const a = seedUser(db, { n: 1 }).userId;
    saveSubscription(db, a, sub(1), null); saveSubscription(db, a, sub(2), null);
    notify(db, a, "n1");
    const send: PushSender = async (t) => { if (t.endpoint.endsWith("/1")) throw Object.assign(new Error("gone"), { statusCode: 410 }); };
    const s = await drainOutbox(db, send);
    expect(s).toMatchObject({ sent: 1, pruned: 1 });
    expect(db.prepare("SELECT endpoint FROM PushSubscription").all()).toEqual([{ endpoint: sub(2).endpoint }]);
    expect(outbox(db)).toEqual([]);
  });

  it("retries transient failures after the lock expires, then gives up after MAX_ATTEMPTS", async () => {
    const db = makeDb(); const a = seedUser(db, { n: 1 }).userId;
    saveSubscription(db, a, sub(1), null); notify(db, a, "n1");
    const fail: PushSender = async () => { throw Object.assign(new Error("boom"), { statusCode: 500 }); };
    const t0 = new Date("2026-11-26T10:00:00Z");
    await drainOutbox(db, fail, t0);
    expect(outbox(db)).toEqual([{ notificationId: "n1", attempts: 1 }]);
    await drainOutbox(db, ok, new Date(t0.getTime() + 10_000)); // still locked → untouched
    expect(outbox(db)).toEqual([{ notificationId: "n1", attempts: 1 }]);
    await drainOutbox(db, fail, new Date(t0.getTime() + 2 * 60_000));
    expect(outbox(db)).toEqual([{ notificationId: "n1", attempts: 2 }]);
    let t = t0.getTime() + 2 * 60_000;
    for (let i = 2; i < MAX_ATTEMPTS; i++) { t += 2 * 60_000; await drainOutbox(db, fail, new Date(t)); }
    expect(outbox(db)).toEqual([]); // final attempt → dropped
  });

  it("a later success after a failure sends once and clears", async () => {
    const db = makeDb(); const a = seedUser(db, { n: 1 }).userId;
    saveSubscription(db, a, sub(1), null); notify(db, a, "n1");
    const t0 = new Date("2026-11-26T10:00:00Z");
    await drainOutbox(db, async () => { throw new Error("net"); }, t0);
    const send = vi.fn<PushSender>(async () => {});
    await drainOutbox(db, send, new Date(t0.getTime() + 2 * 60_000));
    expect(send).toHaveBeenCalledTimes(1);
    expect(outbox(db)).toEqual([]);
  });
});

describe("urlForNotification", () => {
  it("routes by type, only ever to same-site paths", () => {
    expect(urlForNotification("FRIEND_REQUEST", null)).toBe("/teams");
    expect(urlForNotification("DEPOSIT_APPROVED", null)).toBe("/wallet");
    expect(urlForNotification("TOURNAMENT_ROOM", JSON.stringify({ slug: "ff-cup" }))).toBe("/tournaments/ff-cup");
    expect(urlForNotification("TOURNAMENT_ROOM", JSON.stringify({ slug: "../../evil" }))).toBe("/notifications");
    expect(urlForNotification("SYSTEM", "not json")).toBe("/notifications");
  });
});
