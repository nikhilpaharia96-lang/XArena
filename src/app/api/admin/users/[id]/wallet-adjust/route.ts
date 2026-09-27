import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { createId, createReferenceId } from "@/server/lib/ids";
import { walletAdjustSchema } from "@/server/lib/admin-schemas";
import { rupeesToPaise } from "@/server/lib/money";
import { writeAuditLog } from "@/server/lib/audit";

const BALANCE_COLUMN = {
  deposit: "depositBalance",
  winning: "winningBalance",
  bonus: "bonusBalance",
} as const;

export async function POST(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN");
    const { id } = await context.params;
    const body = await req.json();
    const input = walletAdjustSchema.parse(body);

    const wallet = db.prepare("SELECT * FROM Wallet WHERE userId = ?").get(id) as
      | Record<string, number>
      | undefined;
    if (!wallet) throw new ApiError(404, "Wallet not found for this user.", "NOT_FOUND");

    const amountPaise = rupeesToPaise(input.amountRupees);
    const column = BALANCE_COLUMN[input.balanceType];

    if (amountPaise < 0 && wallet[column] + amountPaise < 0) {
      throw new ApiError(400, `Adjustment would make ${input.balanceType} balance negative.`, "WOULD_GO_NEGATIVE");
    }

    const now = new Date().toISOString();

    db.transaction(() => {
      db.prepare(`UPDATE Wallet SET ${column} = ${column} + ?, updatedAt = ? WHERE userId = ?`).run(
        amountPaise,
        now,
        id
      );

      const updated = db.prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?").get(id) as {
        depositBalance: number;
        winningBalance: number;
        bonusBalance: number;
      };
      const total = updated.depositBalance + updated.winningBalance + updated.bonusBalance;

      db.prepare(
        `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
         VALUES (?, ?, 'ADMIN_ADJUSTMENT', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
      ).run(
        createId("txn"),
        id,
        Math.abs(amountPaise),
        total,
        createReferenceId("ADJ"),
        `Admin adjustment: ${input.reason}`,
        JSON.stringify({ balanceType: input.balanceType, adjustedBy: admin.id, signedAmount: amountPaise }),
        now
      );

      db.prepare(
        `INSERT INTO Notification (id, userId, type, title, body, createdAt) VALUES (?, ?, 'SYSTEM', ?, ?, ?)`
      ).run(
        createId("notif"),
        id,
        amountPaise >= 0 ? "Wallet credited" : "Wallet adjusted",
        `Your ${input.balanceType} balance was adjusted by an administrator.`,
        now
      );
    })();

    writeAuditLog({
      actorId: admin.id,
      action: "WALLET_ADJUSTED",
      targetType: "User",
      targetId: id,
      metadata: { amountPaise, balanceType: input.balanceType, reason: input.reason },
    });

    return ok({ adjusted: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
