import { randomBytes } from "node:crypto";

/** cuid-like unique id — sufficient uniqueness for this scale without an extra dependency mismatch vs Prisma's default. */
export function createId(prefix = ""): string {
  const rand = randomBytes(12).toString("base64url");
  return prefix ? `${prefix}_${rand}` : rand;
}

/** Human-shareable reference code for transactions, e.g. TXN-9F3K2L8Q */
export function createReferenceId(prefix: string): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)
  let code = "";
  const bytes = randomBytes(8);
  for (let i = 0; i < 8; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return `${prefix}-${code}`;
}

/** 6-char referral code, e.g. "XA7K2P" */
export function createReferralCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  const bytes = randomBytes(6);
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}
