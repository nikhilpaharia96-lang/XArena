"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Calendar, Clock, Crown, Flame, IndianRupee, Layers, Trophy, User, Users } from "lucide-react";
import { useTournaments, type TournamentListItem } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPaise, formatDateTime, gameModeLabel } from "@/lib/format";
import { SectionHeader } from "./section-header";

/**
 * Custom key-art for specific tournaments, keyed by slug. Anything not listed
 * falls back to the tournament's own bannerUrl (or a navy gradient) with a
 * styled text title, so every featured tournament still renders properly.
 */
const FEATURED_ART: Record<string, { bg: string; title: string }> = {
  "bgmi-clash-royale-cup": {
    bg: "/featured/bgmi-bg.webp",
    title: "/featured/bgmi-clash-royale-cup-title.webp",
  },
};

/** Ticking countdown to `target`. Returns null once the start time has passed. */
function useCountdown(target: string) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const ms = new Date(target).getTime() - now;
  if (ms <= 0) return null;

  const totalSec = Math.floor(ms / 1000);
  const d = Math.floor(totalSec / 86400);
  const h = Math.floor((totalSec % 86400) / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return d > 0 ? `${d}d ${pad(h)}h ${pad(m)}m` : `${pad(h)}h ${pad(m)}m ${pad(s)}s`;
}

function Countdown({ target }: { target: string }) {
  const value = useCountdown(target);
  return (
    <div className="flex-[1.25] md:flex-none min-w-0 rounded-2xl border border-white/10 bg-black/45 backdrop-blur-md px-3 py-2 md:px-3.5 md:py-2.5">
      <p className="flex items-center gap-1.5 text-[9px] md:text-[11px] font-bold uppercase tracking-wider text-gold">
        <Clock className="h-3.5 w-3.5 shrink-0" /> {value ? "Starts in" : "Status"}
      </p>
      <p className="mt-0.5 font-black tabular-nums leading-tight text-gold text-[15px] sm:text-xl md:text-2xl whitespace-nowrap">
        {value ?? "Live now"}
      </p>
    </div>
  );
}

