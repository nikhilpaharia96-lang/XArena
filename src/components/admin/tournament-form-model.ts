import { validateImageUrl } from "@/lib/image-url";

export const STEPS = [
  { id: "basic", label: "Basic Info" },
  { id: "format", label: "Format" },
  { id: "prize", label: "Entry & Prize" },
  { id: "schedule", label: "Schedule" },
  { id: "room", label: "Room" },
  { id: "advanced", label: "Advanced" },
] as const;
export type StepId = (typeof STEPS)[number]["id"];

export interface TournamentForm {
  title: string;
  slug: string;
  gameId: string;
  category: string | null;
  description: string;
  rules: string[];
  bannerUrl: string | null;
  thumbnailUrl: string | null;
  mode: string;
  roomSize: number;
  map: string;
  format: "FREE" | "PAID";
  entryFee: number;
  maxSlots: number;
  prizePool: number;
  prizes: number[]; // index 0 = 1st place
  regStarts: string; // datetime-local
  regEnds: string;
  matchStarts: string;
  matchEnds: string;
  cadence: string;
  isFeatured: boolean;
  slotSelection: boolean;
  scoringSystem: string;
  adminNotes: string;
}

export const emptyForm: TournamentForm = {
  title: "",
  slug: "",
  gameId: "",
  category: null,
  description: "",
  rules: [""],
  bannerUrl: null,
  thumbnailUrl: null,
  mode: "SOLO",
  roomSize: 1,
  map: "",
  format: "FREE",
  entryFee: 0,
  maxSlots: 16,
  prizePool: 0,
  prizes: [0],
  regStarts: "",
  regEnds: "",
  matchStarts: "",
  matchEnds: "",
  cadence: "ONE_OFF",
  isFeatured: false,
  slotSelection: true,
  scoringSystem: "",
  adminNotes: "",
};

export const MODE_TEAM_SIZE: Record<string, number> = { SOLO: 1, DUO: 2, SQUAD: 4, ONE_V_ONE: 1, TWO_V_TWO: 2, FOUR_V_FOUR: 4 };
// For these modes the team size is fixed by the mode itself (matches src/lib/slot-layout.ts).
export const FIXED_MODES = ["SOLO", "DUO", "SQUAD", "ONE_V_ONE"];
export const ALL_MODES = ["SOLO", "DUO", "SQUAD", "ONE_V_ONE", "TWO_V_TWO", "FOUR_V_FOUR", "CLASSIC", "CLASH_SQUAD", "CUSTOM"];
export const FF_MAPS = ["Bermuda", "Kalahari", "Alpine", "NexTerra", "Purgatory"];
// Categories that are XArena's own, not official in-game modes (shown differently in the UI).
export const CUSTOM_CATEGORY_VALUES = ["MESSI_DRAW", "WORLD_CLASS_SUPERSTAR"];

export const slugify = (v: string) =>
  v.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);

export const ordinal = (n: number) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};

/** Rules are stored as plain text (DB-compatible): one numbered rule per line. */
export const rulesToText = (rules: string[]) =>
  rules.map((r) => r.trim()).filter(Boolean).map((r, i) => `${i + 1}. ${r}`).join("\n");
export const textToRules = (text: string) => {
  const lines = (text ?? "").split("\n").map((l) => l.replace(/^\s*\d+[.)]\s*/, "").trim()).filter(Boolean);
  return lines.length ? lines : [""];
};

const pad = (n: number) => String(n).padStart(2, "0");
export const isoToLocalInput = (iso?: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};
export const localInputToIso = (v: string) => {
  if (!v) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};

export const STEP_OF_FIELD: Record<string, StepId> = {
  title: "basic", slug: "basic", gameId: "basic", category: "basic", description: "basic", rules: "basic", bannerUrl: "basic", thumbnailUrl: "basic",
  mode: "format", roomSize: "format", map: "format",
  entryFee: "prize", maxSlots: "prize", prizePool: "prize", prizes: "prize",
  regStarts: "schedule", regEnds: "schedule", matchStarts: "schedule", matchEnds: "schedule",
  scoringSystem: "advanced", adminNotes: "advanced",
};

/** Minimum needed to save a meaningful draft. */
export function validateDraft(f: TournamentForm): Record<string, string> {
  const e: Record<string, string> = {};
  if (f.title.trim().length < 3) e.title = "Name must be at least 3 characters";
  if (!f.slug) e.slug = "Slug is required";
  else if (!/^[a-z0-9-]+$/.test(f.slug)) e.slug = "Lowercase letters, numbers and hyphens only";
  if (!f.gameId) e.gameId = "Select a game";
  for (const k of ["bannerUrl", "thumbnailUrl"] as const) {
    const v = f[k];
    if (v) {
      const p = validateImageUrl(v);
      if (p) e[k] = p;
    }
  }
  return e;
}

