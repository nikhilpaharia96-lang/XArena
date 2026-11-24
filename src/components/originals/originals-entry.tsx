"use client";

import Link from "next/link";
import Image from "next/image";
import { Coins, Crown, Dices, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useOriginals, type GameKey } from "@/hooks/use-originals";

interface Cover {
  title: string;
  /** Cover artwork. Games without art yet get a styled tile instead. */
  art?: string;
  gradient: string;
  icon: LucideIcon;
}

/** Display order on the Games page. */
const ORDER: GameKey[] = ["SLOT", "COINS", "DICE", "COINFLIP", "MINES", "CRASH"];

const COVERS: Record<GameKey, Cover> = {
  MINES: { title: "Mines", art: "/images/originals/mines.webp", gradient: "from-[#9B1CF0] to-[#6B0FC4]", icon: Dices },
  CRASH: { title: "Crash", art: "/images/originals/crash.webp", gradient: "from-[#9B1CF0] to-[#6B0FC4]", icon: Dices },
  DICE: { title: "Dice", art: "/images/originals/dice.webp", gradient: "from-[#10A24A] to-[#066B2A]", icon: Dices },
  COINFLIP: { title: "Coin Flip", gradient: "from-[#F59E0B] to-[#B45309]", icon: Coins },
  SLOT: { title: "Garuda Ascent", gradient: "from-[#312E81] to-[#7C3AED]", icon: Crown },
  COINS: { title: "Lakshmi Coins", gradient: "from-[#DC2626] to-[#9A3412]", icon: Sparkles },
};

/** Shown on the Games page only while at least one Original is switched on. */
export function OriginalsEntry() {
  const { data } = useOriginals();
  if (!data || data.games.length === 0) return null;

  const enabled = new Set(data.games.map((g) => g.gameKey));
  const keys = ORDER.filter((k) => enabled.has(k));

  return (
    <section className="mt-10">
      <h2 className="text-xl font-black text-white flex items-center gap-2">
        <Dices className="h-5 w-5 text-violet" /> XArena Originals
      </h2>
      <p className="text-xs text-white/50 mt-1 mb-4">Instant provably-fair games, played straight from your wallet.</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {keys.map((k) => {
          const c = COVERS[k];
          const Icon = c.icon;
          return (
            <Link
              key={k}
              href={`/originals?game=${k}`}
              aria-label={`Play ${c.title}`}
              className="force-dark group relative block aspect-[3/4] rounded-2xl overflow-hidden border border-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60 active:scale-[0.98] transition-transform"
            >
              {c.art ? (
                <Image
                  src={c.art}
                  alt={c.title}
                  fill
                  sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                />
              ) : (
                <div className={`absolute inset-0 bg-gradient-to-b ${c.gradient} flex flex-col items-center`}>
                  <div className="mt-[22%] h-20 w-20 rounded-full bg-white/15 border border-white/25 flex items-center justify-center">
                    <Icon className="h-10 w-10 text-white" />
                  </div>
                  <p className="mt-auto mb-[26%] px-3 text-center text-[clamp(1.25rem,6vw,1.75rem)] leading-[1.05] font-black text-white">
                    {c.title}
                  </p>
                  <p className="absolute bottom-[8%] text-[11px] font-bold tracking-wide text-white/70">ORIGINAL GAME</p>
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
