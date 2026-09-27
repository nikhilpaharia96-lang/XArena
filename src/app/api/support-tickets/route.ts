import { db } from "@/server/db/client";
import { ApiError, fail, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { createId } from "@/server/lib/ids";
import { z } from "zod";

const createTicketSchema = z.object({
  subject: z.string().trim().min(3).max(120),
  message: z.string().trim().min(10).max(2000),
  priority: z.enum(["LOW", "MEDIUM", "HIGH", "URGENT"]).default("MEDIUM"),
});

export async function GET() {
  try {
    const user = await getCurrentUser();
    const tickets = db
      .prepare(
        `SELECT id, subject, message, status, priority, createdAt, updatedAt
         FROM SupportTicket WHERE userId = ? ORDER BY createdAt DESC`
      )
      .all(user.id);
    return ok(tickets);
  } catch (error) {
    return fail(error);
  }
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const input = createTicketSchema.parse(body);

    const now = new Date().toISOString();
    const id = createId("tkt");
    db.prepare(
      `INSERT INTO SupportTicket (id, userId, subject, message, status, priority, createdAt, updatedAt)
       VALUES (?, ?, ?, ?, 'OPEN', ?, ?, ?)`
    ).run(id, user.id, input.subject, input.message, input.priority, now, now);

    return ok({ id, status: "OPEN" }, 201);
  } catch (error) {
    if (error instanceof Error && error.name === "ZodError") {
      return fail(new ApiError(400, "Invalid input.", "VALIDATION_ERROR"));
    }
    return fail(error);
  }
}