/** Everything required before a tournament can be created/published. */
export function validateFull(f: TournamentForm, needsCategory: boolean): Record<string, string> {
  const e = validateDraft(f);
  if (f.title.trim().length > 100) e.title = "Name must be 100 characters or fewer";
  if (needsCategory && !f.category) e.category = "Select a category for this game";
  if (f.description.trim().length < 10) e.description = "Description must be at least 10 characters";
  if (f.description.length > 1000) e.description = "Description must be 1000 characters or fewer";
  if (rulesToText(f.rules).length < 10) e.rules = "Add at least one rule (10+ characters in total)";
  if (!f.mode) e.mode = "Select a tournament type";
  if (!Number.isInteger(f.roomSize) || f.roomSize < 1 || f.roomSize > 64) e.roomSize = "Team size must be 1–64";
  else if (f.roomSize > f.maxSlots) e.roomSize = "Team size can't exceed max slots";
  if (!Number.isInteger(f.maxSlots) || f.maxSlots < 2 || f.maxSlots > 1000) e.maxSlots = "Between 2 and 1000";
  if (!Number.isInteger(f.entryFee) || f.entryFee < 0) e.entryFee = "Enter a whole number (₹)";
  else if (f.format === "PAID" && f.entryFee <= 0) e.entryFee = "Paid tournaments need an entry fee above ₹0";
  if (!Number.isInteger(f.prizePool) || f.prizePool < 0) e.prizePool = "Enter a whole number (₹)";
  if (f.prizes.length === 0) e.prizes = "Add at least one prize position";
  else if (f.prizes.some((p) => !Number.isInteger(p) || p < 0)) e.prizes = "Prizes must be whole numbers, 0 or more";
  else {
    const sum = f.prizes.reduce((n, p) => n + p, 0);
    if (sum > f.prizePool) e.prizes = `Prizes add up to ₹${sum}, more than the ₹${f.prizePool} pool`;
  }
  const rs = new Date(f.regStarts).getTime(), re = new Date(f.regEnds).getTime(), ms = new Date(f.matchStarts).getTime(), me = new Date(f.matchEnds).getTime();
  if (!f.regStarts) e.regStarts = "Required";
  if (!f.regEnds) e.regEnds = "Required";
  else if (f.regStarts && re <= rs) e.regEnds = "Must be after registration opens";
  if (!f.matchStarts) e.matchStarts = "Required";
  else if (f.regEnds && ms < re) e.matchStarts = "Must be on/after registration closes";
  if (f.matchEnds && f.matchStarts && me <= ms) e.matchEnds = "Must be after the match starts";
  return e;
}

/** Builds the API payload. Drafts send only what's filled in. */
export function buildPayload(f: TournamentForm, opts: { draft: boolean; ffCategory: boolean; includeSlug: boolean }) {
  const dateOrUndef = (v: string) => localInputToIso(v);
  const payload: Record<string, unknown> = {
    title: f.title.trim(),
    gameId: f.gameId,
    description: f.description.trim(),
    rules: rulesToText(f.rules),
    bannerUrl: f.bannerUrl,
    thumbnailUrl: f.thumbnailUrl,
    mode: f.mode,
    roomSize: f.roomSize,
    map: f.map.trim() || null,
    category: opts.ffCategory ? f.category : null,
    format: f.format,
    cadence: f.cadence,
    entryFeeRupees: f.format === "FREE" ? 0 : f.entryFee,
    maxSlots: f.maxSlots,
    prizePoolRupees: f.prizePool,
    prizeDistribution: f.prizes.map((amountRupees, i) => ({ position: i + 1, amountRupees })),
    isFeatured: f.isFeatured,
    slotSelection: f.slotSelection,
    scoringSystem: f.scoringSystem.trim() || null,
    adminNotes: f.adminNotes.trim() || null,
    matchEndsAt: dateOrUndef(f.matchEnds) ?? null,
  };
  if (opts.includeSlug) payload.slug = f.slug;
  const rs = dateOrUndef(f.regStarts), re = dateOrUndef(f.regEnds), ms = dateOrUndef(f.matchStarts);
  if (rs) payload.registrationStartsAt = rs;
  if (re) payload.registrationEndsAt = re;
  if (ms) payload.matchStartsAt = ms;
  if (opts.draft) payload.saveAsDraft = true;
  return payload;
}
