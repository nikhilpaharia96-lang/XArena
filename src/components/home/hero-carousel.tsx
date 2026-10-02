"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion } from "framer-motion";
import { ArrowRight, Trophy, ShieldCheck, Zap, Users, Wallet, IndianRupee, Play, Crown, UsersRound } from "lucide-react";
import { useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPaise } from "@/lib/format";
import { posterForGame } from "./game-card";
import { toast } from "@/lib/toast-store";

/**
 * Swipeable hero. Slides 1–3 are always the XArena brand intro (static
 * copy, like an app tagline/promo poster — not data). Any remaining slides
 * are built from real featured tournaments so the hero never shows
 * fabricated tournament promos.
 */
export function HeroCarousel() {
  const { data: featured, isLoading } = useTournaments({ featured: true });
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const slideCount = 3 + Math.min(featured?.length ?? 0, 4);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(idx);
  }

  // Auto-advance every 3s. Pauses while the person is actually touching/
  // dragging the carousel so autoplay never fights a manual swipe, and is
  // skipped entirely for prefers-reduced-motion.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el || slideCount <= 1) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let paused = false;
    const pause = () => {
      paused = true;
    };
    const resume = () => {
      paused = false;
    };

    const interval = setInterval(() => {
      if (paused) return;
      const nextIndex = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slideCount;
      el.scrollTo({ left: nextIndex * el.clientWidth, behavior: "smooth" });
    }, 3000);

    el.addEventListener("pointerdown", pause);
    el.addEventListener("pointerup", resume);
    el.addEventListener("pointercancel", resume);
    el.addEventListener("touchstart", pause, { passive: true });
    el.addEventListener("touchend", resume);
    el.addEventListener("mouseenter", pause);
    el.addEventListener("mouseleave", resume);

    return () => {
      clearInterval(interval);
      el.removeEventListener("pointerdown", pause);
      el.removeEventListener("pointerup", resume);
      el.removeEventListener("pointercancel", resume);
      el.removeEventListener("touchstart", pause);
      el.removeEventListener("touchend", resume);
      el.removeEventListener("mouseenter", pause);
      el.removeEventListener("mouseleave", resume);
    };
  }, [slideCount]);

  if (isLoading) {
    return <Skeleton className="h-72 sm:h-80 rounded-3xl -mx-4 sm:mx-0 sm:rounded-3xl" />;
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4"
      >
        {/* Brand slide 1 — original tagline banner */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="relative shrink-0 w-full sm:w-[92%] h-72 sm:h-80 rounded-3xl snap-center overflow-hidden flex flex-col justify-end p-5 sm:p-7"
        >
          {/* Squad artwork */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url(/images/hero-squad.webp)",
              backgroundSize: "cover",
              backgroundPosition: "78% 12%",
            }}
          />
          {/* Readability overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 to-void/10 sm:from-void sm:via-void/75 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/10 to-transparent" />

          {/* Badge row */}
          <div className="relative flex flex-wrap items-center gap-2 mb-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-gold">
              <Trophy className="h-3 w-3" /> The Ultimate Gaming Arena
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full border border-signal/40 bg-signal/10 px-3 py-1 text-[10px] font-bold text-signal">
              <ShieldCheck className="h-3 w-3" /> Trusted by Gamers
            </span>
          </div>

          <span className="relative inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-gold/90 mb-2">
            <Zap className="h-3.5 w-3.5" /> INDIA&apos;S HOME FOR ESPORTS
          </span>

          <h1 className="relative text-white font-display font-black text-3xl sm:text-5xl leading-[1.05] mb-2">
            Play.
            <br />
            Compete.
            <br />
            <span className="bg-gradient-to-r from-sky-300 to-blue-500 bg-clip-text text-transparent">Win Big.</span>
          </h1>
          <p className="relative text-white/80 text-sm max-w-sm mb-4">
            Join exciting tournaments, build your team and compete with players across India.
          </p>
          <div className="relative flex items-center gap-2">
            <Link
              href="/tournaments"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-violet-dim px-4 h-10 text-sm font-bold"
            >
              Explore Tournaments <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/signup"
              className="inline-flex items-center gap-1.5 rounded-xl bg-black/25 border border-white/25 text-white px-4 h-10 text-sm font-semibold"
            >
              Register Now <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </motion.div>

        {/* Brand slide 2 — "Play Compete Win" poster banner. Static marketing
            copy (app tagline + illustrative platform stats), not tournament
            data. The 1K+/50K+/₹10L+ figures are placeholder headline numbers
            matching the reference poster; swap in real aggregate figures
            once the platform has them to report. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.05 }}
          className="relative shrink-0 w-full sm:w-[92%] h-72 sm:h-80 rounded-3xl snap-center overflow-hidden flex flex-col justify-end p-5 sm:p-7"
        >
          {/* Character artwork */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url(/images/hero-booyah.webp)",
              backgroundSize: "cover",
              backgroundPosition: "72% center",
            }}
          />
          {/* Readability overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/88 sm:via-void/80 to-void/15 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/15 to-transparent" />

          <span className="relative inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-gold mb-2">
            <Zap className="h-3 w-3" /> INDIA&apos;S FASTEST GROWING
          </span>

          <h1 className="relative mb-1.5 -ml-1">
            <Image
              src="/images/play-compete-win.webp"
              alt="Play. Compete. Win."
              width={1416}
              height={1080}
              priority
              className="h-24 sm:h-32 w-auto drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)]"
            />
          </h1>

          <p className="relative text-white/75 text-xs sm:text-sm max-w-xs sm:max-w-sm mb-3 line-clamp-2">
            Join thousands of gamers, compete in exciting tournaments and win real rewards.
          </p>

          <div className="relative flex items-center gap-3 sm:gap-5 mb-3">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-gold" />
              <span className="text-xs sm:text-sm font-black text-white">1K+</span>
              <span className="text-[10px] text-white/50">Tournaments</span>
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-cobalt" />
              <span className="text-xs sm:text-sm font-black text-white">50K+</span>
              <span className="text-[10px] text-white/50">Gamers</span>
            </span>
            <span className="flex items-center gap-1.5">
              <IndianRupee className="h-3.5 w-3.5 text-signal" />
              <span className="text-xs sm:text-sm font-black text-white">10L+</span>
              <span className="text-[10px] text-white/50">Rewards</span>
            </span>
          </div>

          <div className="relative flex items-center gap-2">
            <Link
              href="/tournaments"
              className="inline-flex items-center gap-1.5 rounded-xl gradient-cta px-4 h-10 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5)]"
            >
              Play Now <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <button
              onClick={() => toast({ title: "Trailer coming soon!", tone: "info" })}
              className="inline-flex items-center gap-2 rounded-xl bg-black/25 border border-white/25 text-white px-3.5 h-10 text-sm font-semibold"
            >
              <span className="h-5 w-5 rounded-full bg-white/15 flex items-center justify-center">
                <Play className="h-2.5 w-2.5 fill-current" />
              </span>
              Watch Video
            </button>
          </div>
        </motion.div>

        {/* Brand slide 3 — "Real Players, Real Rewards" poster banner. Also
            static marketing copy, not tournament data. */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25, delay: 0.1 }}
          className="relative shrink-0 w-full sm:w-[92%] h-72 sm:h-80 rounded-3xl snap-center overflow-hidden flex flex-col justify-end p-5 sm:p-7"
        >
          {/* Stadium/soldier artwork */}
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: "url(/images/hero-real-rewards-bg.webp)",
              backgroundSize: "cover",
              backgroundPosition: "68% center",
            }}
          />
          {/* Readability overlays */}
          <div className="absolute inset-0 bg-gradient-to-r from-void via-void/85 sm:via-void/75 to-void/10 sm:to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-t from-void via-void/15 to-transparent" />

          <span className="relative inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/50 bg-gold/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-gold mb-2">
            <Crown className="h-3 w-3" /> BIGGEST GAMING TOURNAMENTS
          </span>

          <Image
            src="/images/real-players-real-rewards.webp"
            alt="Real Players. Real Rewards."
            width={2436}
            height={662}
            className="h-16 sm:h-20 w-auto drop-shadow-[0_4px_14px_rgba(0,0,0,0.55)] mb-2 -ml-1"
          />

          <p className="relative text-white/75 text-xs sm:text-sm max-w-xs sm:max-w-sm mb-3 line-clamp-2">
            Join top tournaments, compete with the best and win exciting cash prizes.
          </p>

          <div className="relative flex items-center gap-3 sm:gap-5 mb-3">
            <span className="flex items-center gap-1.5">
              <Trophy className="h-3.5 w-3.5 text-gold" />
              <span className="text-[11px] text-white/70 font-semibold">Cash Prizes</span>
            </span>
            <span className="flex items-center gap-1.5">
              <UsersRound className="h-3.5 w-3.5 text-cobalt" />
              <span className="text-[11px] text-white/70 font-semibold">Fair Matches</span>
            </span>
            <span className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-signal" />
              <span className="text-[11px] text-white/70 font-semibold">Secure Platform</span>
            </span>
            <span className="hidden sm:flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5 text-cobalt" />
              <span className="text-[11px] text-white/70 font-semibold">Instant Withdrawals</span>
            </span>
          </div>

          <Link
            href="/tournaments"
            className="relative inline-flex items-center gap-1.5 w-fit rounded-xl gradient-cta px-5 h-11 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5)]"
          >
            Explore Tournaments <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </motion.div>

        {/* Real featured-tournament slides — same premium poster treatment as
            the brand slides, but every word is live tournament data. Uses the
            same posterForGame() artwork as the game cards / tournament
            detail page so each game gets its correct branded art (never a
            generic or mismatched character image). */}
        {featured?.slice(0, 4).map((t, i) => {
          const poster = posterForGame(t.gameSlug, t.bannerUrl);
          return (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.25, delay: 0.15 + i * 0.05 }}
              className="relative shrink-0 w-full sm:w-[92%] h-72 sm:h-80 rounded-3xl snap-center overflow-hidden flex flex-col justify-end p-5 sm:p-7"
            >
              <div
                className="absolute inset-0"
                style={
                  poster
                    ? { backgroundImage: `url(${poster})`, backgroundSize: "cover", backgroundPosition: "center 30%" }
                    : { background: "linear-gradient(135deg, var(--color-violet-dim), var(--color-void))" }
                }
              />
              <div className="absolute inset-0 bg-gradient-to-t from-void via-void/60 to-black/10" />
              <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-gold/20 blur-3xl" />

              <span className="relative inline-flex w-fit items-center gap-1.5 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-gold mb-3">
                <Zap className="h-3 w-3" /> Featured Tournament
              </span>

              <h2 className="relative text-white font-display font-black text-3xl sm:text-4xl leading-[1.05] mb-1.5 drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)] line-clamp-2">
                {t.title}
              </h2>
              <p className="relative text-white/70 text-sm mb-4">{t.gameName}</p>

              {/* Real stat row — mirrors a promo banner's stat strip, but every number is this tournament's actual data */}
              <div className="relative flex items-center gap-4 mb-4">
                <span className="flex items-center gap-1.5">
                  <Trophy className="h-4 w-4 text-gold" />
                  <span className="text-sm font-bold text-white font-mono">{formatPaise(t.prizePool)}</span>
                </span>
                <span className="h-4 w-px bg-white/20" />
                <span className="flex items-center gap-1.5">
                  <Users className="h-4 w-4 text-cobalt" />
                  <span className="text-sm font-bold text-white font-mono">
                    {t.slotsFilled}/{t.maxSlots}
                  </span>
                </span>
                <span className="h-4 w-px bg-white/20" />
                <span className="flex items-center gap-1.5">
                  <Wallet className="h-4 w-4 text-violet" />
                  <span className="text-sm font-bold text-white font-mono">
                    {t.format === "FREE" ? "Free" : formatPaise(t.entryFee)}
                  </span>
                </span>
              </div>

              <Link
                href={`/tournaments/${t.slug}`}
                className="relative inline-flex items-center gap-1.5 w-fit rounded-xl gradient-cta px-5 h-11 text-sm font-bold text-white shadow-[0_8px_24px_-6px_rgba(249,115,22,0.5)]"
              >
                Register Now <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </motion.div>
          );
        })}
      </div>

      {slideCount > 1 && (
        <div className="flex items-center justify-center gap-1.5 mt-3">
          {Array.from({ length: slideCount }).map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-violet" : "w-1.5 bg-white/20"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
