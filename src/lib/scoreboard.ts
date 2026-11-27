/** Turns pasted scoreboard text into rows and matches each name to a registered player. */

export interface ScoreLine {
  placement: number;
  name: string;
  kills: number;
}

export interface RosterEntry {
  participantId: string;
  username: string;
  ign: string | null;
  gameUid: string | null;
}

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, "").replace(/[^\p{L}\p{N}]/gu, "");

/** Accepts lines like "1, ShadowStrike, 7", "1<TAB>ShadowStrike<TAB>7", "1 | ShadowStrike | 7" or "1 ShadowStrike 7". */
export function parseScoreboard(text: string): { lines: ScoreLine[]; bad: string[] } {
  const lines: ScoreLine[] = [];
  const bad: string[] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    let placement: number | null = null;
    let name = "";
    let kills = 0;
    const parts = line.split(/\s*[,\t|]\s*/).filter(Boolean);
    if (parts.length >= 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[parts.length - 1])) {
      placement = Number(parts[0]);
      kills = Number(parts[parts.length - 1]);
      name = parts.slice(1, -1).join(" ");
    } else {
      const m = line.match(/^(\d+)\s+(.+?)\s+(\d+)$/);
      if (m) {
        placement = Number(m[1]);
        name = m[2];
        kills = Number(m[3]);
      }
    }
    if (placement === null || placement < 1 || !name) bad.push(line);
    else lines.push({ placement, name: name.trim(), kills });
  }
  return { lines, bad };
}

/** Matches by in-game name, game UID or app username (ignoring case, spaces and symbols). Returns null if unknown or ambiguous. */
export function matchPlayer(name: string, roster: RosterEntry[]): RosterEntry | null {
  const n = norm(name);
  if (!n) return null;
  for (const key of ["ign", "gameUid", "username"] as const) {
    const hits = roster.filter((r) => r[key] && norm(r[key] as string) === n);
    if (hits.length === 1) return hits[0];
  }
  return null;
}
