import { beforeEach, describe, expect, it, vi } from "vitest";
import { BetnexClient } from "../betnex/betnex.client";
import type { BetnexConfig } from "../betnex/betnex.config";
import { decryptPayload } from "../betnex/betnex.crypto";
import { getOrCreateLogin, findUserByLogin } from "../betnex/betnex.players";
import { launchBetnexGame } from "../betnex/betnex.service";
import { createProviderWallet } from "../provider-wallet";
import { makeDb, seedUser } from "./helpers";

const PASS = "enc-pass";
const cfg = (o: Partial<BetnexConfig> = {}): BetnexConfig => ({
  baseUrl: "https://api.test/casino", apiKey: "k", usernameCode: "k7x", usernamePosition: "prefix",
  encryptionKey: PASS, callbackIps: [], testMode: false, trustedProxyHops: 1, ...o,
});
const ok = { code: 0, msg: "Success", payload: { game_launch_url: "https://play.test/game?token=abc", game_name: "Aviator", provider: "SPRIBE", expires_in: 60 } };

function setup(config = cfg(), reply: unknown = ok) {
  const db = makeDb();
  const seed = seedUser(db, { deposit: 123_456 }); // ₹1234.56
  db.prepare(
    `INSERT INTO ProviderGame (id, provider, providerGameId, title, providerName, category, currencies, isEnabled, isAvailable, lastSyncedAt, createdAt, updatedAt)
     VALUES ('g1','betnex','uid-aviator','Aviator','Spribe','crash','["INR"]',1,1,'t','t','t')`
  ).run();
  const sent: unknown[] = [];
  const fetchImpl = vi.fn(async (_u: string, init: RequestInit) => {
    sent.push(JSON.parse(init.body as string));
    return new Response(JSON.stringify(reply), { status: 200 });
  });
  const client = new BetnexClient({ config, fetchImpl: fetchImpl as unknown as typeof fetch, sleep: async () => {} });
  const wallet = createProviderWallet(db);
  const launch = (o: Partial<Parameters<typeof launchBetnexGame>[0]> = {}) =>
    launchBetnexGame({ db, client, wallet, user: { id: seed.userId }, gameId: "g1", platform: 1, appUrl: "https://xarena.test", ...o });
  return { db, seed, launch, sent, fetchImpl };
}

describe("player login", () => {
  it("is lowercase alphanumeric, carries the code (prefix or suffix) and is stable per user", () => {
    const db = makeDb();
    const a = seedUser(db, { n: 1 });
    const b = seedUser(db, { n: 2 });
    const l1 = getOrCreateLogin(db, a.userId, { usernameCode: "k7x", usernamePosition: "prefix" });
    expect(l1).toMatch(/^k7x[a-z0-9]{12}$/);
    expect(getOrCreateLogin(db, a.userId, { usernameCode: "k7x", usernamePosition: "prefix" })).toBe(l1);
    const l2 = getOrCreateLogin(db, b.userId, { usernameCode: "k7x", usernamePosition: "suffix" });
    expect(l2).toMatch(/^[a-z0-9]{12}k7x$/);
    expect(l2).not.toBe(l1);
    expect(findUserByLogin(db, l1.toUpperCase())?.id).toBe(a.userId);
    expect(findUserByLogin(db, "k7xunknownunknown")).toBeNull();
  });
});

describe("launchBetnexGame", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup();
  });

  it("sends an ENCRYPTED body in production with the doc's fields, and returns the launch URL", async () => {
    const r = await t.launch({ language: "hi", platform: 2 });
    expect(r).toMatchObject({ gameUrl: "https://play.test/game?token=abc", embeddable: false, singleUse: true, expiresIn: 60, category: "crash" });

    const body = t.sent[0] as { payload?: string; username?: string };
    expect(Object.keys(body)).toEqual(["payload"]); // nothing in the clear next to it
    const plain = decryptPayload(body.payload, PASS) as Record<string, unknown>;
    expect(plain).toMatchObject({ gameId: "uid-aviator", money: 1234.56, platform: 2, currency: "INR", home_url: "https://xarena.test/games", lang: "hi" });
    expect(plain.username).toMatch(/^k7x[a-z0-9]{12}$/);
  });

  it("test mode (no encryption key) sends plain JSON", async () => {
    const s = setup(cfg({ encryptionKey: null, testMode: true }));
    await s.launch();
    expect(s.sent[0]).toMatchObject({ gameId: "uid-aviator", money: 1234.56 });
  });

  it("uses the same username on every launch", async () => {
    await t.launch();
    await t.launch();
    const names = t.sent.map((b) => (decryptPayload((b as { payload: string }).payload, PASS) as { username: string }).username);
    expect(names[0]).toBe(names[1]);
  });

  it("stores a session row but never the launch URL", async () => {
    await t.launch();
    const rows = t.db.prepare("SELECT * FROM ProviderGameSession").all() as Record<string, unknown>[];
    expect(rows).toHaveLength(1);
    expect(JSON.stringify(rows)).not.toContain("token=abc");
  });

  it("sanitises the language and defaults to en", async () => {
    await t.launch({ language: "<script>" });
    expect((decryptPayload((t.sent[0] as { payload: string }).payload, PASS) as { lang: string }).lang).toBe("en");
  });

  it.each([
    ["http app url", { appUrl: "http://xarena.test" }],
    ["no app url", { appUrl: null }],
  ])("refuses to launch with %s (503)", async (_n, o) => {
    await expect(t.launch(o)).rejects.toMatchObject({ statusCode: 503 });
    expect(t.fetchImpl).not.toHaveBeenCalled();
  });

  it("404 for disabled / unavailable / unknown / other-provider games", async () => {
    t.db.prepare("UPDATE ProviderGame SET isEnabled = 0").run();
    await expect(t.launch()).rejects.toMatchObject({ statusCode: 404 });
    t.db.prepare("UPDATE ProviderGame SET isEnabled = 1, isAvailable = 0").run();
    await expect(t.launch()).rejects.toMatchObject({ statusCode: 404 });
    await expect(t.launch({ gameId: "nope" })).rejects.toMatchObject({ statusCode: 404 });
    t.db.prepare("UPDATE ProviderGame SET isAvailable = 1, provider = 'astech'").run();
    await expect(t.launch()).rejects.toMatchObject({ statusCode: 404 });
  });

  it("a non-zero BETNEX code or a bad URL becomes a clean 502 (no provider text leaked)", async () => {
    for (const reply of [{ code: 5, msg: "internal secret detail" }, { code: 0, payload: { game_launch_url: "javascript:alert(1)" } }, {}]) {
      const s = setup(cfg(), reply);
      const e = await s.launch().catch((x) => x);
      expect(e).toMatchObject({ statusCode: 502 });
      expect(String(e.message)).not.toContain("secret");
    }
  });

  it("collapses a double click into one provider call", async () => {
    await Promise.all([t.launch(), t.launch()]);
    expect(t.fetchImpl).toHaveBeenCalledTimes(1);
  });
});
