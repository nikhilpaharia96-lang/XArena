import { db } from "@/server/db/client";

/**
 * Manual-deposit payment configuration, stored in the existing key/value
 * Setting table (values are JSON, matching how scripts/seed.ts writes them).
 * NOTHING here is hardcoded into the frontend — the UPI ID, QR image,
 * account name, instructions and limits all come from these rows and are
 * editable by admins at /admin/payment-settings.
 */

export interface PaymentSettings {
  upiId: string;
  accountName: string;
  qrKey: string | null;
  instructions: string;
  minDepositRupees: number;
  maxDepositRupees: number;
  depositEnabled: boolean;
}

export const DEFAULT_INSTRUCTIONS = [
  "Open Google Pay / PhonePe / Paytm / BHIM",
  "Scan the QR code or pay to the UPI ID",
  "Pay the exact amount you selected",
  "Return to XArena",
  "Enter your UTR / Transaction ID",
  "Upload the payment screenshot",
].join("\n");

const KEYS = {
  upiId: "payment.upi_id",
  accountName: "payment.account_name",
  qrKey: "payment.qr_key",
  instructions: "payment.instructions",
  minDepositRupees: "payment.min_deposit_rupees",
  maxDepositRupees: "payment.max_deposit_rupees",
  depositEnabled: "payment.deposit_enabled",
} as const;

function readKey<T>(key: string, fallback: T): T {
  const row = db.prepare("SELECT value FROM Setting WHERE key = ?").get(key) as { value: string } | undefined;
  if (!row) return fallback;
  try {
    return JSON.parse(row.value) as T;
  } catch {
    return fallback;
  }
}

export function getPaymentSettings(): PaymentSettings {
  return {
    upiId: readKey<string>(KEYS.upiId, ""),
    accountName: readKey<string>(KEYS.accountName, ""),
    qrKey: readKey<string | null>(KEYS.qrKey, null),
    instructions: readKey<string>(KEYS.instructions, DEFAULT_INSTRUCTIONS),
    minDepositRupees: readKey<number>(KEYS.minDepositRupees, 50),
    maxDepositRupees: readKey<number>(KEYS.maxDepositRupees, 10000),
    depositEnabled: readKey<boolean>(KEYS.depositEnabled, true),
  };
}

export function savePaymentSettings(patch: Partial<PaymentSettings>) {
  const now = new Date().toISOString();
  const stmt = db.prepare(
    `INSERT INTO Setting (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`
  );
  db.transaction(() => {
    for (const [field, value] of Object.entries(patch)) {
      if (value === undefined) continue;
      stmt.run(KEYS[field as keyof typeof KEYS], JSON.stringify(value), now);
    }
  })();
}

/** A user can only pay if an admin has configured a destination (UPI ID and/or QR) and deposits are on. */
export function isPaymentConfigured(s: PaymentSettings): boolean {
  return Boolean(s.upiId || s.qrKey);
}
