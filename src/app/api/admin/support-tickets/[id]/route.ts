import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser, requireRole } from "@/server/lib/current-user";
import { writeAuditLog } from "@/server/lib/audit";
import { z } from "zod";

const updateTicketSchema = z.object({
  status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED", "CLOSED"]).optional(),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).optional(),
  assignedToId: z.string().optional(),
});

export async function PATCH(req: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser();
    requireRole(admin, "ADMIN", "SUPER_ADMIN", "MODERATOR");
    const { id } = await context.params;
    const body = await req.json();
    const input = updateTicketSchema.parse(body);

    const ticket = db.prepare("SELECT id FROM SupportTicket WHERE id = ?").get(id);
    if (!ticket) throw new ApiError(404, "Ticket not found.", "NOT_FOUND");

    const fields: string[] = [];
    const values: (string | undefined)[] = [];
    for (const [key, value] of Object.entries(input)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        values.push(value);
      }
    }
    if (fields.length === 0) throw new ApiError(400, "No fields to update.", "NO_FIELDS");

    fields.push("updatedAt = ?");
    values.push(new Date().toISOString());

    db.prepare(`UPDATE SupportTicket SET ${fields.join(", ")} WHERE id = ?`).run(...values, id);

    writeAuditLog({ actorId: admin.id, action: "TICKET_UPDATED", targetType: "SupportTicket", targetId: id, metadata: input });

    return ok({ updated: true });
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
