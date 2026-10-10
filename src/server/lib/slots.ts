import { db } from "@/server/db/client";
import { buildLayout, positionLabel, positionsInSlot, slotLabel, type SlotLayout } from "@/lib/slot-layout";

export type SlotState = "AVAILABLE" | "OCCUPIED" | "SELECTED" | "LOCKED" | "UNAVAILABLE";

export interface TournamentSlotRow {
  id: string;
  slug: string;
  title: string;
  status: string;
  mode: string;
  format: string;
  roomSize: number;
  maxSlots: number;
  slotsFilled: number;
  entryFee: number;
  slotSelection: number;
  registrationStartsAt: string;
  registrationEndsAt: string;
}

export interface Occupant {
  participantId: string;
  username: string;
  mine: boolean;
  // Admin-only details (never sent to other players)
  userId?: string;
  ign?: string | null;
  gameUid?: string | null;
  teamName?: string | null;
  joinedAt?: string;
  entryFee?: number;
  paymentStatus?: string;
  status?: string;
}

export interface BoardPosition {
  position: number;
  label: string;
  state: Exclude<SlotState, "SELECTED">;
  occupant: Occupant | null;
}
export interface BoardSlot {
  slotNumber: number;
  label: string;
  locked: boolean;
  positions: BoardPosition[];
}
export interface Board {
  layout: SlotLayout;
  slots: BoardSlot[];
  counts: { capacity: number; registered: number; available: number; locked: number; unassigned: number };
}

/** Why a player can't register right now (null = registration is open for them). */
export function registrationBlock(t: TournamentSlotRow, now = new Date()): { code: string; message: string } | null {
  if (!["PUBLISHED", "REGISTRATION_OPEN"].includes(t.status)) {
    return { code: "REGISTRATION_CLOSED", message: "Registration is not open for this tournament." };
  }
  if (now < new Date(t.registrationStartsAt)) return { code: "REGISTRATION_NOT_STARTED", message: "Registration hasn't started yet." };
  if (now > new Date(t.registrationEndsAt)) return { code: "REGISTRATION_CLOSED", message: "Registration has closed for this tournament." };
  if (t.slotsFilled >= t.maxSlots) return { code: "TOURNAMENT_FULL", message: "This tournament is full." };
  return null;
}

/**
 * The single source of truth for slot state. Both the player slot picker and the admin slot
 * grid are built from this one function over the same two tables, so they can never disagree.
 */
export function buildBoard(t: TournamentSlotRow, opts: { viewerId: string | null; admin: boolean; accepting: boolean }): Board {
  const layout = buildLayout(t.mode, t.roomSize, t.maxSlots);

  const rows = db
    .prepare(
      `SELECT tp.id, tp.userId, tp.teamName, tp.status, tp.joinedAt, tp.slotNumber, tp.position, tp.ign, tp.gameUid,
              tp.entryTxnId, u.username
       FROM TournamentParticipant tp JOIN User u ON u.id = tp.userId
       WHERE tp.tournamentId = ?`
    )
    .all(t.id) as {
    id: string; userId: string; teamName: string | null; status: string; joinedAt: string; slotNumber: number | null;
    position: number | null; ign: string | null; gameUid: string | null; entryTxnId: string | null; username: string;
  }[];
  const lockedSlots = new Set(
    (db.prepare("SELECT slotNumber FROM TournamentSlotLock WHERE tournamentId = ?").all(t.id) as { slotNumber: number }[]).map((r) => r.slotNumber)
  );

  const bySpot = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (r.slotNumber != null && r.position != null) bySpot.set(`${r.slotNumber}:${r.position}`, r);

  let lockedPositions = 0;
  let assigned = 0;
  const slots: BoardSlot[] = [];
  for (let s = 1; s <= layout.teamCount; s++) {
    const n = positionsInSlot(layout, s);
    const locked = lockedSlots.has(s);
    const positions: BoardPosition[] = [];
    for (let p = 1; p <= n; p++) {
      const r = bySpot.get(`${s}:${p}`);
      let state: BoardPosition["state"];
      let occupant: Occupant | null = null;
      if (r) {
        state = "OCCUPIED";
        assigned++;
        occupant = {
          participantId: r.id,
          username: r.username,
          mine: r.userId === opts.viewerId,
          ...(opts.admin
            ? {
                userId: r.userId,
                ign: r.ign,
                gameUid: r.gameUid,
                teamName: r.teamName,
                joinedAt: r.joinedAt,
                status: r.status,
                entryFee: t.entryFee,
                paymentStatus: t.entryFee > 0 ? (r.entryTxnId ? "PAID" : "UNPAID") : "FREE",
              }
            : {}),
        };
      } else if (locked) {
        state = "LOCKED";
        lockedPositions++;
      } else {
        state = opts.admin || opts.accepting ? "AVAILABLE" : "UNAVAILABLE";
      }
      positions.push({ position: p, label: positionLabel(p), state, occupant });
    }
    slots.push({ slotNumber: s, label: slotLabel(layout, s), locked, positions });
  }

  return {
    layout,
    slots,
    counts: {
      capacity: layout.maxSlots,
      registered: t.slotsFilled,
      available: Math.max(0, layout.maxSlots - t.slotsFilled - lockedPositions),
      locked: lockedPositions,
      // registrations counted on the tournament but without a seat in the grid
      unassigned: Math.max(0, t.slotsFilled - assigned),
    },
  };
}

export function getTournamentForSlots(by: { slug?: string; id?: string }): TournamentSlotRow | undefined {
  const col = by.id ? "id" : "slug";
  return db
    .prepare(
      `SELECT id, slug, title, status, mode, format, roomSize, maxSlots, slotsFilled, entryFee, slotSelection,
              registrationStartsAt, registrationEndsAt
       FROM Tournament WHERE ${col} = ?`
    )
    .get(by.id ?? by.slug) as TournamentSlotRow | undefined;
}
