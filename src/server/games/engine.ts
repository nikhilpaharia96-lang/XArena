import type Database from "better-sqlite3";
import { createId } from "@/server/lib/ids";
import type { BucketSplit } from "@/server/providers/provider-wallet";
import { GameError } from "./errors";
import { randomInt } from "node:crypto";
import { floatStream, hashSeed, newClientSeed, newServerSeed } from "./fair";
import { playSlot as rollSlot, unitsToPaise, type SlotOutcome } from "./slot-math";
import { creditPayout, currentBalance, debitStake } from "./game-wallet";
import {
  BPS,
  CRASH_MIN_AUTO_BPS,
  DICE_MAX_CHANCE_BPS,
  DICE_MIN_CHANCE_BPS,
  GAME_KEYS,
  MINES_MAX,
  MINES_MIN,
  MINES_TILES,
  coinFlip,
  coinMultiplierBps,
  crashMultiplierAt,
  crashPointBps,
  crashTimeFor,
  diceMultiplierBps,
  diceRoll,
  diceWins,
  minePositions,
  minesMultiplierBps,
  payoutFor,
  type CoinSide,
  type DiceDirection,
  type GameKey,
} from "./math";

export interface GameConfigRow {
  gameKey: GameKey;
  isEnabled: boolean;
  houseEdgeBps: number;
  minBet: number;
  maxBet: number;
  maxPayout: number;
  updatedAt: string;
}

interface RoundRow {
  id: string;
  userId: string;
  gameKey: GameKey;
  status: "ACTIVE" | "WON" | "LOST" | "VOID";
  betAmount: number;
  payoutAmount: number;
  multiplierBps: number;
  houseEdgeBps: number;
  debit: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  params: string;
  state: string | null;
  result: string | null;
  requestId: string | null;
  createdAt: string;
  settledAt: string | null;
}

export interface RoundView {
  id: string;
  game: GameKey;
  status: RoundRow["status"];
  bet: number;
  payout: number;
  multiplierBps: number;
  houseEdgeBps: number;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
  params: Record<string, unknown>;
  result: Record<string, unknown> | null;
  createdAt: string;
  settledAt: string | null;
  /** Only while ACTIVE (mines / crash). Never contains hidden state. */
  live: Record<string, unknown> | null;
  balance: number;
  replayed?: boolean;
}

interface Fair {
  serverSeed: string;
  serverSeedHash: string;
  clientSeed: string;
  nonce: number;
}

interface MinesState {
  mines: number[];
  revealed: number[];
  capPayout: number;
}

interface CrashState {
  crashBps: number;
  startedAtMs: number;
  /** player's auto cash-out, if any */
  autoBps: number | null;
  /** hard ceiling from the table's max payout, expressed as a multiplier */
  capBps: number;
}

const UNIQUE = "UNIQUE constraint failed";

