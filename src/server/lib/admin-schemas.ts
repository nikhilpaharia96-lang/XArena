import { z } from "zod";
import { FREE_FIRE_CATEGORY_VALUES } from "@/lib/free-fire-categories";

export const createTournamentSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(120, "Title must be 120 characters or fewer"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().trim().min(10, "Description must be at least 10 characters"),
  bannerUrl: z.string().url().optional(),
  gameId: z.string().min(1, "Select a game"),
  mode: z.enum([
    "SOLO",
    "DUO",
    "SQUAD",
    "ONE_V_ONE",
    "TWO_V_TWO",
    "FOUR_V_FOUR",
    "CLASSIC",
    "CLASH_SQUAD",
    "CUSTOM",
  ]),
  format: z.enum(["FREE", "PAID"]),
  cadence: z.enum(["DAILY", "WEEKLY", "MEGA", "ONE_OFF"]).default("ONE_OFF"),
  entryFeeRupees: z.number().int().min(0),
  prizePoolRupees: z.number().int().min(0),
  prizeDistribution: z
    .array(z.object({ position: z.number().int().min(1), amountRupees: z.number().int().min(0) }))
    .min(1),
  maxSlots: z.number().int().min(2, "Max slots must be at least 2").max(1000, "Max slots can't exceed 1000"),
  roomSize: z.number().int().min(1, "Room size must be at least 1").max(64, "Room size can't exceed 64"),
  map: z.string().trim().optional(),
  category: z.enum(FREE_FIRE_CATEGORY_VALUES).nullable().optional(),
  rules: z.string().trim().min(10, "Rules must be at least 10 characters"),
  scoringSystem: z.string().trim().optional(),
  registrationStartsAt: z.string().datetime(),
  registrationEndsAt: z.string().datetime(),
  matchStartsAt: z.string().datetime(),
  isFeatured: z.boolean().default(false),
  adminNotes: z.string().trim().optional(),
});
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

// .partial() alone keeps the create-schema defaults (cadence, isFeatured), which would
// silently reset those fields on every PATCH. Override them as plain optionals.
export const updateTournamentSchema = createTournamentSchema.partial().extend({
  cadence: z.enum(["DAILY", "WEEKLY", "MEGA", "ONE_OFF"]).optional(),
  isFeatured: z.boolean().optional(),
});

export const releaseRoomSchema = z.object({
  roomId: z.string().trim().min(1),
  roomPassword: z.string().trim().min(1),
});

export const walletAdjustSchema = z.object({
  amountRupees: z.number().int(), // can be negative for deductions
  balanceType: z.enum(["deposit", "winning", "bonus"]),
  reason: z.string().trim().min(5).max(300),
});

export const banUserSchema = z.object({
  reason: z.string().trim().min(5).max(300),
});
