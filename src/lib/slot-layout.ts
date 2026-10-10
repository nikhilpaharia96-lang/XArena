/**
 * Slot/team layout math shared by the server (validation) and the client (rendering).
 * Nothing here is hardcoded per tournament: every number is derived from the tournament's
 * own mode / roomSize / maxSlots columns.
 *
 * - maxSlots  = total player positions in the tournament
 * - team size = fixed for SOLO/DUO/SQUAD/1v1, otherwise the configured roomSize
 * - teams     = ceil(maxSlots / team size); the last team may be smaller
 */
export const FIXED_TEAM_SIZE: Record<string, number> = { SOLO: 1, DUO: 2, SQUAD: 4, ONE_V_ONE: 1 };

export interface SlotLayout {
  teamSize: number;
  teamCount: number;
  maxSlots: number;
}

export function teamSizeFor(mode: string, roomSize: number): number {
  return FIXED_TEAM_SIZE[mode] ?? Math.max(1, Math.floor(roomSize || 1));
}

export function buildLayout(mode: string, roomSize: number, maxSlots: number): SlotLayout {
  const teamSize = teamSizeFor(mode, roomSize);
  const total = Math.max(0, Math.floor(maxSlots || 0));
  return { teamSize, teamCount: Math.ceil(total / teamSize), maxSlots: total };
}

/** Number of positions that exist inside a given slot/team (0 if the slot doesn't exist). */
export function positionsInSlot(layout: SlotLayout, slotNumber: number): number {
  if (!Number.isInteger(slotNumber) || slotNumber < 1 || slotNumber > layout.teamCount) return 0;
  return Math.min(layout.teamSize, layout.maxSlots - (slotNumber - 1) * layout.teamSize);
}

export const positionLabel = (position: number) => String.fromCharCode(64 + position); // 1 -> A

export const slotLabel = (layout: SlotLayout, slotNumber: number) =>
  layout.teamSize === 1 ? `Slot ${slotNumber}` : `Team ${slotNumber}`;

export const slotKey = (slotNumber: number, position: number) => `${slotNumber}:${position}`;

/** First free, unlocked position, filling teams in order. Null when nothing is free. */
export function firstFreePosition(
  layout: SlotLayout,
  taken: Set<string>,
  lockedSlots: Set<number>
): { slotNumber: number; position: number } | null {
  for (let s = 1; s <= layout.teamCount; s++) {
    if (lockedSlots.has(s)) continue;
    const n = positionsInSlot(layout, s);
    for (let p = 1; p <= n; p++) {
      if (!taken.has(slotKey(s, p))) return { slotNumber: s, position: p };
    }
  }
  return null;
}
