import { z } from "zod";
import { ApiError, ok } from "@/server/lib/api-response";
import { getCurrentUser } from "@/server/lib/current-user";
import { checkRateLimit } from "@/server/lib/rate-limit";
import { gameService } from "@/server/games/service.instance";
import { failGame } from "@/server/games/http";
import { GAME_KEYS } from "@/server/games/math";

export const dynamic = "force-dynamic";

const requestId = z.string().min(8).max(64).regex(/^[A-Za-z0-9_-]+$/).optional();
const bet = z.number().int().positive();

const dice = z.object({ bet, direction: z.enum(["UNDER", "OVER"]), chanceBps: z.number().int(), requestId }).strict();
const coin = z.object({ bet, pick: z.enum(["HEADS", "TAILS"]), requestId }).strict();
const slot = z.object({ bet, requestId }).strict();
const slotDemo = z.object({ bet }).strict();
const minesStart = z.object({ bet, mines: z.number().int(), requestId }).strict();
const minesReveal = z.object({ tile: z.number().int().min(0).max(24) }).strict();
const crashStart = z.object({ bet, autoCashoutBps: z.number().int().optional(), requestId }).strict();
const rotate = z.object({ clientSeed: z.string().max(64).optional() }).strict();

const json = async (req: Request) => (await req.json().catch(() => ({}))) as unknown;

function respond<T>(data: T) {
  const res = ok(data);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

/**
 * Player-facing API for XArena Originals. Identity ALWAYS comes from the session
 * cookie; the client never sends a user id, a result, or a multiplier it "won".
 *
 *   GET  /api/originals                 games + limits + fairness info + balance
 *   GET  /api/originals/history         my recent rounds
 *   GET  /api/originals/fair            my seed info + revealed seeds
 *   POST /api/originals/fair/rotate     reveal old server seed, start a new one
 *   POST /api/originals/dice | coin | slot     POST slot/demo (virtual credits, no wallet)
 *   POST /api/originals/mines/start | mines/reveal | mines/cashout
 *   GET  /api/originals/mines/active    my open mines round (resume after refresh)
 *   POST /api/originals/crash/start | crash/cashout    GET crash/state
 */
async function route(req: Request, ctx: { params: Promise<{ path?: string[] }> }) {
  try {
    const user = await getCurrentUser();
    const { path } = await ctx.params;
    const key = (path ?? []).join("/") || "games";
    const method = req.method;

    const limit = method === "GET" ? 120 : 60;
    if (!checkRateLimit(`orig:${method}:${user.id}`, limit, 60_000).allowed) {
      throw new ApiError(429, "Too many requests. Please slow down.", "RATE_LIMITED");
    }
    const uid = user.id;

    if (method === "GET") {
      switch (key) {
        case "games": {
          const games = gameService
            .listConfigs()
            .filter((c) => c.isEnabled)
            .map(({ gameKey, houseEdgeBps, minBet, maxBet, maxPayout }) => ({ gameKey, houseEdgeBps, minBet, maxBet, maxPayout }));
          return respond({ games, fair: gameService.getFairInfo(uid), keys: GAME_KEYS });
        }
        case "history":
          return respond({ rounds: gameService.history(uid, 30) });
        case "fair":
          return respond({ current: gameService.getFairInfo(uid), revealed: gameService.revealedSeeds(uid) });
        case "crash/state":
          return respond({ round: gameService.crashState(uid) });
        case "mines/active":
          return respond({ round: gameService.activeMines(uid) });
      }
    } else if (method === "POST") {
      switch (key) {
        case "dice":
          return respond(gameService.playDice({ userId: uid, ...dice.parse(await json(req)) }));
        case "slot":
          return respond(gameService.playSlot({ userId: uid, ...slot.parse(await json(req)) }));
        case "slot/demo":
          return respond(gameService.demoSlot(slotDemo.parse(await json(req)).bet));
        case "coin":
          return respond(gameService.playCoin({ userId: uid, ...coin.parse(await json(req)) }));
        case "mines/start":
          return respond(gameService.startMines({ userId: uid, ...minesStart.parse(await json(req)) }));
        case "mines/reveal":
          return respond(gameService.revealMine({ userId: uid, ...minesReveal.parse(await json(req)) }));
        case "mines/cashout":
          return respond(gameService.cashoutMines(uid));
        case "crash/start":
          return respond(gameService.startCrash({ userId: uid, ...crashStart.parse(await json(req)) }));
        case "crash/cashout":
          return respond(gameService.cashoutCrash(uid));
        case "fair/rotate":
          return respond(gameService.rotateSeed(uid, rotate.parse(await json(req)).clientSeed));
      }
    }
    throw new ApiError(404, "Not found.", "NOT_FOUND");
  } catch (error) {
    return failGame(error);
  }
}

export { route as GET, route as POST };
