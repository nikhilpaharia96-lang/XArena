import { z } from "zod";
import { FREE_FIRE_CATEGORY_VALUES } from "@/lib/free-fire-categories";

/**
 * Canonical image reference: either an external http(s) URL or a path under our own
 * public upload route. Anything else (javascript:, data:, file:, relative junk) is rejected.
 */
export const imageRefSchema = z
  .string()
  .trim()
  .max(2000, "Image URL is too long")
  .refine((v) => {
    if (/^\/api\/uploads\/images\/[\w.-]+$/.test(v)) return true;
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Invalid image URL (use http:// or https://, or upload a file)");

const modeEnum = z.enum([
  "SOLO",
  "DUO",
  "SQUAD",
  "ONE_V_ONE",
  "TWO_V_TWO",
  "FOUR_V_FOUR",
  "CLASSIC",
  "CLASH_SQUAD",
  "CUSTOM",
]);
const cadenceEnum = z.enum(["DAILY", "WEEKLY", "MEGA", "ONE_OFF"]);

const tournamentBase = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(100, "Title must be 100 characters or fewer"),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only")
    .max(120),
  description: z.string().trim().min(10, "Description must be at least 10 characters").max(1000, "Description must be 1000 characters or fewer"),
  bannerUrl: imageRefSchema.nullable().optional(),
  thumbnailUrl: imageRefSchema.nullable().optional(),
  gameId: z.string().min(1, "Select a game"),
  mode: modeEnum,
  format: z.enum(["FREE", "PAID"]),
  cadence: cadenceEnum.default("ONE_OFF"),
  entryFeeRupees: z.number().int().min(0),
  prizePoolRupees: z.number().int().min(0),
  prizeDistribution: z
    .array(z.object({ position: z.number().int().min(1), amountRupees: z.number().int().min(0) }))
    .min(1, "Add at least one prize position"),
  maxSlots: z.number().int().min(2, "Max slots must be at least 2").max(1000, "Max slots can't exceed 1000"),
  roomSize: z.number().int().min(1, "Room size must be at least 1").max(64, "Room size can't exceed 64"),
  map: z.string().trim().max(60).nullable().optional(),
  category: z.enum(FREE_FIRE_CATEGORY_VALUES).nullable().optional(),
  rules: z.string().trim().min(10, "Rules must be at least 10 characters").max(5000),
  scoringSystem: z.string().trim().max(1000).nullable().optional(),
  registrationStartsAt: z.string().datetime(),
  registrationEndsAt: z.string().datetime(),
  matchStartsAt: z.string().datetime(),
  matchEndsAt: z.string().datetime().nullable().optional(),
  isFeatured: z.boolean().default(false),
  slotSelection: z.boolean().default(true),
  adminNotes: z.string().trim().max(1000).nullable().optional(),
});

type CrossFields = {
  format?: string;
  entryFeeRupees?: number;
  prizePoolRupees?: number;
  prizeDistribution?: { position: number; amountRupees: number }[];
  maxSlots?: number;
  roomSize?: number;
  registrationStartsAt?: string;
  registrationEndsAt?: string;
  matchStartsAt?: string;
  matchEndsAt?: string | null;
};

/** Business rules that span several fields. Only checks pairs where both values are present. */
export function crossFieldIssues(v: CrossFields, opts: { draft?: boolean } = {}): { path: string; message: string }[] {
  const out: { path: string; message: string }[] = [];
  const t = (x?: string | null) => (x ? new Date(x).getTime() : NaN);
  const rs = t(v.registrationStartsAt), re = t(v.registrationEndsAt), ms = t(v.matchStartsAt), me = t(v.matchEndsAt);
  if (!Number.isNaN(rs) && !Number.isNaN(re) && re <= rs) out.push({ path: "registrationEndsAt", message: "Registration must close after it opens" });
  if (!Number.isNaN(re) && !Number.isNaN(ms) && ms < re) out.push({ path: "matchStartsAt", message: "Match can't start before registration closes" });
  if (!Number.isNaN(ms) && !Number.isNaN(me) && me <= ms) out.push({ path: "matchEndsAt", message: "Match must end after it starts" });
  if (!opts.draft && v.format === "PAID" && v.entryFeeRupees !== undefined && v.entryFeeRupees <= 0) out.push({ path: "entryFeeRupees", message: "Paid tournaments need an entry fee above ₹0" });
  if (v.format === "FREE" && v.entryFeeRupees !== undefined && v.entryFeeRupees > 0) out.push({ path: "entryFeeRupees", message: "Free tournaments can't have an entry fee" });
  if (v.maxSlots !== undefined && v.roomSize !== undefined && v.roomSize > v.maxSlots) out.push({ path: "roomSize", message: "Room size can't exceed max slots" });
  if (v.prizeDistribution) {
    const positions = v.prizeDistribution.map((p) => p.position);
    if (new Set(positions).size !== positions.length) out.push({ path: "prizeDistribution", message: "Prize positions must be unique" });
    const sum = v.prizeDistribution.reduce((n, p) => n + p.amountRupees, 0);
    if (v.prizePoolRupees !== undefined && sum > v.prizePoolRupees) out.push({ path: "prizeDistribution", message: `Prizes add up to ₹${sum}, more than the ₹${v.prizePoolRupees} pool` });
  }
  return out;
}

export const createTournamentSchema = tournamentBase.superRefine((v, ctx) => {
  for (const i of crossFieldIssues(v)) ctx.addIssue({ code: "custom", path: [i.path], message: i.message });
});
export type CreateTournamentInput = z.infer<typeof createTournamentSchema>;

/**
 * Drafts may be incomplete: only title, slug and game are mandatory. Everything else is
 * optional and only validated for shape when provided. A draft can't be published until it
 * passes createTournamentSchema (enforced in the publish route).
 */
export const draftTournamentSchema = tournamentBase.partial().extend({
  title: tournamentBase.shape.title,
  slug: tournamentBase.shape.slug,
  gameId: tournamentBase.shape.gameId,
  description: z.string().trim().max(1000, "Description must be 1000 characters or fewer").optional(),
  rules: z.string().trim().max(5000).optional(),
  prizeDistribution: tournamentBase.shape.prizeDistribution.or(z.array(z.never()).length(0)).optional(),
  cadence: cadenceEnum.optional(),
  isFeatured: z.boolean().optional(),
  slotSelection: z.boolean().optional(),
});
export type DraftTournamentInput = z.infer<typeof draftTournamentSchema>;

// .partial() alone keeps the create-schema defaults (cadence, isFeatured), which would
// silently reset those fields on every PATCH. Override them as plain optionals.
export const updateTournamentSchema = tournamentBase.partial().extend({
  cadence: cadenceEnum.optional(),
  isFeatured: z.boolean().optional(),
  slotSelection: z.boolean().optional(),
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
