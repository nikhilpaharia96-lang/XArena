"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Game } from "@/hooks/use-tournaments";
import { GameTypeIcon } from "./game-icon";
import { FREE_FIRE_GAME_SLUG, FREE_FIRE_ROUTE } from "@/lib/free-fire-categories";

/** Deterministic accent per game (hash of id) so any game without poster
 * artwork still reads as a varied roster instead of one repeated color. */
const ACCENTS = [
  "from-violet to-cobalt",
  "from-gold to-[#EA580C]",
  "from-[#7C3AED] to-violet",
  "from-crimson to-[#EA580C]",
];

function accentFor(id: string) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % ACCENTS.length;
  return ACCENTS[hash];
}

/** Static poster artwork per game slug. Falls back to game.bannerUrl (from
 * the DB) and finally to a plain gradient + icon when neither is set.
 * Exported so other homepage cards (Featured/Trending) can show the same
 * real artwork instead of a plain gradient. */
export const GAME_POSTERS: Record<string, string> = {
  "free-fire-max": "/games/free-fire-max.jpg",
  "bgmi": "/games/bgmi.jpg",
  "pubg-mobile": "/games/pubg-mobile.jpg",
  "cod-mobile": "/games/cod-mobile.jpg",
  "valorant": "/games/valorant.jpg",
  "efootball": "/games/efootball.jpg",
  "cricket-league": "/games/cricket-league.jpg",
};

export function posterForGame(gameSlug: string, bannerUrl?: string | null) {
  return GAME_POSTERS[gameSlug] ?? bannerUrl ?? null;
}

export function GameCard({ game, tournamentCount }: { game: Game; tournamentCount?: number }) {
  const poster = GAME_POSTERS[game.slug] ?? game.bannerUrl ?? null;

  return (
    <Link
      href={game.slug === FREE_FIRE_GAME_SLUG ? FREE_FIRE_ROUTE : `/tournaments?game=${game.slug}`}
      className="shrink-0 w-[130px]"
      aria-label={`${game.name} tournaments`}
    >
      <motion.div whileTap={{ scale: 0.96 }} className="relative h-[180px] rounded-2xl overflow-hidden border border-white/8">
        {poster ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={poster} alt="" className="absolute inset-0 h-full w-full object-cover" />
        ) : (
          <>
            <div className={`absolute inset-0 bg-gradient-to-br ${accentFor(game.id)}`} />
            <div className="relative h-full flex items-center justify-center">
              {game.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={game.iconUrl} alt="" className="h-11 w-11 rounded-xl object-cover shadow-lg" />
              ) : (
                <div className="h-11 w-11 rounded-xl bg-black/25 border border-white/20 flex items-center justify-center">
                  <GameTypeIcon slugOrName={game.slug || game.name} className="h-5 w-5 text-white" />
                </div>
              )}
            </div>
          </>
        )}
        <div className="absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-black/85 to-transparent" />
      </motion.div>
      <p className="mt-2 text-[13px] font-bold text-white leading-tight line-clamp-1 text-center">
        {game.shortName ?? game.name}
      </p>
      {typeof tournamentCount === "number" && (
        <p className="text-[10px] text-gold font-semibold text-center mt-0.5">{tournamentCount}+ Tournaments</p>
      )}
    </Link>
  );
}
