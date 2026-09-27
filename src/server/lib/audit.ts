import { db } from "@/server/db/client";
import { createId } from "./ids";

/**
 * Every admin mutation (ban, wallet adjustment, tournament cancel, withdrawal
 * approval, etc.) must call this. This is what makes the "Audit Logs" admin
 * screen and the security requirement "audit trail for all admin actions"
 * real rather than aspirational — nothing in the admin API mutates state
 * without leaving a row here.
 */
export function writeAuditLog(params: {
  actorId: string;
  action: string;
  targetType?: string;
  targetId?: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string | null;
}) {
  db.prepare(
    `INSERT INTO AuditLog (id, actorId, action, targetType, targetId, metadata, ipAddress, createdAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    createId("audit"),
    params.actorId,
    params.action,
    params.targetType ?? null,
    params.targetId ?? null,
    params.metadata ? JSON.stringify(params.metadata) : null,
    params.ipAddress ?? null,
    new Date().toISOString()
  );
}
