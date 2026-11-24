import { beforeEach, describe, expect, it, vi } from "vitest";

// Real SQLite, real schema.sql, but in memory — the module under test imports a global `db`.
const { db } = vi.hoisted(() => {
  const Database = require("better-sqlite3");
  const fs = require("node:fs");
  const path = require("node:path");
  const d = new Database(":memory:");
  d.pragma("foreign_keys = ON");
  d.exec(fs.readFileSync(path.join(process.cwd(), "src/server/db/schema.sql"), "utf-8"));
  return { db: d };
});
vi.mock("@/server/db/client", () => ({ db }));

import { assertBankOtp, clearBankOtp, issueBankOtp } from "../bank-otp";
import { ApiError } from "../api-response";
import { addBankSchema, withdrawSchema } from "@/types/schemas";
import { bankFromIfsc, IFSC_REGEX } from "@/lib/banks";

const USER = "u1";

function seed() {
  db.exec("DELETE FROM BankOtp; DELETE FROM Notification; DELETE FROM User;");
  db.prepare("INSERT INTO User (id, uid, email, username, referralCode) VALUES (?, 'XA1', 'a@b.c', 'alice', 'REF123')").run(USER);
}
const lastOtp = () => {
  const n = db.prepare("SELECT body FROM Notification WHERE userId = ? AND type = 'BANK_OTP'").get(USER) as { body: string };
  return /(\d{6})/.exec(n.body)![1];
};
const errCode = (fn: () => void) => {
  try {
    fn();
  } catch (e) {
    return (e as ApiError).code;
  }
  return null;
};

describe("bank OTP", () => {
  beforeEach(seed);

  it("delivers a 6-digit code and stores only its hash", () => {
    issueBankOtp(USER);
    const code = lastOtp();
    expect(code).toMatch(/^\d{6}$/);
    const row = db.prepare("SELECT codeHash FROM BankOtp WHERE userId = ?").get(USER) as { codeHash: string };
    expect(row.codeHash).not.toContain(code);
    expect(() => assertBankOtp(USER, code)).not.toThrow();
  });

  it("rejects a wrong code and counts the attempt", () => {
    issueBankOtp(USER);
    const wrong = lastOtp() === "000000" ? "111111" : "000000";
    expect(errCode(() => assertBankOtp(USER, wrong))).toBe("OTP_INVALID");
    expect((db.prepare("SELECT attempts FROM BankOtp").get() as { attempts: number }).attempts).toBe(1);
  });

  it("locks out after 5 wrong guesses, even if the right code follows", () => {
    issueBankOtp(USER);
    const right = lastOtp();
    const wrong = right === "000000" ? "111111" : "000000";
    for (let i = 0; i < 5; i++) expect(errCode(() => assertBankOtp(USER, wrong))).toBe("OTP_INVALID");
    expect(errCode(() => assertBankOtp(USER, right))).toBe("OTP_LOCKED");
    expect(errCode(() => assertBankOtp(USER, right))).toBe("OTP_REQUIRED");
  });

  it("enforces a resend cooldown", () => {
    issueBankOtp(USER);
    expect(errCode(() => issueBankOtp(USER))).toBe("OTP_COOLDOWN");
  });

  it("expires after the TTL", () => {
    issueBankOtp(USER);
    db.prepare("UPDATE BankOtp SET expiresAt = ?").run(new Date(Date.now() - 1000).toISOString());
    expect(errCode(() => assertBankOtp(USER, lastOtp()))).toBe("OTP_EXPIRED");
  });

  it("requires an OTP to have been requested, and clearing removes the inbox copy", () => {
    expect(errCode(() => assertBankOtp(USER, "123456"))).toBe("OTP_REQUIRED");
    issueBankOtp(USER);
    clearBankOtp(USER);
    expect(db.prepare("SELECT COUNT(*) c FROM Notification").get()).toEqual({ c: 0 });
  });
});

describe("bank + withdraw validation", () => {
  const good = { ifsc: "sbin0002068", bankName: "State Bank of India", accountNumber: "123456789012", accountHolder: "Test User", otp: "123456" };

  it("accepts a valid bank and upper-cases the IFSC", () => {
    expect(addBankSchema.parse(good).ifsc).toBe("SBIN0002068");
  });
  it.each([
    ["short IFSC", { ifsc: "SBIN002" }],
    ["IFSC without the 0 in 5th place", { ifsc: "SBINX002068" }],
    ["letters in account number", { accountNumber: "12345abc9012" }],
    ["too-short account number", { accountNumber: "12345678" }],
    ["digits in holder name", { accountHolder: "User 123" }],
    ["non-numeric OTP", { otp: "12ab56" }],
  ])("rejects %s", (_n, patch) => {
    expect(addBankSchema.safeParse({ ...good, ...patch }).success).toBe(false);
  });

  it("withdraw needs a bank (or legacy UPI) and ≥ ₹100", () => {
    expect(withdrawSchema.safeParse({ amountRupees: 500 }).success).toBe(false);
    expect(withdrawSchema.safeParse({ amountRupees: 50, bankId: "bank_x" }).success).toBe(false);
    expect(withdrawSchema.safeParse({ amountRupees: 500, bankId: "bank_x" }).success).toBe(true);
    expect(withdrawSchema.safeParse({ amountRupees: 500, upiId: "me@upi" }).success).toBe(true);
  });

  it("maps an IFSC prefix to its bank", () => {
    expect(IFSC_REGEX.test("HDFC0001234")).toBe(true);
    expect(bankFromIfsc("HDFC0001234")).toBe("HDFC Bank");
    expect(bankFromIfsc("ZZZZ0001234")).toBeNull();
  });
});
