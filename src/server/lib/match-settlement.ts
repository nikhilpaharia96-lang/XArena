import type Database from "better-sqlite3";
import { createId, createReferenceId } from "@/server/lib/ids";

type Db = Database.Database;

export interface PayoutInput {
  adminId: string;
  tournamentId: string;
  userId: string;
  placement: number | null;
  kills: number;
  prizeAmount: number;
  now: string;
}

/** Stats, wallet credit (winningBalance only), ledger row and notification for one verified result. */
export function applyPayout(db: Db, p: PayoutInput): void {
  db.prepare(
    `UPDATE PlayerStats SET matchesPlayed = matchesPlayed + 1, kills = kills + ?,
     wins = wins + ?, losses = losses + ?, totalEarnings = totalEarnings + ?, updatedAt = ? WHERE userId = ?`
  ).run(p.kills, p.prizeAmount > 0 ? 1 : 0, p.prizeAmount > 0 ? 0 : 1, p.prizeAmount, p.now, p.userId);

  if (p.prizeAmount > 0) {
    db.prepare("UPDATE Wallet SET winningBalance = winningBalance + ?, updatedAt = ? WHERE userId = ?").run(p.prizeAmount, p.now, p.userId);
    const w = db.prepare("SELECT depositBalance, winningBalance, bonusBalance FROM Wallet WHERE userId = ?").get(p.userId) as {
      depositBalance: number; winningBalance: number; bonusBalance: number;
    };
    db.prepare(
      `INSERT INTO "Transaction" (id, userId, type, status, amount, balanceAfter, referenceId, description, metadata, createdAt)
       VALUES (?, ?, 'TOURNAMENT_PRIZE', 'COMPLETED', ?, ?, ?, ?, ?, ?)`
    ).run(
      createId("txn"), p.userId, p.prizeAmount, w.depositBalance + w.winningBalance + w.bonusBalance, createReferenceId("PRZ"),
      p.placement ? `Prize for placement #${p.placement}${p.kills ? ` + ${p.kills} kills` : ""}` : `Prize for ${p.kills} kills`,
      JSON.stringify({ tournamentId: p.tournamentId, placement: p.placement, kills: p.kills }), p.now
    );
    db.prepare(`INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, 'WINNER_ANNOUNCEMENT', ?, ?, ?, ?)`).run(
      createId("notif"), p.userId, "You won! 🏆",
      `Congratulations! You placed #${p.placement ?? "-"} with ${p.kills} kills and won ₹${p.prizeAmount / 100}.`,
      JSON.stringify({ tournamentId: p.tournamentId }), p.now
    );
  } else {
    db.prepare(`INSERT INTO Notification (id, userId, type, title, body, data, createdAt) VALUES (?, ?, 'RESULT_PUBLISHED', ?, ?, ?, ?)`).run(
      createId("notif"), p.userId, "Result published",
      `You placed #${p.placement ?? "-"} with ${p.kills} kills. Better luck next time!`,
      JSON.stringify({ tournamentId: p.tournamentId }), p.now
    );
  }
}

export interface SettleRow {
  participantId: string;
  placement: number;
  kills: number;
}

export interface SettleOutcome {
  paidPaise: number;
  winners: number;
  rows: { participantId: string; userId: string; placement: number; kills: number; prizePaise: number }[];
}

/**
 * One-shot result entry: records every player's placement and kills, pays the prize
 * (placement prize + kills x per-kill reward) and completes the tournament, all or nothing.
 * Squad modes: players sharing a team and placement split that placement's prize equally.
 */