export function createGameService(db: Database.Database, opts: { now?: () => number } = {}) {
  const now = opts.now ?? Date.now;
  const nowIso = () => new Date(now()).toISOString();

  const tx = <T>(fn: () => T): T => db.transaction(fn).immediate();

  // ------------------------------------------------------------ config ----
  function getConfig(game: GameKey): GameConfigRow {
    const r = db.prepare("SELECT * FROM GameConfig WHERE gameKey = ?").get(game) as (Omit<GameConfigRow, "isEnabled"> & { isEnabled: number }) | undefined;
    if (!r) throw new GameError("GAME_DISABLED", "This game is not available.");
    return { ...r, isEnabled: r.isEnabled === 1 };
  }

  function listConfigs(): GameConfigRow[] {
    return GAME_KEYS.map((k) => getConfig(k));
  }

  function requirePlayable(game: GameKey, stake: number): GameConfigRow {
    const cfg = getConfig(game);
    if (!cfg.isEnabled) throw new GameError("GAME_DISABLED", "This game is currently unavailable.");
    if (!Number.isSafeInteger(stake) || stake <= 0) throw new GameError("INVALID_INPUT", "Enter a valid bet amount.");
    if (stake < cfg.minBet) throw new GameError("BET_TOO_LOW", "Bet is below the minimum for this game.");
    if (stake > cfg.maxBet) throw new GameError("BET_TOO_HIGH", "Bet is above the maximum for this game.");
    return cfg;
  }

  function updateConfig(
    game: GameKey,
    patch: Partial<Pick<GameConfigRow, "isEnabled" | "houseEdgeBps" | "minBet" | "maxBet" | "maxPayout">>
  ): GameConfigRow {
    return tx(() => {
      const cur = getConfig(game);
      const next = { ...cur, ...patch };
      const ints = [next.houseEdgeBps, next.minBet, next.maxBet, next.maxPayout];
      if (!ints.every(Number.isSafeInteger)) throw new GameError("INVALID_INPUT", "Values must be whole numbers.");
      if (next.houseEdgeBps < 50 || next.houseEdgeBps > 1500) throw new GameError("INVALID_INPUT", "House edge must be between 0.5% and 15%.");
      if (next.minBet < 100) throw new GameError("INVALID_INPUT", "Minimum bet cannot be below ₹1.");
      if (next.maxBet < next.minBet) throw new GameError("INVALID_INPUT", "Max bet must be at least the min bet.");
      if (next.maxPayout <= next.maxBet) throw new GameError("INVALID_INPUT", "Max payout must be larger than the max bet.");
      db.prepare("UPDATE GameConfig SET isEnabled = ?, houseEdgeBps = ?, minBet = ?, maxBet = ?, maxPayout = ?, updatedAt = ? WHERE gameKey = ?").run(
        next.isEnabled ? 1 : 0,
        next.houseEdgeBps,
        next.minBet,
        next.maxBet,
        next.maxPayout,
        nowIso(),
        game
      );
      return getConfig(game);
    });
  }

  // ------------------------------------------------------------- seeds ----
  function ensureSeed(userId: string) {
    const serverSeed = newServerSeed();
    db.prepare("INSERT OR IGNORE INTO FairSeed (userId, serverSeed, serverSeedHash, clientSeed, nonce, updatedAt) VALUES (?, ?, ?, ?, 0, ?)").run(
      userId,
      serverSeed,
      hashSeed(serverSeed),
      newClientSeed(),
      nowIso()
    );
  }

  /** Reserve the next nonce for this player. Must be called inside the round's transaction. */
  function takeFair(userId: string): Fair {
    ensureSeed(userId);
    const s = db.prepare("SELECT serverSeed, serverSeedHash, clientSeed, nonce FROM FairSeed WHERE userId = ?").get(userId) as Fair;
    db.prepare("UPDATE FairSeed SET nonce = nonce + 1, updatedAt = ? WHERE userId = ?").run(nowIso(), userId);
    return s;
  }

  function getFairInfo(userId: string) {
    ensureSeed(userId);
    const s = db.prepare("SELECT serverSeedHash, clientSeed, nonce FROM FairSeed WHERE userId = ?").get(userId) as { serverSeedHash: string; clientSeed: string; nonce: number };
    return s;
  }

  function rotateSeed(userId: string, clientSeed?: string) {
    if (clientSeed !== undefined && !/^[A-Za-z0-9_-]{1,64}$/.test(clientSeed)) {
      throw new GameError("INVALID_INPUT", "Client seed may contain letters, numbers, - and _ (max 64).");
    }
    return tx(() => {
      ensureSeed(userId);
      const open = db.prepare("SELECT 1 FROM GameRound WHERE userId = ? AND status = 'ACTIVE' LIMIT 1").get(userId);
      if (open) throw new GameError("SEED_LOCKED", "Finish your open round before changing seeds.");
      const old = db.prepare("SELECT serverSeed, serverSeedHash, clientSeed, nonce FROM FairSeed WHERE userId = ?").get(userId) as Fair;
      db.prepare(
        "INSERT INTO FairSeedHistory (id, userId, serverSeed, serverSeedHash, clientSeed, roundsPlayed, revealedAt) VALUES (?, ?, ?, ?, ?, ?, ?)"
      ).run(createId("fsh"), userId, old.serverSeed, old.serverSeedHash, old.clientSeed, old.nonce, nowIso());
      const fresh = newServerSeed();
      db.prepare("UPDATE FairSeed SET serverSeed = ?, serverSeedHash = ?, clientSeed = ?, nonce = 0, updatedAt = ? WHERE userId = ?").run(
        fresh,
        hashSeed(fresh),
        clientSeed ?? newClientSeed(),
        nowIso(),
        userId
      );
      return {
        revealed: { serverSeed: old.serverSeed, serverSeedHash: old.serverSeedHash, clientSeed: old.clientSeed, roundsPlayed: old.nonce },
        current: getFairInfo(userId),
      };
    });
  }

  function revealedSeeds(userId: string) {
    return db
      .prepare("SELECT serverSeed, serverSeedHash, clientSeed, roundsPlayed, revealedAt FROM FairSeedHistory WHERE userId = ? ORDER BY revealedAt DESC LIMIT 50")
      .all(userId);
  }

  // ------------------------------------------------------------ rounds ----
  const parse = <T>(s: string | null): T | null => (s ? (JSON.parse(s) as T) : null);

  function liveFor(row: RoundRow): Record<string, unknown> | null {
    if (row.status !== "ACTIVE") return null;
    if (row.gameKey === "MINES") {
      const st = parse<MinesState>(row.state)!;
      const params = parse<{ mines: number }>(row.params)!;
      const k = st.revealed.length;
      const cur = k > 0 ? minesMultiplierBps(params.mines, k, row.houseEdgeBps) : 0;
      return {
        mines: params.mines,
        revealed: st.revealed,
        currentMultiplierBps: cur,
        currentPayout: k > 0 ? Math.min(payoutFor(row.betAmount, cur), st.capPayout) : 0,
        nextMultiplierBps: minesMultiplierBps(params.mines, k + 1, row.houseEdgeBps),
        capPayout: st.capPayout,
      };
    }
    if (row.gameKey === "CRASH") {
      const st = parse<CrashState>(row.state)!;
      return { startedAtMs: st.startedAtMs, serverNowMs: now(), autoCashoutBps: st.autoBps, capMultiplierBps: st.capBps };
    }
    return null;
  }

  function toView(row: RoundRow, replayed = false): RoundView {
    const view: RoundView = {
      id: row.id,
      game: row.gameKey,
      status: row.status,
      bet: row.betAmount,
      payout: row.payoutAmount,
      multiplierBps: row.multiplierBps,
      houseEdgeBps: row.houseEdgeBps,
      serverSeedHash: row.serverSeedHash,
      clientSeed: row.clientSeed,
      nonce: row.nonce,
      params: parse(row.params) ?? {},
      result: parse(row.result),
      createdAt: row.createdAt,
      settledAt: row.settledAt,
      live: liveFor(row),
      balance: currentBalance(db, row.userId),
    };
    if (replayed) view.replayed = true;
    return view;
  }

  const getRow = (id: string) => db.prepare("SELECT * FROM GameRound WHERE id = ?").get(id) as RoundRow | undefined;

  function findByRequest(userId: string, requestId: string | undefined): RoundRow | undefined {
    if (!requestId) return undefined;
    return db.prepare("SELECT * FROM GameRound WHERE userId = ? AND requestId = ?").get(userId, requestId) as RoundRow | undefined;
  }

  function insertRound(r: Omit<RoundRow, "payoutAmount" | "multiplierBps" | "settledAt" | "result" | "createdAt"> & Partial<Pick<RoundRow, "payoutAmount" | "multiplierBps" | "settledAt" | "result">>) {
    const ts = nowIso();
    db.prepare(
      `INSERT INTO GameRound (id, userId, gameKey, status, betAmount, payoutAmount, multiplierBps, houseEdgeBps, debit, serverSeedHash, clientSeed, nonce, params, state, result, requestId, createdAt, settledAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      r.id, r.userId, r.gameKey, r.status, r.betAmount, r.payoutAmount ?? 0, r.multiplierBps ?? 0, r.houseEdgeBps, r.debit,
      r.serverSeedHash, r.clientSeed, r.nonce, r.params, r.state, r.result ?? null, r.requestId, ts, r.settledAt ?? null
    );
  }

  /** Close an ACTIVE round exactly once. */
  function settle(row: RoundRow, status: "WON" | "LOST", payout: number, multBps: number, result: Record<string, unknown>, state?: unknown) {
    const ts = nowIso();
    const res = db
      .prepare("UPDATE GameRound SET status = ?, payoutAmount = ?, multiplierBps = ?, result = ?, state = COALESCE(?, state), settledAt = ? WHERE id = ? AND status = 'ACTIVE'")
      .run(status, payout, multBps, JSON.stringify(result), state === undefined ? null : JSON.stringify(state), ts, row.id);
    if (res.changes !== 1) throw new GameError("NO_ACTIVE_ROUND", "This round is already finished.");
    if (status === "WON" && payout > 0) {
      creditPayout(db, {
        userId: row.userId, roundId: row.id, gameKey: row.gameKey, stake: row.betAmount, payout,
        debit: JSON.parse(row.debit) as BucketSplit, nowIso: ts,
      });
    }
    return getRow(row.id)!;
  }

  const guard = <T>(fn: () => T): T => {
    try {
      return fn();
    } catch (e) {
      if (e instanceof Error && e.message.includes(UNIQUE)) {
        if (e.message.includes("GameRound.userId, GameRound.gameKey")) throw new GameError("ROUND_ACTIVE", "Finish your current round first.");
        if (e.message.includes("GameRound.userId, GameRound.requestId")) throw new GameError("INVALID_INPUT", "Duplicate request.");
      }
      throw e;
    }
  };

  // ---------------------------------------------------- instant games -----
  interface Prepared {
    cfg: GameConfigRow;
    fair: Fair;
    roundId: string;
    debit: BucketSplit;
  }

  function prepare(userId: string, game: GameKey, stake: number, maxMultBps: number): Prepared {
    const cfg = requirePlayable(game, stake);
    if (payoutFor(stake, maxMultBps) > cfg.maxPayout) {
      throw new GameError("PAYOUT_TOO_HIGH", "Potential payout is above the table limit. Lower your bet or pick safer odds.");
    }
    const roundId = createId("rnd");
    const fair = takeFair(userId);
    const { debit } = debitStake(db, { userId, roundId, gameKey: game, stake, nowIso: nowIso() });
    return { cfg, fair, roundId, debit };
  }

  function playDice(input: { userId: string; bet: number; direction: DiceDirection; chanceBps: number; requestId?: string }): RoundView {
    if (input.direction !== "UNDER" && input.direction !== "OVER") throw new GameError("INVALID_INPUT", "Direction must be UNDER or OVER.");
    if (!Number.isSafeInteger(input.chanceBps) || input.chanceBps < DICE_MIN_CHANCE_BPS || input.chanceBps > DICE_MAX_CHANCE_BPS) {
      throw new GameError("INVALID_INPUT", "Win chance must be between 1% and 95%.");
    }
    return guard(() =>
      tx(() => {
        const dup = findByRequest(input.userId, input.requestId);
        if (dup) return toView(dup, true);
        const cfg = getConfig("DICE");
        const mult = diceMultiplierBps(input.chanceBps, cfg.houseEdgeBps);
        const p = prepare(input.userId, "DICE", input.bet, mult);
        const roll = diceRoll(floatStream(p.fair.serverSeed, p.fair.clientSeed, p.fair.nonce)());
        const win = diceWins(roll, input.direction, input.chanceBps);
        const payout = win ? payoutFor(input.bet, mult) : 0;
        insertRound({
          id: p.roundId, userId: input.userId, gameKey: "DICE", status: "ACTIVE", betAmount: input.bet, houseEdgeBps: p.cfg.houseEdgeBps,
          debit: JSON.stringify(p.debit), serverSeedHash: p.fair.serverSeedHash, clientSeed: p.fair.clientSeed, nonce: p.fair.nonce,
          params: JSON.stringify({ direction: input.direction, chanceBps: input.chanceBps }), state: null, requestId: input.requestId ?? null,
        });
        const row = settle(getRow(p.roundId)!, win ? "WON" : "LOST", payout, win ? mult : 0, { roll, win, targetMultiplierBps: mult });
        return toView(row);
      })
    );
  }

  function playCoin(input: { userId: string; bet: number; pick: CoinSide; requestId?: string }): RoundView {
    if (input.pick !== "HEADS" && input.pick !== "TAILS") throw new GameError("INVALID_INPUT", "Pick HEADS or TAILS.");
    return guard(() =>
      tx(() => {
        const dup = findByRequest(input.userId, input.requestId);
        if (dup) return toView(dup, true);
        const cfg = getConfig("COINFLIP");
        const mult = coinMultiplierBps(cfg.houseEdgeBps);
        const p = prepare(input.userId, "COINFLIP", input.bet, mult);
        const side = coinFlip(floatStream(p.fair.serverSeed, p.fair.clientSeed, p.fair.nonce)());
        const win = side === input.pick;
        insertRound({
          id: p.roundId, userId: input.userId, gameKey: "COINFLIP", status: "ACTIVE", betAmount: input.bet, houseEdgeBps: p.cfg.houseEdgeBps,
          debit: JSON.stringify(p.debit), serverSeedHash: p.fair.serverSeedHash, clientSeed: p.fair.clientSeed, nonce: p.fair.nonce,
          params: JSON.stringify({ pick: input.pick }), state: null, requestId: input.requestId ?? null,
        });
        const row = settle(getRow(p.roundId)!, win ? "WON" : "LOST", win ? payoutFor(input.bet, mult) : 0, win ? mult : 0, { side, win });
        return toView(row);
      })
    );
  }

  // -------------------------------------------------------------- mines ----
  function startMines(input: { userId: string; bet: number; mines: number; requestId?: string }): RoundView {
    if (!Number.isInteger(input.mines) || input.mines < MINES_MIN || input.mines > MINES_MAX) {
      throw new GameError("INVALID_INPUT", `Mines must be between ${MINES_MIN} and ${MINES_MAX}.`);
    }
    return guard(() =>
      tx(() => {
        const dup = findByRequest(input.userId, input.requestId);
        if (dup) return toView(dup, true);
        const cfg = getConfig("MINES");
        const open = db.prepare("SELECT 1 FROM GameRound WHERE userId = ? AND gameKey = 'MINES' AND status = 'ACTIVE'").get(input.userId);
        if (open) throw new GameError("ROUND_ACTIVE", "Finish your current round first.");
        // Payout is capped per round, so the only requirement is that the bet itself can ever pay something.
        if (input.bet >= cfg.maxPayout) throw new GameError("BET_TOO_HIGH", "Bet is above the maximum for this game.");
        const p = prepare(input.userId, "MINES", input.bet, BPS);
        const layout = minePositions(floatStream(p.fair.serverSeed, p.fair.clientSeed, p.fair.nonce), input.mines);
        const state: MinesState = { mines: layout, revealed: [], capPayout: p.cfg.maxPayout };
        insertRound({
          id: p.roundId, userId: input.userId, gameKey: "MINES", status: "ACTIVE", betAmount: input.bet, houseEdgeBps: p.cfg.houseEdgeBps,
          debit: JSON.stringify(p.debit), serverSeedHash: p.fair.serverSeedHash, clientSeed: p.fair.clientSeed, nonce: p.fair.nonce,
          params: JSON.stringify({ mines: input.mines }), state: JSON.stringify(state), requestId: input.requestId ?? null,
        });
        return toView(getRow(p.roundId)!);
      })
    );
  }

  function activeRound(userId: string, game: GameKey): RoundRow {
    const row = db.prepare("SELECT * FROM GameRound WHERE userId = ? AND gameKey = ? AND status = 'ACTIVE'").get(userId, game) as RoundRow | undefined;
    if (!row) throw new GameError("NO_ACTIVE_ROUND", "You have no open round.");
    return row;
  }

  /** Open mines round (if any), so the UI can resume after a refresh. */
  function activeMines(userId: string): RoundView | null {
    const row = db.prepare("SELECT * FROM GameRound WHERE userId = ? AND gameKey = 'MINES' AND status = 'ACTIVE'").get(userId) as RoundRow | undefined;
    return row ? toView(row) : null;
  }

  function revealMine(input: { userId: string; tile: number }): RoundView {
    if (!Number.isInteger(input.tile) || input.tile < 0 || input.tile >= MINES_TILES) throw new GameError("INVALID_INPUT", "Invalid tile.");
    return tx(() => {
      const row = activeRound(input.userId, "MINES");
      const st = parse<MinesState>(row.state)!;
      const { mines } = parse<{ mines: number }>(row.params)!;
      if (st.revealed.includes(input.tile)) throw new GameError("INVALID_INPUT", "That tile is already open.");

      if (st.mines.includes(input.tile)) {
        return toView(settle(row, "LOST", 0, 0, { hit: input.tile, mines: st.mines, revealed: st.revealed }));
      }
      st.revealed.push(input.tile);
      const k = st.revealed.length;
      const mult = minesMultiplierBps(mines, k, row.houseEdgeBps);
      const payout = Math.min(payoutFor(row.betAmount, mult), st.capPayout);
      const cleared = k === MINES_TILES - mines;
      if (cleared || payout >= st.capPayout) {
        return toView(settle(row, "WON", payout, mult, { mines: st.mines, revealed: st.revealed, autoCashout: cleared ? "CLEARED" : "MAX_PAYOUT" }, st));
      }
      db.prepare("UPDATE GameRound SET state = ? WHERE id = ?").run(JSON.stringify(st), row.id);
      return toView(getRow(row.id)!);
    });
  }

  function cashoutMines(userId: string): RoundView {
    return tx(() => {
      const row = activeRound(userId, "MINES");
      const st = parse<MinesState>(row.state)!;
      const { mines } = parse<{ mines: number }>(row.params)!;
      const k = st.revealed.length;
      if (k < 1) throw new GameError("INVALID_INPUT", "Open at least one tile before cashing out.");
      const mult = minesMultiplierBps(mines, k, row.houseEdgeBps);
      const payout = Math.min(payoutFor(row.betAmount, mult), st.capPayout);
      return toView(settle(row, "WON", payout, mult, { mines: st.mines, revealed: st.revealed }));
    });
  }

  // --------------------------------------------------------------- slot ----
  /** Turns a raw outcome into the public result: per-spin wins in paise, total clamped to the table's max payout. */
  function slotResult(outcome: SlotOutcome, stake: number, edgeBps: number, maxPayout: number) {
    const steps = outcome.steps.map((st) => ({
      free: st.free,
      stops: st.stops,
      grid: st.grid,
      lineWins: st.lineWins,
      scatters: st.scatters,
      ascent: st.ascent,
      awarded: st.awarded,
      win: unitsToPaise(stake, st.units, edgeBps),
    }));
    const raw = steps.reduce((a, st) => a + st.win, 0);
    const payout = Math.min(raw, maxPayout);
    return { steps, payout, capped: raw > maxPayout, freeSpins: outcome.freeSpinsTriggered };
  }

  /** One paid spin; any free-spin round it triggers is played out in the SAME round, server-side. */
  function playSlot(input: { userId: string; bet: number; requestId?: string }): RoundView {
    return guard(() =>
      tx(() => {
        const dup = findByRequest(input.userId, input.requestId);
        if (dup) return toView(dup, true);
        const p = prepare(input.userId, "SLOT", input.bet, BPS);
        const outcome = rollSlot(floatStream(p.fair.serverSeed, p.fair.clientSeed, p.fair.nonce));
        const res = slotResult(outcome, input.bet, p.cfg.houseEdgeBps, p.cfg.maxPayout);
        insertRound({
          id: p.roundId, userId: input.userId, gameKey: "SLOT", status: "ACTIVE", betAmount: input.bet, houseEdgeBps: p.cfg.houseEdgeBps,
          debit: JSON.stringify(p.debit), serverSeedHash: p.fair.serverSeedHash, clientSeed: p.fair.clientSeed, nonce: p.fair.nonce,
          params: JSON.stringify({}), state: null, requestId: input.requestId ?? null,
        });
        const mult = res.payout > 0 ? Math.floor((res.payout * BPS) / input.bet) : 0;
        return toView(settle(getRow(p.roundId)!, res.payout > 0 ? "WON" : "LOST", res.payout, mult, res));
      })
    );
  }

  /** Virtual-credit practice spin: same maths and paytable, NO wallet, NO database writes. */
  function demoSlot(bet: number) {
    const cfg = getConfig("SLOT");
    if (!cfg.isEnabled) throw new GameError("GAME_DISABLED", "This game is currently unavailable.");
    if (!Number.isSafeInteger(bet) || bet <= 0) throw new GameError("INVALID_INPUT", "Enter a valid bet amount.");
    const next = () => randomInt(0, 2 ** 32) / 2 ** 32;
    return slotResult(rollSlot(next), bet, cfg.houseEdgeBps, Number.MAX_SAFE_INTEGER);
  }

  // -------------------------------------------------------------- crash ----
  function startCrash(input: { userId: string; bet: number; autoCashoutBps?: number; requestId?: string }): RoundView {
    if (input.autoCashoutBps !== undefined && (!Number.isInteger(input.autoCashoutBps) || input.autoCashoutBps < CRASH_MIN_AUTO_BPS || input.autoCashoutBps > 10_000_000)) {
      throw new GameError("INVALID_INPUT", "Auto cash-out must be between 1.01x and 1000x.");
    }
    return guard(() =>
      tx(() => {
        const dup = findByRequest(input.userId, input.requestId);
        if (dup) return toView(dup, true);
        sweepCrash(input.userId);
        const cfg = getConfig("CRASH");
        const open = db.prepare("SELECT 1 FROM GameRound WHERE userId = ? AND gameKey = 'CRASH' AND status = 'ACTIVE'").get(input.userId);
        if (open) throw new GameError("ROUND_ACTIVE", "Finish your current round first.");
        const capBps = Math.floor((cfg.maxPayout * BPS) / Math.max(1, input.bet));
        if (capBps <= BPS) throw new GameError("BET_TOO_HIGH", "Bet is above the maximum for this game.");
        const p = prepare(input.userId, "CRASH", input.bet, BPS);
        const crashBps = crashPointBps(floatStream(p.fair.serverSeed, p.fair.clientSeed, p.fair.nonce)(), p.cfg.houseEdgeBps);
        const state: CrashState = { crashBps, startedAtMs: now(), autoBps: input.autoCashoutBps ?? null, capBps };
        insertRound({
          id: p.roundId, userId: input.userId, gameKey: "CRASH", status: "ACTIVE", betAmount: input.bet, houseEdgeBps: p.cfg.houseEdgeBps,
          debit: JSON.stringify(p.debit), serverSeedHash: p.fair.serverSeedHash, clientSeed: p.fair.clientSeed, nonce: p.fair.nonce,
          params: JSON.stringify({ autoCashoutBps: input.autoCashoutBps ?? null }), state: JSON.stringify(state), requestId: input.requestId ?? null,
        });
        const row = resolveCrash(getRow(p.roundId)!);
        return toView(row);
      })
    );
  }

  /** Settles a crash round if (and only if) its outcome is already determined by elapsed server time. */
  function resolveCrash(row: RoundRow): RoundRow {
    if (row.status !== "ACTIVE") return row;
    const st = parse<CrashState>(row.state)!;
    const elapsed = now() - st.startedAtMs;
    const target = Math.min(st.autoBps ?? Infinity, st.capBps);
    if (target < st.crashBps) {
      // The player's target is reached before the crash.
      if (elapsed >= crashTimeFor(target)) {
        return settle(row, "WON", Math.min(payoutFor(row.betAmount, target), payoutCap(row)), target, { crashBps: st.crashBps, cashedOutBps: target, auto: true });
      }
      return row;
    }
    if (elapsed >= crashTimeFor(st.crashBps)) {
      return settle(row, "LOST", 0, 0, { crashBps: st.crashBps });
    }
    return row;
  }

  const payoutCap = (row: RoundRow) => {
    const st = parse<CrashState>(row.state)!;
    return payoutFor(row.betAmount, st.capBps);
  };

  /** Resolve every finished crash round (for one player, or all when userId is omitted). */
  function sweepCrash(userId?: string): number {
    const rows = (userId
      ? db.prepare("SELECT * FROM GameRound WHERE gameKey = 'CRASH' AND status = 'ACTIVE' AND userId = ?").all(userId)
      : db.prepare("SELECT * FROM GameRound WHERE gameKey = 'CRASH' AND status = 'ACTIVE'").all()) as RoundRow[];
    let n = 0;
    for (const r of rows) if (resolveCrash(r).status !== "ACTIVE") n++;
    return n;
  }

  function crashState(userId: string): RoundView | null {
    return tx(() => {
      const row = db.prepare("SELECT * FROM GameRound WHERE userId = ? AND gameKey = 'CRASH' AND status = 'ACTIVE'").get(userId) as RoundRow | undefined;
      if (!row) return null;
      return toView(resolveCrash(row));
    });
  }

  function cashoutCrash(userId: string): RoundView {
    return tx(() => {
      const row0 = activeRound(userId, "CRASH");
      const row = resolveCrash(row0);
      if (row.status !== "ACTIVE") return toView(row); // already decided by time (crashed, or auto cash-out hit)
      const st = parse<CrashState>(row.state)!;
      const elapsed = now() - st.startedAtMs;
      const m = Math.min(crashMultiplierAt(elapsed), Math.min(st.autoBps ?? Infinity, st.capBps));
      if (m >= st.crashBps) return toView(settle(row, "LOST", 0, 0, { crashBps: st.crashBps }));
      const payout = Math.min(payoutFor(row.betAmount, m), payoutCap(row));
      return toView(settle(row, "WON", payout, m, { crashBps: st.crashBps, cashedOutBps: m }));
    });
  }

  // ----------------------------------------------------------- history ----
  function history(userId: string, limit = 30): RoundView[] {
    tx(() => sweepCrash(userId));
    const rows = db.prepare("SELECT * FROM GameRound WHERE userId = ? ORDER BY createdAt DESC, rowid DESC LIMIT ?").all(userId, Math.min(100, limit)) as RoundRow[];
    return rows.map((r) => toView(r));
  }

  function getRound(userId: string, id: string) {
    const row = getRow(id);
    if (!row || row.userId !== userId) throw new GameError("NOT_FOUND", "Round not found.");
    const revealed = db.prepare("SELECT serverSeed FROM FairSeedHistory WHERE userId = ? AND serverSeedHash = ?").get(userId, row.serverSeedHash) as { serverSeed: string } | undefined;
    return { round: toView(row), serverSeed: revealed?.serverSeed ?? null };
  }

  // ------------------------------------------------------------- admin ----
  /** Refund an open round exactly (stake goes back to the buckets it came from). */
  function voidRound(roundId: string): RoundView {
    return tx(() => {
      const row = getRow(roundId);
      if (!row) throw new GameError("NOT_FOUND", "Round not found.");
      if (row.status !== "ACTIVE") throw new GameError("NO_ACTIVE_ROUND", "Only open rounds can be voided.");
      const ts = nowIso();
      const res = db
        .prepare("UPDATE GameRound SET status = 'VOID', payoutAmount = ?, multiplierBps = 0, result = ?, settledAt = ? WHERE id = ? AND status = 'ACTIVE'")
        .run(row.betAmount, JSON.stringify({ voided: true }), ts, row.id);
      if (res.changes !== 1) throw new GameError("NO_ACTIVE_ROUND", "Only open rounds can be voided.");
      creditPayout(db, {
        userId: row.userId, roundId: row.id, gameKey: row.gameKey, stake: row.betAmount, payout: row.betAmount,
        debit: JSON.parse(row.debit) as BucketSplit, nowIso: ts, kind: "REFUND",
      });
      return toView(getRow(row.id)!);
    });
  }

  function stats(sinceIso?: string) {
    tx(() => sweepCrash());
    const since = sinceIso ?? "1970-01-01T00:00:00.000Z";
    const per = db
      .prepare(
        `SELECT gameKey,
                COUNT(*) AS rounds,
                COALESCE(SUM(CASE WHEN status IN ('WON','LOST') THEN betAmount END), 0) AS wagered,
                COALESCE(SUM(CASE WHEN status IN ('WON','LOST') THEN payoutAmount END), 0) AS paidOut,
                SUM(CASE WHEN status = 'ACTIVE' THEN 1 ELSE 0 END) AS openRounds,
                COALESCE(SUM(CASE WHEN status = 'ACTIVE' THEN betAmount END), 0) AS openStake
         FROM GameRound WHERE createdAt >= ? GROUP BY gameKey`
      )
      .all(since) as { gameKey: GameKey; rounds: number; wagered: number; paidOut: number; openRounds: number; openStake: number }[];
    return per.map((r) => ({ ...r, ggr: r.wagered - r.paidOut }));
  }

  function recentRounds(limit = 50) {
    return db
      .prepare(
        `SELECT g.id, g.userId, u.username, g.gameKey, g.status, g.betAmount, g.payoutAmount, g.multiplierBps, g.createdAt, g.settledAt
         FROM GameRound g JOIN User u ON u.id = g.userId ORDER BY g.createdAt DESC, g.rowid DESC LIMIT ?`
      )
      .all(Math.min(200, limit));
  }

  return {
    listConfigs, getConfig, updateConfig,
    getFairInfo, rotateSeed, revealedSeeds,
    playDice, playCoin, playSlot, demoSlot,
    startMines, revealMine, cashoutMines, activeMines,
    startCrash, crashState, cashoutCrash, sweepCrash,
    history, getRound,
    voidRound, stats, recentRounds,
  };
}

export type GameService = ReturnType<typeof createGameService>;
