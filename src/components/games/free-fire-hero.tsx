"use client";

import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import { Gamepad2, Trophy, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCompactNumber, formatPaise } from "@/lib/format";

export interface FreeFireStats {
  activeCount: number;
  players: number;
  prizePool: number;
}

/** Hero banner + three live stat tiles. Stats come from the categories API. */
export function FreeFireHero({ stats, isLoading }: { stats?: FreeFireStats; isLoading: boolean }) {
  const reduce = useReducedMotion();
  const tiles = [
    { icon: Gamepad2, value: stats ? String(stats.activeCount) : "—", label: "Active Tournaments", tone: "text-cobalt" },
    { icon: Users, value: stats ? formatCompactNumber(stats.players) : "—", label: "Players Joined", tone: "text-cobalt" },
    { icon: Trophy, value: stats ? formatPaise(stats.prizePool) : "—", label: "Prize Pool", tone: "text-gold" },
  ];

  return (
    <motion.section
      aria-labelledby="ff-hero-title"
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35 }}
      style={{ "--accent": "255,122,0" } as React.CSSProperties}
      className="force-dark neon-card relative overflow-hidden rounded-3xl bg-void"
    >
      <Image
        src="/images/free-fire/hero.webp"
        alt=""
        fill
        priority
        sizes="(min-width: 1152px) 1120px, 100vw"
        className="object-cover object-[55%_20%]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-void via-void/55 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-void/70 via-transparent to-transparent" />

      <div className="relative flex min-h-[340px] flex-col justify-end p-4 sm:min-h-[420px] sm:p-7">
        <h2 id="ff-hero-title" className="m-0">
          <span className="sr-only">Free Fire</span>
          <Image src="/brand/free-fire-logo-white.webp" alt="" width={720} height={176} priority className="h-auto w-[min(78%,300px)] drop-shadow-[0_4px_18px_rgba(0,0,0,0.8)]" />
        </h2>
        <p className="mt-1.5 font-display text-xl font-extrabold italic tracking-tight text-gold drop-shadow-[0_2px_10px_rgba(255,122,0,0.5)] sm:text-3xl">
          TOURNAMENT ARENA
        </p>
        <p className="mt-2.5 max-w-xs text-sm text-white/85">Choose your mode and find your next match.</p>

        <dl className="mt-4 grid grid-cols-3 gap-2 sm:max-w-xl">
          {tiles.map((t) => (
            <div key={t.label} className="rounded-2xl border border-white/12 bg-void/55 p-2.5 backdrop-blur-md">
              <t.icon className={`h-5 w-5 ${t.tone}`} aria-hidden />
              <dd className="mt-1.5 truncate text-lg font-extrabold leading-none text-white">
                {isLoading ? <Skeleton className="h-5 w-12" /> : t.value}
              </dd>
              <dt className="mt-1 text-[11px] leading-tight text-[#94A3B8]">{t.label}</dt>
            </div>
          ))}
        </dl>
        <p className="mt-3 text-[10px] leading-snug text-white/45">
          Free Fire is a trademark of Garena. XArena is an independent platform, not affiliated with or endorsed by Garena.
        </p>
      </div>
    </motion.section>
  );
}
