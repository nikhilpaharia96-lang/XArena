"use client";

import { HeroCarousel } from "@/components/home/hero-carousel";
import { TrustStrip } from "@/components/home/trust-strip";
import { PopularGames } from "@/components/home/popular-games";
import { FeaturedTournament } from "@/components/home/featured-tournament";
import { UpcomingTournaments } from "@/components/home/upcoming-tournaments";
import { HowItWorks } from "@/components/home/how-it-works";
import { TrendingTournaments } from "@/components/home/trending-tournaments";
import { ReferEarnBanner } from "@/components/home/refer-earn-banner";
import { LeaderboardPreview } from "@/components/home/leaderboard-preview";
import { NewsSection } from "@/components/home/news-section";
import { CommunityBanner } from "@/components/home/community-banner";
import { Testimonials } from "@/components/home/testimonials";
import { FaqSection } from "@/components/home/faq-section";
import { AppDownloadBanner } from "@/components/home/app-download-banner";
import { SupportCta } from "@/components/home/support-cta";

export default function HomePage() {
  return (
    <div className="space-y-10 sm:space-y-14">
      <HeroCarousel />
      <TrustStrip />
      <PopularGames />
      <FeaturedTournament />
      <UpcomingTournaments />
      <HowItWorks />
      <TrendingTournaments />
      <ReferEarnBanner />
      <LeaderboardPreview />
      <NewsSection />
      <CommunityBanner />
      <Testimonials />
      <FaqSection />
      <AppDownloadBanner />
      <SupportCta />
    </div>
  );
}