function FeaturedCard({ t }: { t: TournamentListItem }) {
  const art = FEATURED_ART[t.slug];
  const ModeIcon = t.mode === "SOLO" || t.mode === "ONE_V_ONE" ? User : Users;
  const date = formatDateTime(t.matchStartsAt).replace(/\b(am|pm)\b/i, (m) => m.toUpperCase());
  const bgSrc = art?.bg ?? t.bannerUrl;

  return (
    <Link href={`/tournaments/${t.slug}`} className="block">
      <motion.div
        whileTap={{ scale: 0.99 }}
        // gradient "glow border": blue → purple, like the reference
        className="rounded-[28px] p-px bg-gradient-to-br from-cobalt via-violet/50 to-purple-500/80 shadow-[0_0_34px_rgba(37,99,235,0.32)]"
      >
        <div className="relative overflow-hidden rounded-[27px] bg-void md:min-h-[270px] lg:min-h-[310px]">
          {/* Background art — top block on mobile (fades into the card), full-bleed on desktop */}
          <div className="absolute inset-x-0 top-0 h-[265px] md:inset-0 md:h-auto">
            {bgSrc ? (
              <Image
                src={bgSrc}
                alt=""
                fill
                priority
                sizes="(max-width: 1152px) 100vw, 1152px"
                className="object-cover object-[42%_12%] md:object-[50%_40%]"
              />
            ) : (
              <div className="absolute inset-0 bg-[linear-gradient(135deg,var(--color-violet-dim),var(--color-void))]" />
            )}
          </div>

          {/* Legibility overlays: fade-to-navy on mobile, left-to-right on desktop */}
          <div className="absolute inset-x-0 top-0 h-[265px] md:hidden bg-[linear-gradient(to_top,var(--color-void)_0%,rgba(2,6,23,0.55)_38%,rgba(2,6,23,0)_70%),linear-gradient(to_right,rgba(2,6,23,0.55)_0%,rgba(2,6,23,0)_55%)]" />
          <div className="absolute inset-0 hidden md:block bg-[linear-gradient(to_right,rgba(2,6,23,0.94)_0%,rgba(2,6,23,0.62)_40%,rgba(2,6,23,0.05)_68%),linear-gradient(to_top,rgba(2,6,23,0.7)_0%,transparent_45%)]" />

          {/* Game chip (top right) */}
          <span className="absolute right-3 top-3 md:right-5 md:top-5 rounded-xl border border-white/10 bg-void/80 backdrop-blur px-3 py-1 md:px-4 md:py-1.5 text-xs md:text-base font-black tracking-wide text-white shadow-lg">
            {t.gameName}
          </span>

          <div className="relative flex min-h-[inherit] flex-col justify-between gap-3.5 p-3.5 sm:p-4 md:flex-row md:items-end md:p-6 lg:p-7">
            {/* Left: identity + facts */}
            <div className="flex min-w-0 flex-col gap-2.5 md:gap-3 md:max-w-[62%]">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/70 bg-gold/10 px-2.5 py-1 md:px-3 md:py-1.5 text-[10px] md:text-xs font-bold uppercase tracking-wide text-orange-300 shadow-[0_0_18px_rgba(249,115,22,0.35)]">
                <Crown className="h-3.5 w-3.5 text-gold" /> Featured
              </span>

              <h3 className="m-0">
                <span className="sr-only">{t.title}</span>
                {art ? (
                  <Image
                    src={art.title}
                    alt=""
                    width={1200}
                    height={333}
                    priority
                    className="h-auto w-[68%] max-w-[270px] sm:max-w-[320px] md:max-w-[400px] drop-shadow-[0_6px_18px_rgba(0,0,0,0.65)]"
                  />
                ) : (
                  <span aria-hidden className="block font-display font-black italic text-2xl md:text-4xl leading-[1.05] bg-gradient-to-b from-amber-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_4px_12px_rgba(0,0,0,0.6)]">
                    {t.title}
                  </span>
                )}
              </h3>

              <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs md:text-sm font-medium text-white/85">
                <span className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-white/70 shrink-0" /> {date}
                </span>
                <span className="hidden sm:block h-4 w-px bg-white/20" />
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-white/70 shrink-0" /> {t.maxSlots} Slots
                </span>
              </div>

              <div className="flex items-center gap-3">
                <Trophy className="h-8 w-8 md:h-11 md:w-11 shrink-0 text-amber-400 fill-amber-400/25 drop-shadow-[0_0_14px_rgba(251,191,36,0.6)]" strokeWidth={1.6} />
                <div className="leading-none">
                  <p className="font-black text-[30px] md:text-5xl bg-gradient-to-b from-amber-300 to-orange-500 bg-clip-text text-transparent drop-shadow-[0_2px_10px_rgba(249,115,22,0.35)]">
                    {formatPaise(t.prizePool)}
                  </p>
                  <p className="mt-0.5 text-[10px] md:text-xs font-bold uppercase tracking-wider text-white/80">Prize Pool</p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 md:gap-2">
                <span className="inline-flex items-center gap-1.5 md:gap-2 rounded-2xl border border-white/15 bg-white/5 backdrop-blur px-2.5 h-7 md:px-3 md:h-9 text-xs md:text-sm font-semibold text-white">
                  <ModeIcon className="h-3.5 w-3.5 md:h-4 md:w-4 text-white/80" /> {gameModeLabel(t.mode)}
                </span>
                <span className="inline-flex items-center gap-1.5 md:gap-2 rounded-2xl border border-signal/50 bg-signal/10 backdrop-blur px-2.5 h-7 md:px-3 md:h-9 text-xs md:text-sm font-semibold text-signal">
                  <span className="flex h-4 w-4 md:h-5 md:w-5 items-center justify-center rounded-full border-2 border-signal">
                    <IndianRupee className="h-2.5 w-2.5 md:h-3 md:w-3" strokeWidth={3} />
                  </span>
                  {t.format === "FREE" ? "Free Entry" : `Entry: ${formatPaise(t.entryFee)}`}
                </span>
                <span className="inline-flex items-center gap-1.5 md:gap-2 rounded-2xl border border-cobalt/40 bg-cobalt/10 backdrop-blur px-2.5 h-7 md:px-3 md:h-9 text-xs md:text-sm font-semibold text-cobalt">
                  <Layers className="h-3.5 w-3.5 md:h-4 md:w-4" /> {t.slotsFilled}/{t.maxSlots} Joined
                </span>
              </div>
            </div>

            {/* Right (desktop) / bottom (mobile): countdown + CTA */}
            <div className="flex items-stretch gap-3 md:w-[230px] md:shrink-0 md:flex-col md:items-stretch lg:w-[250px]">
              <Countdown target={t.matchStartsAt} />
              <span className="inline-flex flex-1 md:flex-none items-center justify-center gap-1.5 rounded-2xl border border-white/20 gradient-cta px-3 md:px-4 min-h-[46px] md:h-[52px] text-sm md:text-lg whitespace-nowrap font-bold text-white shadow-[0_0_28px_rgba(249,115,22,0.5)]">
                Join Now <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}

/**
 * One large hero card for a single real featured tournament
 * (Tournament.isFeatured, same flag the hero carousel's promo slides use).
 * Renders nothing when there isn't one instead of inventing a placeholder.
 */
export function FeaturedTournament() {
  const { data: featured, isLoading } = useTournaments({ featured: true });
  const t = featured?.[0];

  if (isLoading) return <Skeleton className="h-[340px] rounded-[28px]" />;
  if (!t) return null;

  return (
    <section>
      <SectionHeader title="Featured Tournament" href="/tournaments?featured=1" icon={Flame} />
      <FeaturedCard t={t} />
    </section>
  );
}
