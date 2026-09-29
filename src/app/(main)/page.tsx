"use client";

import { ShieldCheck, Zap, Trophy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { HeroCarousel } from "@/components/home/hero-carousel";
import { StatsStrip } from "@/components/home/stats-strip";
import { LiveMatches } from "@/components/home/live-matches";
import { UpcomingTournaments } from "@/components/home/upcoming-tournaments";
import { PopularGames } from "@/components/home/popular-games";
import { CreateTournamentCard } from "@/components/home/create-tournament-card";
import { NewsSection } from "@/components/home/news-section";

export default function HomePage() {
  return (
    <div className="space-y-8">
      <HeroCarousel />
      <StatsStrip />
      <LiveMatches />
      <UpcomingTournaments />
      <PopularGames />
      <CreateTournamentCard />
      <NewsSection />

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
