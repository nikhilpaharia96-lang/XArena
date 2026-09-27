import { z } from "zod";

export const createTournamentSchema = z.object({
  title: z.string().trim().min(3).max(120),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().trim().min(10),
  bannerUrl: z.string().url().optional(),
  gameId: z.string().min(1),
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
  maxSlots: z.number().int().min(2).max(1000),
  roomSize: z.number().int().min(1).max(64),
  map: z.string().trim().optional(),
  rules: z.string().trim().min(10),
  scoringSystem: z.string().trim().optional(),
  registrationStartsAt: z.string().datetime(),
  registrationEndsAt: z.string().datetime(),
  matchStartsAt: z.string().datetime(),
  isFeatured: z.boolean().default(false),
  adminNotes: z.string().trim().optional(),
});
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

export const updateTournamentSchema = createTournamentSchema.partial();

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