export function settleTournament(db: Db, o: { tournamentId: string; adminId: string; rows: SettleRow[]; killRewardPaise: number; now: string }): SettleOutcome {
  return db.transaction(() => {
    const t = db.prepare("SELECT id, status, prizeDistribution, roomSize FROM Tournament WHERE id = ?").get(o.tournamentId) as
      | { id: string; status: string; prizeDistribution: string; roomSize: number } | undefined;
    if (!t) throw new Error("NOT_FOUND");
    if (["DRAFT", "CANCELLED"].includes(t.status)) throw new Error("NOT_SETTLEABLE");
    if (t.status === "COMPLETED") throw new Error("ALREADY_COMPLETED");
    if (o.rows.length === 0) throw new Error("NO_ROWS");

    const parts = db.prepare("SELECT id, userId, slotNumber, teamId, teamName FROM TournamentParticipant WHERE tournamentId = ?").all(o.tournamentId) as
      { id: string; userId: string; slotNumber: number | null; teamId: string | null; teamName: string | null }[];
    const byId = new Map(parts.map((p) => [p.id, p]));
    const seen = new Set<string>();
    for (const r of o.rows) {
      if (!byId.has(r.participantId)) throw new Error("UNKNOWN_PARTICIPANT");
      if (seen.has(r.participantId)) throw new Error("DUPLICATE_PARTICIPANT");
      seen.add(r.participantId);
    }

    const table = JSON.parse(t.prizeDistribution) as { position: number; amount: number }[];
    const teamKey = (p: (typeof parts)[number]) => (t.roomSize > 1 ? (p.teamId ?? (p.slotNumber !== null ? `slot${p.slotNumber}` : p.teamName ?? p.id)) : p.id);
    const sharers = new Map<string, number>();
    for (const r of o.rows) {
      const k = `${r.placement}|${teamKey(byId.get(r.participantId)!)}`;
      sharers.set(k, (sharers.get(k) ?? 0) + 1);
    }

    let match = db.prepare("SELECT id FROM Match WHERE tournamentId = ? ORDER BY round LIMIT 1").get(o.tournamentId) as { id: string } | undefined;
    if (!match) {
      match = { id: createId("match") };
      db.prepare("INSERT INTO Match (id, tournamentId, round, status, createdAt, updatedAt) VALUES (?, ?, 1, 'SCHEDULED', ?, ?)").run(match.id, o.tournamentId, o.now, o.now);
    }
    if (db.prepare("SELECT 1 FROM MatchResult WHERE matchId = ? AND verifiedAt IS NOT NULL LIMIT 1").get(match.id)) throw new Error("ALREADY_COMPLETED");
    // Replace any pending (unverified) player-submitted results with the admin's authoritative table.
    db.prepare("DELETE FROM MatchResult WHERE matchId = ? AND verifiedAt IS NULL").run(match.id);

    const out: SettleOutcome = { paidPaise: 0, winners: 0, rows: [] };
    for (const r of o.rows) {
      const p = byId.get(r.participantId)!;
      const placementPrize = table.find((x) => x.position === r.placement)?.amount ?? 0;
      const share = Math.floor(placementPrize / (sharers.get(`${r.placement}|${teamKey(p)}`) ?? 1));
      const prize = share + r.kills * o.killRewardPaise;

      db.prepare("INSERT INTO MatchResult (id, matchId, userId, placement, kills, submittedAt, verifiedByAdminId, verifiedAt) VALUES (?, ?, ?, ?, ?, ?, ?, ?)")
        .run(createId("mres"), match.id, p.userId, r.placement, r.kills, o.now, o.adminId, o.now);
      applyPayout(db, { adminId: o.adminId, tournamentId: o.tournamentId, userId: p.userId, placement: r.placement, kills: r.kills, prizeAmount: prize, now: o.now });
      out.rows.push({ participantId: p.id, userId: p.userId, placement: r.placement, kills: r.kills, prizePaise: prize });
      out.paidPaise += prize;
      if (prize > 0) out.winners++;
    }

    db.prepare("UPDATE Match SET status = 'RESULT_VERIFIED', updatedAt = ? WHERE id = ?").run(o.now, match.id);
    db.prepare("UPDATE Tournament SET status = 'COMPLETED', matchEndsAt = COALESCE(matchEndsAt, ?), updatedAt = ? WHERE id = ?").run(o.now, o.now, o.tournamentId);
    return out;
  })();
}
