import { db } from "@/server/db/client";
import { ApiError, fail, ok, validationError } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { checkRateLimit, getClientKey } from "@/server/lib/rate-limit";
import { assertBankOtp, clearBankOtp, isBankOtpRequired } from "@/server/lib/bank-otp";
import { addBankSchema } from "@/types/schemas";
import { BANKS, MAX_BANKS, bankFromIfsc } from "@/lib/banks";

interface BankRow {
  id: string;
  slot: number;
  ifsc: string;
  bankName: string;
  accountNumber: string;
  accountHolder: string;
  createdAt: string;
}

export async function GET() {
  try {
    const user = await getCurrentUser();
    const banks = db
      .prepare(
        "SELECT id, slot, ifsc, bankName, accountNumber, accountHolder, createdAt FROM BankAccount WHERE userId = ? ORDER BY slot ASC"
      )
      .all(user.id) as BankRow[];
    return ok({ banks, maxBanks: MAX_BANKS, otpRequired: isBankOtpRequired() });
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    const { allowed } = checkRateLimit(`bank-add:${getClientKey(req)}:${user.id}`, 10, 10 * 60_000);
    if (!allowed) throw new ApiError(429, "Too many attempts. Please try again later.");

    const input = addBankSchema.parse(await req.json());

    // The IFSC prefix identifies the bank; reject obvious mismatches (typo'd IFSC or wrong bank picked).
    const ifscBank = bankFromIfsc(input.ifsc);
    const knownNames = new Set(BANKS.map((b) => b.name));
    if (ifscBank && knownNames.has(input.bankName) && ifscBank !== input.bankName) {
      throw new ApiError(400, `This IFSC belongs to ${ifscBank}, not ${input.bankName}.`, "IFSC_BANK_MISMATCH");
    }

    const existing = db.prepare("SELECT slot, accountNumber FROM BankAccount WHERE userId = ?").all(user.id) as {
      slot: number;
      accountNumber: string;
    }[];
    if (existing.length >= MAX_BANKS) {
      throw new ApiError(400, `You can save up to ${MAX_BANKS} bank accounts. Remove one to add another.`, "BANK_LIMIT");
    }
    if (existing.some((b) => b.accountNumber === input.accountNumber)) {
      throw new ApiError(409, "This account number is already saved.", "BANK_DUPLICATE");
    }

    // OTP (when enabled) is only checked and consumed once everything else is valid.
    const otpRequired = isBankOtpRequired();
    if (otpRequired) assertBankOtp(user.id, input.otp ?? "");

    const used = new Set(existing.map((b) => b.slot));
    let slot = 1;
    while (used.has(slot)) slot++;

    const id = createId("bank");
    db.transaction(() => {
      db.prepare(
        `INSERT INTO BankAccount (id, userId, slot, ifsc, bankName, accountNumber, accountHolder, createdAt)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(id, user.id, slot, input.ifsc, input.bankName, input.accountNumber, input.accountHolder, new Date().toISOString());
      if (otpRequired) clearBankOtp(user.id);
    })();

    return ok({ id, slot }, 201);
  } catch (error) {
    return fail(validationError(error) ?? error);
  }
}
