"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { Users, MapPin } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { SlotMeter } from "./slot-meter";
import { CountdownTimer } from "./countdown-timer";
import { formatPaise, gameModeLabel } from "@/lib/format";
import type { TournamentListItem } from "@/hooks/use-tournaments";

export function TournamentCard({ tournament }: { tournament: TournamentListItem }) {
  const t = tournament;
  const isFull = t.slotsLeft <= 0;

  return (
    <Link href={`/tournaments/${t.slug}`}>
      <motion.div whileHover={{ y: -3 }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.15 }}>
        <Card className="overflow-hidden">
          <div className="relative h-28 gradient-brand flex items-end p-3">
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            <div className="relative z-10 flex items-center justify-between w-full">
              <Badge tone={t.format === "FREE" ? "signal" : "gold"}>{t.format === "FREE" ? "Free Entry" : formatPaise(t.entryFee)}</Badge>
              {t.isJoined && <Badge tone="cobalt">Joined</Badge>}
            </div>
            <span className="absolute top-3 right-3 text-[10px] font-bold uppercase tracking-wider text-white/80 bg-black/30 rounded-full px-2 py-1">
              {t.gameName}
            </span>
          </div>

          <div className="p-4 space-y-3">
            <div>
              <h3 className="font-bold text-white text-sm leading-snug line-clamp-1">{t.title}</h3>
              <div className="flex items-center gap-2 mt-1 text-xs text-white/50">
                <span>{gameModeLabel(t.mode)}</span>
                {t.map && (
                  <>
                    <span>•</span>
                    <span className="flex items-center gap-0.5">
                      <MapPin className="h-3 w-3" /> {t.map}
                    </span>
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] uppercase tracking-wide text-white/40">Prize Pool</p>
                <p className="text-sm font-bold gradient-text font-mono">{formatPaise(t.prizePool)}</p>
              </div>
              <div className="text-right">
                <p className="text-[10px] uppercase tracking-wide text-white/40">Starts in</p>
                <CountdownTimer target={t.matchStartsAt} />
              </div>
            </div>

            <SlotMeter filled={t.slotsFilled} max={t.maxSlots} />

            <div className="flex items-center justify-between text-xs text-white/40">
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" /> {t.slotsFilled}/{t.maxSlots} joined
              </span>
              {isFull && <span className="text-crimson font-semibold">FULL</span>}
            </div>
          </div>
        </Card>
      </motion.div>
    </Link>
  );
}
