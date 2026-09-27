"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { gameModeLabel } from "@/lib/format";
import type { TournamentListItem } from "@/hooks/use-tournaments";

export function LiveMatchCard({ tournament }: { tournament: TournamentListItem }) {
  const t = tournament;

  return (
    <Link href={`/tournaments/${t.slug}`} className="shrink-0 w-[280px] snap-center">
      <motion.div whileTap={{ scale: 0.98 }}>
        <Card className="p-4 border border-crimson/25">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-bold text-white/60 uppercase tracking-wide truncate max-w-[160px]">
              {t.title}
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-crimson/15 border border-crimson/30 px-2 py-0.5 text-[10px] font-bold text-crimson">
              <span className="h-1.5 w-1.5 rounded-full bg-crimson live-dot" /> LIVE
            </span>
          </div>

          <div className="flex items-center justify-between">
            <div className="text-center flex-1">
              <div className="h-9 w-9 mx-auto rounded-xl gradient-brand flex items-center justify-center text-[11px] font-bold text-white">
                {t.gameName.slice(0, 2).toUpperCase()}
              </div>
              <p className="text-[11px] text-white/70 mt-1 truncate">{t.gameName}</p>
            </div>
            <div className="px-3 text-center">
              <p className="text-[10px] text-white/40">{gameModeLabel(t.mode)}</p>
              <p className="text-xs font-bold text-white/70">VS</p>
            </div>
            <div className="text-center flex-1">
              <div className="h-9 w-9 mx-auto rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center text-[11px] font-bold text-gold">
                {t.slotsFilled}
              </div>
              <p className="text-[11px] text-white/70 mt-1 flex items-center justify-center gap-1">
                <Users className="h-3 w-3" /> joined
              </p>
            </div>
          </div>

          <div className="mt-3 rounded-xl bg-violet/10 border border-violet/25 text-center py-2 text-xs font-bold text-violet">
            Watch Live
          </div>
        </Card>
      </motion.div>
    </Link>
  );
}
