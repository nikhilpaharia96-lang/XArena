import { beforeEach, describe, expect, it } from "vitest";
import { createProviderWallet } from "../provider-wallet";
import { handleBetnexCallback, normalizeIp, type CallbackReply } from "../betnex/betnex.callback";
import type { BetnexConfig } from "../betnex/betnex.config";
import { encryptPayload } from "../betnex/betnex.crypto";
import { clientIpFromHeaders } from "../betnex/betnex.ip";
import { makeDb, seedUser, walletOf } from "./helpers";

const KEY = "betnex-api-key";
const PASS = "enc-passphrase";
const LOGIN = "k7xabcdef1234";
const IP = "203.0.113.7";

const cfg = (o: Partial<BetnexConfig> = {}): BetnexConfig => ({
  baseUrl: "https://example.test/casino",
  apiKey: KEY,
  usernameCode: "k7x",
  usernamePosition: "prefix",
  encryptionKey: PASS,
  callbackIps: [IP],
  testMode: false,
  trustedProxyHops: 1,
  ...o,
});

function setup(wallet: Parameters<typeof seedUser>[1] = { deposit: 200_000 }, config = cfg()) {
  const db = makeDb();
  const seed = seedUser(db, wallet);
  db.prepare("INSERT INTO ProviderPlayer (provider, userId, login, createdAt) VALUES ('betnex', ?, ?, ?)").run(seed.userId, LOGIN, new Date().toISOString());
  const engine = createProviderWallet(db);

  const base = { api_key: KEY, member_account: LOGIN, game_uid: "game1", game_round: "R1", currency_code: "INR", serial_number: "S1", bet_amount: 0, win_amount: 0 };
  const plain = (o: Record<string, unknown> = {}) => ({ ...base, ...o });
  const send = (body: Record<string, unknown> | string, opts: { ip?: string | null; encrypt?: boolean; config?: BetnexConfig } = {}): CallbackReply => {
    const c = opts.config ?? config;
    const payload = typeof body === "string" ? body : opts.encrypt === false ? JSON.stringify(body) : JSON.stringify({ payload: encryptPayload(body, PASS) });
    return handleBetnexCallback(payload, opts.ip === undefined ? IP : opts.ip, { db, wallet: engine, config: c });
  };
  const bal = () => {
    const w = walletOf(db, seed.userId);
    return w.deposit + w.winning + w.bonus;
  };
  return { db, seed, plain, send, bal, w: () => walletOf(db, seed.userId) };
}

describe("BETNEX callback — the documented scenarios (start balance ₹2000)", () => {
  let t: ReturnType<typeof setup>;
  beforeEach(() => {
    t = setup({ deposit: 200_000 });
  });

  it("bet callback (new round): deducts the bet and returns the new balance in rupees", () => {
    const r = t.send(t.plain({ bet_amount: 600 }));
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, msg: "Callback processed successfully", handle: true, money: 1400 });
    expect(t.bal()).toBe(140_000);
  });

  it("win callback (same round): adds the win", () => {
    t.send(t.plain({ bet_amount: 600, serial_number: "S1" }));
    const r = t.send(t.plain({ win_amount: 800, serial_number: "S2" }));
    expect(r.body.money).toBe(2200);
    // …and the stake went back to the deposit bucket, only the ₹200 profit is withdrawable.
    expect(t.w()).toMatchObject({ deposit: 200_000, winning: 20_000 });
  });

  it.each([
    ["bet refund (negative bet_amount)", { bet_amount: -600 }, 2600],
    ["win refund / correction (negative win_amount)", { win_amount: -800 }, 1200],
    ["both refunded", { bet_amount: -600, win_amount: -800 }, 1800],
  ])("%s uses the same formula", (_n, amounts, expected) => {
    const r = t.send(t.plain(amounts));
    expect(r.status).toBe(200);
    expect(r.body.money).toBe(expected);
  });

  it("duplicate / retry (same serial, same round): 200, applied once, balance unchanged", () => {
    const first = t.send(t.plain({ bet_amount: 600 }));
    const retry = t.send(t.plain({ bet_amount: 600 }));
    expect(retry.status).toBe(200);
    expect(retry.body).toMatchObject({ success: true, handle: true, msg: "Duplicate callback ignored", money: first.body.money });
    expect(t.bal()).toBe(140_000);
    expect((t.db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get() as { c: number }).c).toBe(1);
  });

  it("the same serial_number in a DIFFERENT round is a different transaction", () => {
    t.send(t.plain({ bet_amount: 100, game_round: "R1", serial_number: "S1" }));
    const r = t.send(t.plain({ bet_amount: 100, game_round: "R2", serial_number: "S1" }));
    expect(r.body.money).toBe(1800);
    expect((t.db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get() as { c: number }).c).toBe(2);
  });

  it("accepts decimal amounts and numeric strings", () => {
    const r = t.send(t.plain({ bet_amount: "12.5", win_amount: 0.25 }));
    expect(r.body.money).toBe(2000 - 12.5 + 0.25);
  });

  it("encrypted callback is decrypted and processed like plain JSON", () => {
    expect(t.send(t.plain({ bet_amount: 600 }), { encrypt: true }).body.money).toBe(1400);
  });
});

