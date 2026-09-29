/**
 * Canonical Free Fire tournament categories. Plain data, no server or
 * browser dependencies, so it's shared by the API (validation), the admin
 * form (options) and the public pages (labels / URLs).
 *
 * `value` is what's stored in Tournament.category. `slug` is the URL segment
 * under /games/free-fire/[slug].
 */
export const FREE_FIRE_GAME_SLUG = "free-fire-max";
export const FREE_FIRE_ROUTE = "/games/free-fire";

export const FREE_FIRE_CATEGORIES = [
  { value: "FF_SURVIVAL", slug: "ff-survival", label: "FF Survival", description: "Battle Royale survival tournaments", tagline: "Battle Royale Survival Tournaments" },
  { value: "FF_FULL_MAP", slug: "ff-full-map", label: "FF Full Map", description: "Full-map Battle Royale tournaments", tagline: "Full-Map Battle Royale Tournaments" },
  { value: "CS_SCRIMS", slug: "cs-scrims", label: "CS Scrims", description: "Clash Squad scrim tournaments", tagline: "Clash Squad Scrim Tournaments" },
  { value: "MESSI_DRAW", slug: "messi-draw", label: "Messi Draw", description: "Messi Draw special tournaments", tagline: "Messi Draw Special Tournaments" },
  { value: "WORLD_CLASS_SUPERSTAR", slug: "world-class-superstar", label: "World Class Superstar", description: "Special community tournaments", tagline: "World Class Superstar Tournaments" },
  { value: "LONE_WOLF", slug: "lone-wolf", label: "Lone Wolf", description: "1v1 Lone Wolf tournaments", tagline: "1v1 Lone Wolf Tournaments" },
  { value: "CS_ONLY_HEAD", slug: "cs-only-head", label: "CS Only Head", description: "Clash Squad headshot-only tournaments", tagline: "Clash Squad Headshot-Only Tournaments" },
  { value: "CLASH_SQUAD", slug: "clash-squad", label: "Clash Squad", description: "Regular Clash Squad tournaments", tagline: "Regular Clash Squad Tournaments" },
  { value: "LW_HEAD", slug: "lw-head", label: "LW Head", description: "Lone Wolf headshot tournaments", tagline: "Lone Wolf Headshot Tournaments" },
] as const;

export type FreeFireCategoryValue = (typeof FREE_FIRE_CATEGORIES)[number]["value"];

export const FREE_FIRE_CATEGORY_VALUES = FREE_FIRE_CATEGORIES.map((c) => c.value) as [
  FreeFireCategoryValue,
  ...FreeFireCategoryValue[],
];

/** Popular row shown at the top of the Free Fire page. */
export const POPULAR_CATEGORY_VALUES: FreeFireCategoryValue[] = ["FF_SURVIVAL", "CS_SCRIMS", "LONE_WOLF", "CS_ONLY_HEAD"];

export function findCategoryBySlug(slug: string) {
  return FREE_FIRE_CATEGORIES.find((c) => c.slug === slug);
}

export function findCategoryByValue(value: string | null | undefined) {
  return FREE_FIRE_CATEGORIES.find((c) => c.value === value);
}

export function categoryLabel(value: string | null | undefined): string | null {
  return findCategoryByValue(value)?.label ?? null;
}

export function categoryHref(value: string) {
  const c = findCategoryByValue(value);
  return c ? `${FREE_FIRE_ROUTE}/${c.slug}` : FREE_FIRE_ROUTE;
}
