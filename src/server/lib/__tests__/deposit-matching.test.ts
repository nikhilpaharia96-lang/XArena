import { describe, expect, it } from "vitest";
import { makeDb, seedUser } from "@/server/providers/__tests__/helpers";
import { matchDepositByUtr } from "../deposit-matching";

function setup() {
  const db = makeDb();
  const u = seedUser(db, { n: 1 });
  const add = (id: string, utr: string, amount: number, status = "PENDING") =>
    db
      .prepare(
        `INSERT INTO DepositRequest (id, userId, amount, utr, screenshotUrl, status) VALUES (?, ?, ?, ?, 'x.png', ?)`
      )
      .run(id, u.userId, amount, utr, status);
  return { db, add };
}

describe("matchDepositByUtr", () => {
  it("matches a pending request on UTR and exact amount (case/space insensitive)", () => {
    const { db, add } = setup();
    add("d1", "ABC123456789", 50000);
    expect(matchDepositByUtr(db, " abc123 456789 ", 50000)).toEqual({ kind: "MATCH", id: "d1" });
  });

  it("rejects a matching UTR with the wrong amount", () => {
    const { db, add } = setup();
    add("d1", "412345678901", 50000);
    expect(matchDepositByUtr(db, "412345678901", 40000)).toEqual({ kind: "AMOUNT_MISMATCH", requestedPaise: 50000 });
  });

  it("reports unknown UTR, invalid UTR and already-reviewed requests", () => {
    const { db, add } = setup();
    add("d1", "412345678901", 50000, "APPROVED");
    expect(matchDepositByUtr(db, "999999999999", 50000)).toEqual({ kind: "NOT_FOUND" });
    expect(matchDepositByUtr(db, "123", 50000)).toEqual({ kind: "INVALID_UTR" });
    expect(matchDepositByUtr(db, "412345678901", 50000)).toEqual({ kind: "ALREADY_REVIEWED", status: "APPROVED" });
  });
});