describe("BETNEX callback — authentication (400, never a balance change)", () => {
  const unchanged = (t: ReturnType<typeof setup>) => {
    expect(t.bal()).toBe(200_000);
    expect((t.db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get() as { c: number }).c).toBe(0);
  };

  it("non-BETNEX IP", () => {
    const t = setup();
    for (const ip of ["198.51.100.1", null]) {
      const r = t.send(t.plain({ bet_amount: 100 }), { ip });
      expect(r).toEqual({ status: 400, body: { success: false, msg: "Invalid callback", handle: false } });
    }
    unchanged(t);
  });

  it("empty IP allowlist fails closed", () => {
    const t = setup(undefined, cfg({ callbackIps: [] }));
    expect(t.send(t.plain({ bet_amount: 100 })).status).toBe(400);
    unchanged(t);
  });

  it("IPv4-mapped IPv6 addresses match", () => {
    const t = setup();
    expect(normalizeIp("::FFFF:203.0.113.7")).toBe("203.0.113.7");
    expect(t.send(t.plain({ bet_amount: 100 }), { ip: "::ffff:203.0.113.7" }).status).toBe(200);
  });

  it("wrong api_key", () => {
    const t = setup();
    expect(t.send(t.plain({ bet_amount: 100, api_key: "nope" })).status).toBe(400);
    unchanged(t);
  });

  it("undecryptable payload (garbage, wrong passphrase, tampered)", () => {
    const t = setup();
    const good = encryptPayload(t.plain({ bet_amount: 100 }), PASS);
    const tampered = good.slice(0, -6) + "AAAAAA";
    for (const payload of ["U2FsdGVkX1+garbagegarbagegarbagegarbage", encryptPayload(t.plain({ bet_amount: 100 }), "wrong"), tampered]) {
      expect(t.send(JSON.stringify({ payload })).status).toBe(400);
    }
    unchanged(t);
  });

  it("production rejects an unencrypted callback; test mode accepts it", () => {
    const t = setup();
    expect(t.send(t.plain({ bet_amount: 100 }), { encrypt: false }).status).toBe(400);
    unchanged(t);
    const test = setup({ deposit: 200_000 }, cfg({ testMode: true, callbackIps: [] }));
    expect(test.send(test.plain({ bet_amount: 100 }), { encrypt: false, ip: null }).status).toBe(200);
  });

  it.each([
    ["non-numeric bet_amount", { bet_amount: "abc" }],
    ["missing win_amount", { win_amount: undefined }],
    ["missing serial_number", { serial_number: undefined }],
    ["missing game_round", { game_round: "" }],
    ["NaN amount", { bet_amount: "NaN" }],
  ])("bad fields: %s", (_n, patch) => {
    const t = setup();
    expect(t.send(t.plain(patch)).status).toBe(400);
    unchanged(t);
  });

  it("not JSON / not an object / oversized", () => {
    const t = setup();
    for (const body of ["not json", "[]", "null", JSON.stringify({ x: "a".repeat(70_000) })]) expect(t.send(body, { ip: IP }).status).toBe(400);
    unchanged(t);
  });

  it("unknown player, non-INR currency", () => {
    const t = setup();
    expect(t.send(t.plain({ member_account: "k7xnobody", bet_amount: 1 })).status).toBe(400);
    expect(t.send(t.plain({ currency_code: "USD", bet_amount: 1 })).status).toBe(400);
    unchanged(t);
  });

  it("member_account is case-insensitive", () => {
    const t = setup();
    expect(t.send(t.plain({ member_account: LOGIN.toUpperCase(), bet_amount: 100 })).status).toBe(200);
  });

  it("a blocked player can't bet, but a win/refund for them is still booked", () => {
    const t = setup({ deposit: 100_000, status: "SUSPENDED" });
    expect(t.send(t.plain({ bet_amount: 100 })).status).toBe(400);
    expect(t.send(t.plain({ win_amount: 500, serial_number: "S9" })).status).toBe(200);
  });
});

