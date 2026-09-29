"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import type { Game } from "@/hooks/use-tournaments";
import { GameTypeIcon } from "./game-icon";

export function GameCard({ game, tournamentCount }: { game: Game; tournamentCount?: number }) {
  return (
    <Link href={`/tournaments?game=${game.slug}`} className="shrink-0 w-[84px]" aria-label={`${game.name} tournaments`}>
      <motion.div whileTap={{ scale: 0.94 }}>
        <Card className="flex flex-col items-center justify-center gap-1.5 p-2 py-3 hover:border-violet/30 active:border-violet/50">
          <div className="h-10 w-10 rounded-xl gradient-brand flex items-center justify-center overflow-hidden">
            {game.iconUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={game.iconUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <GameTypeIcon slugOrName={game.slug || game.name} className="h-5 w-5 text-white" />
            )}
          </div>
          <span className="text-[11px] font-semibold text-white/80 text-center leading-tight line-clamp-2">
            {game.shortName ?? game.name}
          </span>
          {typeof tournamentCount === "number" && (
            <span className="text-[9px] text-gold font-semibold">{tournamentCount} tours</span>
          )}
        </Card>
      </motion.div>
    </Link>
  );
}
