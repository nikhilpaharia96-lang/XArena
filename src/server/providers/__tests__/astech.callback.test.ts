import { describe, expect, it } from "vitest";
import { decimalToPaise, formatCash, handleAsTechCallback } from "../astech/astech.callback";
import { signBody } from "../astech/astech.signature";
import { createProviderWallet } from "../provider-wallet";
import { makeDb, seedUser, SECRET, walletOf } from "./helpers";

function setup(seed: Parameters<typeof seedUser>[1] = { deposit: 100_00 }) {
  const db = makeDb();
  const u = seedUser(db, seed);
  const wallet = createProviderWallet(db);
  const call = (payload: unknown, opts: { secret?: string | null; sig?: string | null; raw?: string } = {}) => {
    const raw = opts.raw ?? JSON.stringify(payload);
    const sig = opts.sig === undefined ? signBody(SECRET, raw) : opts.sig;
    return handleAsTechCallback(raw, sig, { db, wallet, secretKey: opts.secret === undefined ? SECRET : opts.secret });
  };
  const logs = () => db.prepare("SELECT method, outcome, signatureValid, httpStatus FROM ProviderCallbackLog ORDER BY createdAt, rowid").all() as {
    method: string | null;
    outcome: string;
    signatureValid: number;
    httpStatus: number;
  }[];
  return { db, u, call, logs };
}

// Payloads exactly as documented at https://astechapi.cloud/docs#callbacks (both naming styles present).
const writeBet = (login: string, extra: Record<string, unknown> = {}) => ({
  cmd: "writeBet",
  user_login: login,
  login,
  currency: "INR",
  bet: 1.0,
  win: 3.5,
  amount: 2.5,
  transaction_id: "tx-9001",
  transactionId: "tx-9001",
  round_id: "r-51",
  roundId: "r-51",
  game_id: "0f1c-uuid",
  gameId: "0f1c-uuid",
  session_id: "9a2f",
  sessionid: "9a2f",
  round_finished: true,
  ...extra,
});

