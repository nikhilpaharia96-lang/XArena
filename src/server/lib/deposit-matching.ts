import type Database from "better-sqlite3";
import { normalizeUtr, UTR_REGEX } from "./deposit-requests-shared";

export type UtrMatch =
  | { kind: "MATCH"; id: string }
  | { kind: "INVALID_UTR" }
  | { kind: "NOT_FOUND" }
  | { kind: "ALREADY_REVIEWED"; status: string }
  | { kind: "AMOUNT_MISMATCH"; requestedPaise: number };

/**
 * Looks up a deposit request by UTR and checks the amount the admin typed against it.
 * UTR is UNIQUE in DepositRequest, so there is at most one candidate. Pure read — the
 * caller approves inside the same transaction.
 */
export function matchDepositByUtr(database: Database.Database, rawUtr: string, amountPaise: number): UtrMatch {
  const utr = normalizeUtr(rawUtr);
  if (!UTR_REGEX.test(utr)) return { kind: "INVALID_UTR" };

  const row = database.prepare("SELECT id, amount, status FROM DepositRequest WHERE utr = ?").get(utr) as
    | { id: string; amount: number; status: string }
    | undefined;
  if (!row) return { kind: "NOT_FOUND" };
  if (row.status !== "PENDING") return { kind: "ALREADY_REVIEWED", status: row.status };
  if (row.amount !== amountPaise) return { kind: "AMOUNT_MISMATCH", requestedPaise: row.amount };
  return { kind: "MATCH", id: row.id };
}