describe("BETNEX callback — failures on our side and safety", () => {
  it("insufficient funds: 500, handle false, nothing changed", () => {
    const t = setup({ deposit: 1_000 });
    const r = t.send(t.plain({ bet_amount: 5000 }));
    expect(r).toEqual({ status: 500, body: { success: false, msg: "INSUFFICIENT_FUNDS", handle: false } });
    expect(t.bal()).toBe(1_000);
    expect((t.db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get() as { c: number }).c).toBe(0);
  });

  it("a database failure is a 500 and rolls back (no half-applied wallet)", () => {
    const t = setup();
    t.db.exec("DROP TABLE ProviderTransaction");
    const r = t.send(t.plain({ bet_amount: 100 }));
    expect(r.status).toBe(500);
    expect(t.bal()).toBe(200_000);
  });

  it("same serial with different amounts is refused (400), not applied twice", () => {
    const t = setup();
    t.send(t.plain({ bet_amount: 100 }));
    const r = t.send(t.plain({ bet_amount: 999 }));
    expect(r.status).toBe(400);
    expect(t.bal()).toBe(190_000); // ₹100 applied once; the conflicting ₹999 was not
  });

  it("only 200 / 400 / 500 are ever returned", () => {
    const t = setup({ deposit: 500 });
    const statuses = new Set<number>();
    for (const body of [t.plain({ bet_amount: 100 }), t.plain({ api_key: "x" }), t.plain({ bet_amount: 99999, serial_number: "Z" }), t.plain({ bet_amount: "q" })]) {
      statuses.add(t.send(body).status);
    }
    for (const s of statuses) expect([200, 400, 500]).toContain(s);
  });

  it("logs every callback and never stores the api_key", () => {
    const t = setup();
    t.send(t.plain({ bet_amount: 100 }), { encrypt: false, config: cfg({ testMode: true }) }); // plain body so the key would be visible
    t.send(t.plain({ bet_amount: 100 }), { ip: "198.51.100.1" });
    const logs = t.db.prepare("SELECT outcome, httpStatus, bodyExcerpt FROM ProviderCallbackLog ORDER BY createdAt").all() as { outcome: string; httpStatus: number; bodyExcerpt: string }[];
    expect(logs.map((l) => l.outcome)).toEqual(["APPLIED", "IP_NOT_ALLOWED"]);
    expect(logs.map((l) => l.httpStatus)).toEqual([200, 400]);
    for (const l of logs) expect(l.bodyExcerpt).not.toContain(KEY);
    expect(logs[0].bodyExcerpt).toContain("[redacted]");
  });

  it("plays the whole game-round lifecycle without ever creating withdrawable money from deposit", () => {
    const t = setup({ deposit: 100_000 });
    t.send(t.plain({ bet_amount: 100_00 / 100, serial_number: "a" })); // ₹100 bet
    t.send(t.plain({ win_amount: 100, serial_number: "b" })); // wins ₹100 back (1x)
    expect(t.w()).toMatchObject({ deposit: 100_000, winning: 0 });
  });
});

describe("BETNEX callback — client IP behind proxies", () => {
  const h = (xff?: string) => new Headers(xff ? { "x-forwarded-for": xff } : {});
  it("takes the entry our proxy added (from the right), never the client-supplied left-most one", () => {
    expect(clientIpFromHeaders(h("6.6.6.6, 203.0.113.7"), 1)).toBe("203.0.113.7"); // attacker spoofed 6.6.6.6
    expect(clientIpFromHeaders(h("203.0.113.7, 10.0.0.1"), 2)).toBe("203.0.113.7");
  });
  it("no header / no trusted proxy → null (rejected)", () => {
    expect(clientIpFromHeaders(h(), 1)).toBeNull();
    expect(clientIpFromHeaders(h("1.2.3.4"), 0)).toBeNull();
    expect(clientIpFromHeaders(h("1.2.3.4"), 3)).toBeNull();
  });
});