describe("AS Tech callback pipeline", () => {
  it("getBalance -> exact success envelope with a 2-decimal string", () => {
    const { u, call } = setup({ deposit: 9900 });
    expect(call({ cmd: "getBalance", user_login: u.login, login: u.login, currency: "INR", game_id: "g", session_id: "s" })).toEqual({
      status: "success",
      error: "",
      content: { cash: "99.00" },
    });
  });

  it("writeBet applies bet and win as ONE settlement and returns the new cash", () => {
    const { db, u, call } = setup({ deposit: 10_000 });
    const res = call(writeBet(u.login));
    expect(res).toEqual({ status: "success", error: "", content: { cash: "102.50" } }); // 100 - 1 + 3.5
    expect(walletOf(db, u.userId)).toMatchObject({ deposit: 10_000, winning: 250 }); // stake back, profit to winning
    expect(db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get()).toEqual({ c: 1 });
    const pt = db.prepare("SELECT betAmount, winAmount, roundFinished, roundId, providerGameId, currency, status FROM ProviderTransaction").get();
    expect(pt).toEqual({ betAmount: 100, winAmount: 350, roundFinished: 1, roundId: "r-51", providerGameId: "0f1c-uuid", currency: "INR", status: "APPLIED" });
  });

  it("accepts the camelCase aliases on their own", () => {
    const { u, call } = setup({ deposit: 10_000 });
    const res = call({ cmd: "writeBet", login: u.login, currency: "INR", bet: "2.00", win: "0", transactionId: "camel-1", roundId: "r1", gameId: "g", round_finished: "true" });
    expect(res).toEqual({ status: "success", error: "", content: { cash: "98.00" } });
  });

  it("duplicate transaction_id returns the stored balance and does not debit again", () => {
    const { db, u, call } = setup({ deposit: 10_000 });
    call(writeBet(u.login, { bet: 10, win: 0 }));
    const dup = call(writeBet(u.login, { bet: 10, win: 0 }));
    expect(dup).toEqual({ status: "success", error: "", content: { cash: "90.00" } });
    expect(walletOf(db, u.userId).deposit).toBe(9000);
  });

  it("rejects an invalid signature with the documented fail envelope and touches nothing", () => {
    const { db, u, call, logs } = setup();
    const res = call(writeBet(u.login), { sig: "deadbeef" });
    expect(res).toEqual({ status: "fail", error: "Invalid signature", content: null });
    expect(walletOf(db, u.userId).deposit).toBe(10_000);
    expect(logs()).toEqual([{ method: null, outcome: "SIGNATURE_INVALID", signatureValid: 0, httpStatus: 200 }]);
  });

  it("rejects a missing signature and a body altered after signing", () => {
    const { u, call } = setup();
    const raw = JSON.stringify(writeBet(u.login));
    expect(call(null, { raw, sig: null }).status).toBe("fail");
    const sig = signBody(SECRET, raw);
    expect(call(null, { raw: raw.replace('"bet":1', '"bet":0'), sig }).error).toBe("Invalid signature");
  });

  it("fails closed when the secret is not configured", () => {
    const { u, call } = setup();
    expect(call(writeBet(u.login), { secret: null })).toEqual({ status: "fail", error: "Callback not configured", content: null });
  });

  it("insufficient funds -> documented INSUFFICIENT_FUNDS envelope, wallet untouched, failure logged", () => {
    const { db, u, call, logs } = setup({ deposit: 50 });
    const res = call(writeBet(u.login, { bet: 5, win: 100 }));
    expect(res).toEqual({ status: "fail", error: "INSUFFICIENT_FUNDS", content: null });
    expect(walletOf(db, u.userId).deposit).toBe(50);
    expect(db.prepare("SELECT COUNT(*) c FROM ProviderTransaction").get()).toEqual({ c: 0 });
    expect(logs().at(-1)?.outcome).toBe("INSUFFICIENT_FUNDS");
  });

  it("rollback restores the wallet; replay is idempotent; unknown tx still succeeds", () => {
    const { db, u, call } = setup({ deposit: 10_000 });
    call(writeBet(u.login, { bet: 40, win: 0, transaction_id: "tx-r", transactionId: "tx-r" }));
    expect(walletOf(db, u.userId).deposit).toBe(6000);
    const rb = { cmd: "rollback", user_login: u.login, transaction_id: "tx-r" };
    expect(call(rb)).toEqual({ status: "success", error: "", content: { cash: "100.00" } });
    expect(call(rb).content).toEqual({ cash: "100.00" });
    expect(walletOf(db, u.userId).deposit).toBe(10_000);
    expect(call({ cmd: "rollback", user_login: u.login, transaction_id: "never-seen" })).toEqual({ status: "success", error: "", content: { cash: "100.00" } });
  });

  it("unknown player, malformed identity, non-INR currency and unknown cmd fail cleanly", () => {
    const { u, call } = setup();
    expect(call({ cmd: "getBalance", user_login: "xa_nobody", currency: "INR" }).error).toBe("Player not found");
    expect(call({ cmd: "getBalance", user_login: "plain-user-id", currency: "INR" }).error).toBe("Player not found");
    expect(call({ cmd: "getBalance", user_login: u.login, currency: "USD" }).error).toBe("UNSUPPORTED_CURRENCY");
    expect(call({ cmd: "hack", user_login: u.login }).error).toBe("Unknown cmd");
    expect(call(null, { raw: "not json" }).error).toBe("Invalid JSON");
    expect(call({ cmd: "getBalance", currency: "INR" }).error).toBe("user_login required");
    expect(call({ cmd: "writeBet", user_login: u.login, currency: "INR", bet: 1 }).error).toBe("transaction_id required");
  });

  it("rejects amounts that are negative or have more than 2 decimals", () => {
    const { db, u, call } = setup();
    expect(call(writeBet(u.login, { bet: -5 })).status).toBe("fail");
    expect(call(writeBet(u.login, { bet: 1.005, transaction_id: "d", transactionId: "d" })).error).toBe("INVALID_AMOUNT");
    expect(walletOf(db, u.userId).deposit).toBe(10_000);
  });

  it("blocks bets (not rollbacks) for banned and suspended players", () => {
    const { db, call, u } = setup({ deposit: 10_000, status: "BANNED" });
    expect(call(writeBet(u.login)).error).toBe("PLAYER_BLOCKED");
    expect(call({ cmd: "getBalance", user_login: u.login, currency: "INR" }).error).toBe("PLAYER_BLOCKED");
    expect(call({ cmd: "rollback", user_login: u.login, transaction_id: "x" }).status).toBe("success");
    expect(walletOf(db, u.userId).deposit).toBe(10_000);
  });

  it("every outcome is recorded in the callback log with HTTP 200", () => {
    const { u, call, logs } = setup({ deposit: 10_000 });
    call({ cmd: "getBalance", user_login: u.login, currency: "INR" });
    call(writeBet(u.login, { bet: 1, win: 0 }));
    call(writeBet(u.login, { bet: 1, win: 0 }));
    call({ cmd: "rollback", user_login: u.login, transaction_id: "tx-9001" });
    expect(logs().map((l) => l.outcome)).toEqual(["BALANCE_OK", "APPLIED", "DUPLICATE", "ROLLBACK_ROLLED_BACK"]);
    expect(logs().every((l) => l.httpStatus === 200 && l.signatureValid === 1)).toBe(true);
  });

  it("a bet with a win never lets the provider credit another player's wallet", () => {
    const db = makeDb();
    const a = seedUser(db, { deposit: 1000, n: 1 });
    const b = seedUser(db, { deposit: 1000, n: 2 });
    const wallet = createProviderWallet(db);
    const raw = JSON.stringify(writeBet(a.login, { bet: 1, win: 5 }));
    handleAsTechCallback(raw, signBody(SECRET, raw), { db, wallet, secretKey: SECRET });
    expect(walletOf(db, b.userId).deposit).toBe(1000);
  });
});

describe("amount helpers", () => {
  it("converts provider decimals to integer paise exactly", () => {
    expect(decimalToPaise(1, "x")).toBe(100);
    expect(decimalToPaise("3.50", "x")).toBe(350);
    expect(decimalToPaise(0.1 + 0.2 - 0.2, "x")).toBe(10);
    expect(decimalToPaise(undefined, "x")).toBe(0);
    expect(() => decimalToPaise("abc", "x")).toThrow();
  });
  it("formats cash with 2 decimals", () => {
    expect(formatCash(9900)).toBe("99.00");
    expect(formatCash(5)).toBe("0.05");
  });
});
