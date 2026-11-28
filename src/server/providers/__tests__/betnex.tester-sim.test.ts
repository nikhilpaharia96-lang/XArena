import { describe, expect, it } from "vitest";
import { createProviderWallet } from "../provider-wallet";
import { handleBetnexCallback } from "../betnex/betnex.callback";
import type { BetnexConfig } from "../betnex/betnex.config";
import { makeDb, seedUser, walletOf } from "./helpers";

/**
 * Mirrors the 23 cases of the BETNEX "Callback Automatic Testing" page
 * (plain-JSON callbacks, BETNEX_TEST_MODE=true, user "betnexuser", start balance 10000).
 */
const KEY = "test_api_key";
const USER = "betnexuser";
const cfg: BetnexConfig = {
  baseUrl: "https://example.test/casino", apiKey: KEY, usernameCode: "bet", usernamePosition: "prefix",
  encryptionKey: "", callbackIps: [], testMode: true, trustedProxyHops: 1,
};

function rig(withCurrency = true) {
  const db = makeDb();
  const seed = seedUser(db, { deposit: 1_000_000 }); // ₹10,000
  db.prepare("INSERT INTO ProviderPlayer (provider, userId, login, createdAt) VALUES ('betnex', ?, ?, ?)").run(seed.userId, USER, new Date().toISOString());
  const wallet = createProviderWallet(db);
  let n = 0;
  const fresh = () => ({ game_uid: "g1", game_round: `R${++n}`, serial_number: `S${n}` });
  const body = (o: Record<string, unknown> = {}) => ({
    api_key: KEY, member_account: USER, ...fresh(), ...(withCurrency ? { currency_code: "INR" } : {}), bet_amount: 0, win_amount: 0, ...o,
  });
  const post = (b: Record<string, unknown>) => handleBetnexCallback(JSON.stringify(b), null, { db, wallet, config: cfg });
  const bal = () => { const w = walletOf(db, seed.userId); return (w.deposit + w.winning + w.bonus) / 100; };
  const rounds = () => (db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get() as { c: number }).c;
  return { body, post, bal, rounds };
}
const without = (b: Record<string, unknown>, k: string) => { const c = { ...b }; delete c[k]; return c; };

describe("tester: Security (8) → 400, balance + rounds unchanged", () => {
  const cases: [string, (b: Record<string, unknown>) => Record<string, unknown>][] = [
    ["NoApiKey", (b) => without(b, "api_key")],
    ["WrongApiKey", (b) => ({ ...b, api_key: "nope" })],
    ["MissingSerialNumber", (b) => without(b, "serial_number")],
    ["MissingGameRound", (b) => without(b, "game_round")],
    ["MissingMemberAccount", (b) => without(b, "member_account")],
    ["MissingBetAmount", (b) => without(b, "bet_amount")],
    ["MissingWinAmount", (b) => without(b, "win_amount")],
    ["MissingGameUid", (b) => without(b, "game_uid")],
  ];
  it.each(cases)("%s", (_n, mutate) => {
    const t = rig();
    const r = t.post(mutate(t.body({ bet_amount: 100 })));
    expect(r.status).toBe(400);
    expect(t.bal()).toBe(10000);
    expect(t.rounds()).toBe(0);
  });
});

describe("tester: Core + Refunds (one user, chained like the page does)", () => {
  const steps: [string, Record<string, unknown>, number][] = [
    ["BetCallback", { bet_amount: 100 }, 9900],
    ["WinCallback (fresh round)", { win_amount: 30 }, 9930],
    ["LoseCallback", {}, 9930],
    ["CombinedBetWin", { bet_amount: 100, win_amount: 30 }, 9860],
    ["BetRefundCallback", { bet_amount: -100 }, 9960],
    ["WinRefundCallback", { win_amount: -30 }, 9930],
    ["BetAndWinRefundCallback", { bet_amount: -100, win_amount: -30 }, 10000],
  ];
  it("balance = balance - bet + win at every step, always HTTP 200 with money", () => {
    const t = rig();
    for (const [name, amounts, expected] of steps) {
      const r = t.post(t.body(amounts));
      expect(r.status, name).toBe(200);
      expect(r.body.money, name).toBe(expected);
      expect(t.bal(), name).toBe(expected);
    }
  });
});

describe("tester: Retry / idempotency (7) — same game_round + serial_number", () => {
  const cases: [string, Record<string, unknown>, number][] = [
    ["BetRetry", { bet_amount: 100 }, 9900],
    ["WinRetry", { win_amount: 30 }, 10030],
    ["LoseRetry", {}, 10000],
    ["CombinedBetWinRetry", { bet_amount: 100, win_amount: 30 }, 9930],
    ["BetRefundRetry", { bet_amount: -100 }, 10100],
    ["WinRefundRetry", { win_amount: -30 }, 9970],
    ["BetAndWinRefundRetry", { bet_amount: -100, win_amount: -30 }, 10070],
  ];
  it.each(cases)("%s", (_n, amounts, expected) => {
    const t = rig();
    const b = t.body(amounts);
    const first = t.post(b);
    const retry = t.post(b);
    expect(first.status).toBe(200);
    expect(retry.status).toBe(200);
    expect(first.body.money).toBe(expected);
    expect(retry.body.money).toBe(expected);
    expect(t.bal()).toBe(expected);
  });
});

describe("tester: Performance", () => {
  it("5 sequential bets each under 1500 ms", () => {
    const t = rig();
    for (let i = 0; i < 5; i++) {
      const s = performance.now();
      expect(t.post(t.body({ bet_amount: 100 })).status).toBe(200);
      expect(performance.now() - s).toBeLessThan(1500);
    }
    expect(t.bal()).toBe(9500);
  });
});

describe("callback without currency_code (INR-only wallet → treated as INR)", () => {
  it("core callbacks still work when the tester sends no currency_code", () => {
    const t = rig(false);
    const r = t.post(t.body({ bet_amount: 100 }));
    expect(r.status).toBe(200);
    expect(r.body.money).toBe(9900);
  });
  it("a PRESENT non-INR currency is still refused", () => {
    const t = rig();
    const r = t.post(t.body({ bet_amount: 100, currency_code: "USD" }));
    expect(r.status).toBe(400);
    expect(t.bal()).toBe(10000);
  });
});
