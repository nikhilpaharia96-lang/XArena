import { beforeEach, describe, expect, it, vi } from "vitest";

// The lib modules import the app-wide `db`; swap it for an in-memory database built from the real schema.
vi.mock("@/server/db/client", async () => {
  const { makeDb } = await import("../../providers/__tests__/helpers");
  return { db: makeDb() };
});

import { db } from "@/server/db/client";
import { seedUser, walletOf } from "../../providers/__tests__/helpers";
import { approveDepositRequest, createDepositRequest, rejectDepositRequest } from "../deposit-requests";
import { quickApproveByUtr } from "../deposit-quick-approve";

const UTR = "412345678901";
let admin: string;
let player: string;
let n = 100;

const ledgerCount = () => (db.prepare(`SELECT COUNT(*) c FROM "Transaction" WHERE type = 'DEPOSIT'`).get() as { c: number }).c;
const statusOf = (utr: string) => (db.prepare("SELECT status FROM DepositRequest WHERE utr = ?").get(utr) as { status: string }).status;
const audit = (action: string) => (db.prepare("SELECT COUNT(*) c FROM AuditLog WHERE action = ?").get(action) as { c: number }).c;

function newRequest(utr: string, rupees: number) {
  return createDepositRequest({ userId: player, amountPaise: rupees * 100, utr, screenshotKey: "k.png" });
}

beforeEach(() => {
  db.exec(`DELETE FROM DepositRequest; DELETE FROM "Transaction"; DELETE FROM Notification; DELETE FROM AuditLog; DELETE FROM Wallet; DELETE FROM User;`);
  admin = seedUser(db, { n: ++n }).userId;
  player = seedUser(db, { n: ++n, deposit: 0 }).userId;
});

describe("quickApproveByUtr", () => {
  it("approves an exact UTR + amount match: wallet, ledger, notification, audit - once", () => {
    newRequest(UTR, 500);
    const r = quickApproveByUtr({ utr: UTR, amountPaise: 50_000, adminId: admin });
    expect(r.outcome).toBe("APPROVED");
    expect(r.balanceAfter).toBe(50_000);
    expect(walletOf(db, player).deposit).toBe(50_000);
    expect(statusOf(UTR)).toBe("APPROVED");
    expect(ledgerCount()).toBe(1);
    expect((db.prepare("SELECT COUNT(*) c FROM Notification WHERE userId = ? AND type = 'DEPOSIT_SUCCESS'").get(player) as { c: number }).c).toBe(1);
    expect(audit("DEPOSIT_REQUEST_APPROVED")).toBe(1);
    expect(audit("DEPOSIT_QUICK_APPROVED")).toBe(1);
  });

  it("normalises case and spaces in what the admin types", () => {
    newRequest("AXIS1234567890AB", 100);
    expect(quickApproveByUtr({ utr: " axis 1234567890 ab ", amountPaise: 10_000, adminId: admin }).outcome).toBe("APPROVED");
  });

  it("never credits twice: a second attempt reports ALREADY_APPROVED", () => {
    newRequest(UTR, 500);
    quickApproveByUtr({ utr: UTR, amountPaise: 50_000, adminId: admin });
    const again = quickApproveByUtr({ utr: UTR, amountPaise: 50_000, adminId: admin });
    expect(again.outcome).toBe("ALREADY_APPROVED");
    expect(walletOf(db, player).deposit).toBe(50_000);
    expect(ledgerCount()).toBe(1);
  });

  it("unknown UTR -> NOT_FOUND and nothing changes", () => {
    newRequest(UTR, 500);
    const r = quickApproveByUtr({ utr: "999999999999", amountPaise: 50_000, adminId: admin });
    expect(r.outcome).toBe("NOT_FOUND");
    expect(statusOf(UTR)).toBe("PENDING");
    expect(walletOf(db, player).deposit).toBe(0);
  });

  it("amount mismatch is refused (no credit, request stays pending) and is audited", () => {
    newRequest(UTR, 5000);
    const r = quickApproveByUtr({ utr: UTR, amountPaise: 5_000, adminId: admin }); // admin saw Rs 50 on the statement
    expect(r.outcome).toBe("AMOUNT_MISMATCH");
    expect(r.requestAmount).toBe(500_000);
    expect(r.enteredAmount).toBe(5_000);
    expect(statusOf(UTR)).toBe("PENDING");
    expect(walletOf(db, player).deposit).toBe(0);
    expect(ledgerCount()).toBe(0);
    expect(audit("DEPOSIT_QUICK_APPROVE_MISMATCH")).toBe(1);
  });

  it("a rejected request is never re-opened", () => {
    const { id } = newRequest(UTR, 500);
    rejectDepositRequest({ id, adminId: admin, reason: "fake" });
    expect(quickApproveByUtr({ utr: UTR, amountPaise: 50_000, adminId: admin }).outcome).toBe("ALREADY_REJECTED");
    expect(walletOf(db, player).deposit).toBe(0);
  });

  it("rejects malformed UTRs without touching the database", () => {
    expect(quickApproveByUtr({ utr: "123", amountPaise: 100, adminId: admin }).outcome).toBe("INVALID_UTR");
    expect(quickApproveByUtr({ utr: "12345678901!", amountPaise: 100, adminId: admin }).outcome).toBe("INVALID_UTR");
  });

  it("matches the exact UTR only - a prefix or look-alike never matches", () => {
    newRequest(UTR, 500);
    expect(quickApproveByUtr({ utr: "41234567890", amountPaise: 50_000, adminId: admin }).outcome).toBe("INVALID_UTR");
    expect(quickApproveByUtr({ utr: "412345678902", amountPaise: 50_000, adminId: admin }).outcome).toBe("NOT_FOUND");
    expect(statusOf(UTR)).toBe("PENDING");
  });

  it("approveDepositRequest's expectedAmount guard rolls everything back on a mismatch", () => {
    const { id } = newRequest(UTR, 500);
    expect(() => approveDepositRequest({ id, adminId: admin, expectedAmountPaise: 1 })).toThrow(/does not match/);
    expect(statusOf(UTR)).toBe("PENDING");
    expect(walletOf(db, player).deposit).toBe(0);
  });
});
