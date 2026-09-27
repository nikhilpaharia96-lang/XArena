"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import type { Game } from "@/hooks/use-tournaments";
import { GameTypeIcon } from "./game-icon";

/** Deterministic accent per game (hash of id) so the row reads as a varied
 * roster instead of one repeated color, without needing per-game artwork. */
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

export function GameCard({ game, tournamentCount }: { game: Game; tournamentCount?: number }) {
  return (
    <Link href={`/tournaments?game=${game.slug}`} className="shrink-0 w-[116px]" aria-label={`${game.name} tournaments`}>
      <motion.div whileTap={{ scale: 0.96 }} className="relative h-[136px] rounded-2xl overflow-hidden border border-white/8">
        <div className={`absolute inset-0 bg-gradient-to-br ${accentFor(game.id)}`} />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-black/30" />
        <div className="relative h-full flex flex-col items-center justify-center px-2">
          {game.iconUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={game.iconUrl} alt="" className="h-11 w-11 rounded-xl object-cover shadow-lg" />
          ) : (
            <div className="h-11 w-11 rounded-xl bg-black/25 border border-white/20 flex items-center justify-center">
              <GameTypeIcon slugOrName={game.slug || game.name} className="h-5 w-5 text-white" />
            </div>
          )}
        </div>
        <div className="absolute inset-x-0 bottom-0 p-2.5">
          <p className="text-[12px] font-bold text-white leading-tight line-clamp-1">{game.shortName ?? game.name}</p>
          {typeof tournamentCount === "number" && (
            <p className="text-[10px] text-gold font-semibold mt-0.5">{tournamentCount}+ Tournaments</p>
          )}
        </div>
      </motion.div>
    </Link>
  );
}
