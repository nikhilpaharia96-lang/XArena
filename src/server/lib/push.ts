import type Database from "better-sqlite3";
import { ApiError } from "./api-response";
import { createId } from "./ids";

/**
 * Web Push. Pure logic with the database and the network sender injected, so it is unit-testable.
 * The real sender + timer live in push-dispatcher.ts.
 */

type Db = Database.Database;

export const MAX_SUBS_PER_USER = 10;
export const MAX_ATTEMPTS = 4;
const LOCK_MS = 60_000;
const BATCH = 50;
const TTL_SECONDS = 24 * 60 * 60;

export interface PushConfig { publicKey: string; privateKey: string; subject: string }

/** null = push not configured (VAPID keys missing) — the app then simply doesn't offer notifications. */
export function pushConfig(env: NodeJS.ProcessEnv = process.env): PushConfig | null {
  const publicKey = env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = env.VAPID_PRIVATE_KEY?.trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: env.VAPID_SUBJECT?.trim() || "mailto:support@xarena.app" };
}

export interface SubscriptionInput { endpoint: string; keys: { p256dh: string; auth: string } }

export function validateSubscription(input: SubscriptionInput) {
  let url: URL;
  try { url = new URL(input.endpoint); } catch { throw new ApiError(400, "Invalid subscription.", "INVALID_SUBSCRIPTION"); }
  // Push services are https; refusing anything else also stops the server being aimed at internal http URLs (SSRF).
  if (url.protocol !== "https:" || input.endpoint.length > 2048) throw new ApiError(400, "Invalid subscription.", "INVALID_SUBSCRIPTION");
  if (!input.keys.p256dh || !input.keys.auth || input.keys.p256dh.length > 200 || input.keys.auth.length > 100) {
    throw new ApiError(400, "Invalid subscription.", "INVALID_SUBSCRIPTION");
  }
}

/**
 * Saves (or refreshes) this device's subscription for the user. The same device logging into another
 * account moves the subscription to that account. Returns whether it is new, so the caller can welcome them.
 */
export function saveSubscription(db: Db, userId: string, input: SubscriptionInput, userAgent: string | null, now = new Date()): { created: boolean } {
  validateSubscription(input);
  const iso = now.toISOString();
  return db.transaction(() => {
    const existing = db.prepare("SELECT id, userId FROM PushSubscription WHERE endpoint = ?").get(input.endpoint) as { id: string; userId: string } | undefined;
    if (existing) {
      db.prepare("UPDATE PushSubscription SET userId = ?, p256dh = ?, auth = ?, userAgent = ?, lastSeenAt = ? WHERE id = ?")
        .run(userId, input.keys.p256dh, input.keys.auth, userAgent?.slice(0, 300) ?? null, iso, existing.id);
      return { created: existing.userId !== userId };
    }
    db.prepare("INSERT INTO PushSubscription (id, userId, endpoint, p256dh, auth, userAgent, createdAt, lastSeenAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
      .run(createId("psub"), userId, input.endpoint, input.keys.p256dh, input.keys.auth, userAgent?.slice(0, 300) ?? null, iso, iso);
    // Keep only the newest devices per user.
    db.prepare(
      `DELETE FROM PushSubscription WHERE userId = ? AND id NOT IN
         (SELECT id FROM PushSubscription WHERE userId = ? ORDER BY lastSeenAt DESC LIMIT ?)`
    ).run(userId, userId, MAX_SUBS_PER_USER);
    return { created: true };
  })();
}

export function removeSubscription(db: Db, userId: string, endpoint: string) {
  db.prepare("DELETE FROM PushSubscription WHERE userId = ? AND endpoint = ?").run(userId, endpoint);
}

/** Where tapping the notification should take the player. Only ever a same-site path. */
export function urlForNotification(type: string, dataJson: string | null): string {
  let data: Record<string, unknown> = {};
  try { data = dataJson ? JSON.parse(dataJson) : {}; } catch { /* ignore bad data */ }
  const slug = typeof data.slug === "string" && /^[a-z0-9-]+$/i.test(data.slug) ? data.slug : null;
  if (slug && /TOURNAMENT|ROOM|RESULT|PRIZE|MATCH/i.test(type)) return `/tournaments/${slug}`;
  if (/^(FRIEND|TEAM)_/.test(type)) return "/teams";
  if (/DEPOSIT|WITHDRAW|WALLET|PAYOUT|REFUND|BONUS/i.test(type)) return "/wallet";
  if (/REFERRAL/i.test(type)) return "/referral";
  return "/notifications";
}

export interface PushTarget { endpoint: string; keys: { p256dh: string; auth: string } }
export type PushSender = (target: PushTarget, payload: string, options: { TTL: number; urgency: "normal" | "high" }) => Promise<void>;

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

/**
 * Sends queued notifications. Claims rows atomically (a lock, so two workers never double-send), skips
 * notifications the user already read, prunes dead subscriptions (404/410), and retries transient
 * failures up to MAX_ATTEMPTS. Returns counts for logging/tests.
 */
export async function drainOutbox(db: Db, send: PushSender, now = new Date()) {
  const iso = now.toISOString();
  const lockedUntil = new Date(now.getTime() + LOCK_MS).toISOString();
  const stats = { sent: 0, failed: 0, pruned: 0, skipped: 0 };

  const claimed = db
    .prepare(
      `UPDATE PushOutbox SET lockedUntil = ?, attempts = attempts + 1
       WHERE notificationId IN (
         SELECT notificationId FROM PushOutbox
         WHERE attempts < ? AND (lockedUntil IS NULL OR lockedUntil < ?) ORDER BY createdAt LIMIT ?)
       RETURNING notificationId, attempts`
    )
    .all(lockedUntil, MAX_ATTEMPTS, iso, BATCH) as { notificationId: string; attempts: number }[];

  const done = db.prepare("DELETE FROM PushOutbox WHERE notificationId = ?");
  const dropSub = db.prepare("DELETE FROM PushSubscription WHERE endpoint = ?");

  for (const row of claimed) {
    const n = db.prepare("SELECT userId, type, title, body, data, isRead FROM Notification WHERE id = ?").get(row.notificationId) as
      | { userId: string; type: string; title: string; body: string; data: string | null; isRead: number }
      | undefined;
    if (!n || n.isRead) { done.run(row.notificationId); stats.skipped++; continue; }

    const subs = db.prepare("SELECT endpoint, p256dh, auth FROM PushSubscription WHERE userId = ?").all(n.userId) as { endpoint: string; p256dh: string; auth: string }[];
    if (subs.length === 0) { done.run(row.notificationId); stats.skipped++; continue; }

    const payload = JSON.stringify({
      title: clip(n.title, 80), body: clip(n.body, 180), url: urlForNotification(n.type, n.data), tag: row.notificationId,
    });

    let transientFailure = false;
    await Promise.all(
      subs.map(async (s) => {
        try {
          await send({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, { TTL: TTL_SECONDS, urgency: "normal" });
          stats.sent++;
        } catch (e) {
          const status = (e as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) { dropSub.run(s.endpoint); stats.pruned++; }
          else { transientFailure = true; stats.failed++; }
        }
      })
    );
    if (!transientFailure || row.attempts >= MAX_ATTEMPTS) done.run(row.notificationId);
  }

  // Housekeeping: rows that exhausted their retries a long time ago.
  db.prepare("DELETE FROM PushOutbox WHERE attempts >= ? AND createdAt < ?").run(MAX_ATTEMPTS, new Date(now.getTime() - 24 * 3600_000).toISOString());
  return stats;
}
