/** Game UID / in-game identity validation, shared by the registration form and the join API. */
const NUMERIC_UID_GAMES = new Set(["free-fire-max", "free-fire", "bgmi", "pubg-mobile", "cod-mobile"]);

export function validateGameUid(gameSlug: string, raw: string): string | null {
  const uid = raw.trim();
  if (!uid) return "Enter your Game UID";
  if (NUMERIC_UID_GAMES.has(gameSlug)) {
    if (!/^\d{6,15}$/.test(uid)) return "Game UID must be 6–15 digits (numbers only)";
    return null;
  }
  // Riot ID (Name#TAG), eFootball ID, etc: letters, numbers and a few separators.
  if (!/^[\w#.\- ]{3,40}$/.test(uid)) return "Enter a valid ID (3–40 letters, numbers, # . - _)";
  return null;
}

export function validateIgn(raw: string): string | null {
  const ign = raw.trim();
  if (ign.length < 2) return "Enter your in-game name (at least 2 characters)";
  if (ign.length > 40) return "In-game name must be 40 characters or fewer";
  return null;
}
