"use client";

import Link from "next/link";
import { Dices } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useOriginals } from "@/hooks/use-originals";

/** Shown on the Games page only while at least one Original is switched on. */
export function OriginalsEntry() {
  const { data } = useOriginals();
  if (!data || data.games.length === 0) return null;
  return (
    <section className="mt-10">
      <h2 className="text-xl font-black text-white flex items-center gap-2 mb-4">
        <Dices className="h-5 w-5 text-violet" /> XArena Originals
      </h2>
      <Link href="/originals">
        <Card className="p-5 flex items-center gap-4 hover:glow-border transition-shadow">
          <div className="h-14 w-14 rounded-2xl gradient-brand flex items-center justify-center shrink-0">
            <Dices className="h-7 w-7 text-white" />
          </div>
          <div>
            <p className="font-bold text-white">Garuda Ascent slot · Dice · Coin Flip · Mines · Crash</p>
            <p className="text-xs text-white/50 mt-0.5">Instant provably-fair games, played straight from your wallet.</p>
          </div>
        </Card>
      </Link>
    </section>
  );
}
