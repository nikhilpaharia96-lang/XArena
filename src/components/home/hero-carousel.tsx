"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Plus, Sparkles } from "lucide-react";
import { useTournaments } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { formatPaise } from "@/lib/format";

const TAGLINE = "THE ULTIMATE TOURNAMENT";

/**
 * Swipeable hero. Slide 1 is always the XArena brand intro (static copy,
 * like an app tagline — not data). Any remaining slides are built from real
 * featured tournaments so the hero never shows fabricated promos.
 */
export function HeroCarousel() {
  const { data: featured, isLoading } = useTournaments({ featured: true });
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const slideCount = 1 + Math.min(featured?.length ?? 0, 4);

  function onScroll() {
    const el = scrollerRef.current;
    if (!el) return;
    const idx = Math.round(el.scrollLeft / el.clientWidth);
    setActive(idx);
  }

  if (isLoading) {
    return <Skeleton className="h-56 sm:h-64 rounded-3xl -mx-4 sm:mx-0 sm:rounded-3xl" />;
  }

  return (
    <div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        className="flex gap-3 overflow-x-auto no-scrollbar snap-x snap-mandatory -mx-4 px-4"
      >
        {/* Brand slide */}
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.25 }}
          className="relative shrink-0 w-full sm:w-[92%] h-56 sm:h-64 rounded-3xl snap-center overflow-hidden flex flex-col justify-end p-5 sm:p-7 gradient-brand"
        >
          <div className="absolute -right-8 -top-8 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="absolute -left-10 bottom-0 h-32 w-32 rounded-full bg-gold/20 blur-3xl" />
          <span className="relative inline-flex items-center gap-1.5 text-[11px] font-bold tracking-widest text-gold mb-2">
            <Sparkles className="h-3.5 w-3.5" /> {TAGLINE}
          </span>
          <h1 className="relative text-white font-display font-black text-3xl sm:text-4xl leading-[1.05] mb-2">
            Play.
            <br />
            Compete.
            <br />
            Become a Champion.
          </h1>
          <p className="relative text-white/80 text-sm max-w-sm mb-4">
            Discover tournaments, build your team and compete for glory.
          </p>
          <div className="relative flex items-center gap-2">
            <Link
              href="/tournaments"
              className="inline-flex items-center gap-1.5 rounded-xl bg-white text-violet-dim px-4 h-10 text-sm font-bold"
            >
              Explore Tournaments <ArrowRight className="h-3.5 w-3.5" />
            </Link>
            <Link
              href="/admin/tournaments/new"
              className="inline-flex items-center gap-1.5 rounded-xl bg-black/25 border border-white/25 text-white px-4 h-10 text-sm font-semibold"
            >
              <Plus className="h-3.5 w-3.5" /> Create Tournament
            </Link>
          </div>
        </motion.div>

        {/* Real featured-tournament slides */}
        {featured?.slice(0, 4).map((t, i) => (
          <motion.div
            key={t.id}
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.25, delay: i * 0.05 }}
            className="relative shrink-0 w-full sm:w-[92%] h-56 sm:h-64 rounded-3xl snap-center overflow-hidden flex flex-col justify-end p-5 sm:p-7"
          >
            <div
              className="absolute inset-0"
              style={
                t.bannerUrl
                  ? { backgroundImage: `url(${t.bannerUrl})`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { background: "linear-gradient(135deg, var(--color-violet-dim), var(--color-void))" }
              }
            />
            <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-black/10" />
            <span className="relative inline-flex w-fit items-center gap-1 rounded-full bg-gold/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-void mb-2">
              Featured
            </span>
            <h2 className="relative text-white font-display font-extrabold text-2xl leading-tight mb-1 line-clamp-2">{t.title}</h2>
            <p className="relative text-white/75 text-sm mb-4">
              {t.gameName} • Prize Pool {formatPaise(t.prizePool)}
            </p>
            <Link
              href={`/tournaments/${t.slug}`}
              className="relative inline-flex items-center gap-1.5 w-fit rounded-xl gradient-cta px-4 h-10 text-sm font-bold text-white"
            >
              Register Now <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        ))}
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
