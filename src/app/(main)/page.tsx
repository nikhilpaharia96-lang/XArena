"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ShieldCheck, Zap, Trophy, Gift, Sparkles } from "lucide-react";
import { useGames } from "@/hooks/use-tournaments";
import { useTournaments } from "@/hooks/use-tournaments";
import { GameCard } from "@/components/home/game-card";
import { TournamentCard } from "@/components/tournament/tournament-card";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ErrorState } from "@/components/ui/error-state";
import { Card } from "@/components/ui/card";

const HERO_SLIDES = [
  { title: "Mega Friday", subtitle: "₹5,00,000 Prize Pool", tone: "from-violet to-cobalt" },
  { title: "Refer & Earn", subtitle: "₹50 per friend, instantly", tone: "from-cobalt to-signal" },
  { title: "Daily Tournaments", subtitle: "New matches every day", tone: "from-gold to-crimson" },
];

export default function HomePage() {
  const { data: games, isLoading: gamesLoading } = useGames();
  const { data: featured, isLoading: featuredLoading, isError: featuredError, refetch: refetchFeatured } = useTournaments({ featured: true });
  const { data: upcoming, isLoading: upcomingLoading } = useTournaments({ status: "REGISTRATION_OPEN" });

  return (
    <div className="space-y-8">
      {/* Hero slider */}
      <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4 snap-x">
        {HERO_SLIDES.map((slide, i) => (
          <motion.div
            key={slide.title}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.08 }}
            className={`relative shrink-0 w-[85vw] sm:w-96 h-40 rounded-3xl bg-gradient-to-br ${slide.tone} snap-center overflow-hidden flex flex-col justify-end p-5`}
          >
            <div className="absolute -right-6 -top-6 h-28 w-28 rounded-full bg-white/15 blur-2xl" />
            <Sparkles className="h-5 w-5 text-white/80 mb-2" />
            <h3 className="text-white font-black text-xl">{slide.title}</h3>
            <p className="text-white/85 text-sm font-medium">{slide.subtitle}</p>
          </motion.div>
        ))}
      </div>

      {/* Popular games */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white">Popular Games</h2>
          <Link href="/games" className="text-xs text-violet font-semibold flex items-center gap-0.5">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar -mx-4 px-4">
          {gamesLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 w-24 shrink-0 rounded-2xl" />)
            : games?.map((g) => <GameCard key={g.id} game={g} />)}
        </div>
      </section>

      {/* Featured tournaments */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-base font-bold text-white flex items-center gap-1.5">
            <Trophy className="h-4 w-4 text-gold" /> Featured Tournaments
          </h2>
          <Link href="/tournaments" className="text-xs text-violet font-semibold flex items-center gap-0.5">
            View all <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
        {featuredLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : featuredError ? (
          <ErrorState onRetry={() => refetchFeatured()} />
        ) : featured && featured.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featured.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Trophy} title="No featured tournaments right now" description="Check back soon, or browse all tournaments." />
        )}
      </section>

      {/* Daily rewards banner */}
      <Card className="p-5 flex items-center gap-4 glow-border">
        <div className="h-12 w-12 rounded-2xl bg-gold/15 flex items-center justify-center shrink-0">
          <Gift className="h-6 w-6 text-gold" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-white text-sm">Daily Login Rewards</p>
          <p className="text-xs text-white/50">Log in every day to build your streak and earn bonus cash.</p>
        </div>
      </Card>

      {/* Upcoming tournaments */}
      <section>
        <h2 className="text-base font-bold text-white mb-3">Upcoming Tournaments</h2>
        {upcomingLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
            ))}
          </div>
        ) : upcoming && upcoming.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {upcoming.slice(0, 6).map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        ) : (
          <EmptyState icon={Trophy} title="No open tournaments yet" description="New tournaments are added daily — check back soon." />
        )}
      </section>

      {/* Trust / feature strip */}
      <section className="grid grid-cols-3 gap-3">
        {[
          { icon: ShieldCheck, label: "Secure Payments", tone: "text-signal" },
          { icon: Zap, label: "Instant Withdrawals", tone: "text-gold" },
          { icon: Trophy, label: "Fair Play Verified", tone: "text-violet" },
        ].map((f) => (
          <Card key={f.label} className="p-4 text-center">
            <f.icon className={`h-5 w-5 mx-auto mb-2 ${f.tone}`} />
            <p className="text-[11px] font-semibold text-white/70">{f.label}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}
