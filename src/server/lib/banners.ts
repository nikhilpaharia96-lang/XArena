import { z } from "zod";
import { imageRefSchema } from "@/server/lib/admin-schemas";

/** Hero images may be an upload/external URL (imageRefSchema) or a bundled static asset under /images. */
export const heroImageSchema = z.union([
  imageRefSchema,
  z.string().trim().regex(/^\/images\/[\w./-]+$/, "Invalid image path"),
]);

/** CTA / slide links: an in-app path ("/tournaments") or a full http(s) URL. */
export const linkSchema = z
  .string()
  .trim()
  .max(500)
  .refine((v) => {
    if (/^\/(?!\/)[^\s]*$/.test(v)) return true;
    try {
      const u = new URL(v);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, "Link must start with / (in-app page) or be a full http(s) URL");

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .optional();

const optionalLink = linkSchema.or(z.literal("")).transform((v) => (v === "" ? null : v)).nullable().optional();
const optionalImage = heroImageSchema.or(z.literal("")).transform((v) => (v === "" ? null : v)).nullable().optional();
const optionalDate = z.string().datetime().or(z.literal("")).transform((v) => (v === "" ? null : v)).nullable().optional();

export const bannerBaseSchema = z.object({
  title: z.string().trim().min(1, "Headline is required").max(120),
  subtitle: optionalText(220),
  badgeText: optionalText(40),
  imageUrl: heroImageSchema,
  mobileImageUrl: optionalImage,
  linkUrl: optionalLink,
  ctaLabel: optionalText(30),
  secondaryCtaLabel: optionalText(30),
  secondaryCtaUrl: optionalLink,
  sortOrder: z.number().int().min(0).optional(),
  isActive: z.boolean().optional(),
  startsAt: optionalDate,
  endsAt: optionalDate,
});

export const createBannerSchema = bannerBaseSchema;
export const updateBannerSchema = bannerBaseSchema.partial();

export function scheduleIssue(startsAt?: string | null, endsAt?: string | null): string | null {
  if (startsAt && endsAt && new Date(endsAt) <= new Date(startsAt)) return "End date must be after the start date.";
  return null;
}

export interface BannerRow {
  id: string;
  title: string;
  subtitle: string | null;
  badgeText: string | null;
  imageUrl: string;
  mobileImageUrl: string | null;
  linkUrl: string | null;
  ctaLabel: string | null;
  secondaryCtaLabel: string | null;
  secondaryCtaUrl: string | null;
  sortOrder: number;
  isActive: number;
  startsAt: string | null;
  endsAt: string | null;
  createdAt: string;
  updatedAt: string | null;
}
