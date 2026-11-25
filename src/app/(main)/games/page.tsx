"use client";
import Link from "next/link";
import Image from "next/image";
import { useGames } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { posterForGame } from "@/components/home/game-card";
import { Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";
import { FREE_FIRE_GAME_SLUG, FREE_FIRE_ROUTE } from "@/lib/free-fire-categories";
import { OriginalsEntry } from "@/components/originals/originals-entry";
import { ProviderGamesSection } from "@/components/games/provider-games-section";

export default function GamesPage() {
  const { data: games, isLoading } = useGames();

  return (
    <div>
      <h1 className="text-xl font-black text-white mb-4">All Games</h1>
      {isLoading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-2xl" />)}
        </div>
      ) : games && games.length > 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {games.map((g, i) => (
            <motion.div key={g.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
              <Link
                href={g.slug === FREE_FIRE_GAME_SLUG ? FREE_FIRE_ROUTE : `/tournaments?game=${g.slug}`}
                aria-label={`${g.name} tournaments`}
                className="group block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60 active:scale-[0.98] transition-transform"
              >
                <div className="force-dark relative aspect-[3/4] rounded-2xl overflow-hidden border border-white/10">
                  {posterForGame(g.slug, g.bannerUrl) ? (
                    <Image
                      src={posterForGame(g.slug, g.bannerUrl) as string}
                      alt=""
                      fill
                      sizes="(min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw"
                      className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                    />
                  ) : (
                    <div className="absolute inset-0 gradient-brand flex items-center justify-center">
                      <Gamepad2 className="h-12 w-12 text-white" />
                    </div>
                  )}
                </div>
                <div className="px-1 pt-2">
                  <p className="font-bold text-white text-sm leading-tight truncate">{g.name}</p>
                  <p className="text-[11px] text-white/50 mt-0.5">{g.supportedModes.length} modes</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Gamepad2} title="No games available yet" />
      )}

      <Link
        href="/demo/color-prediction"
        className="force-dark mt-10 block rounded-2xl border border-white/10 bg-gradient-to-r from-purple-700 to-green-700 p-4 active:scale-[0.98] transition-transform"
      >
        <p className="text-xs font-bold text-white/70">DEMO · VIRTUAL POINTS</p>
        <p className="text-lg font-black text-white">Color Prediction</p>
        <p className="text-xs text-white/70">Free to play. No real money.</p>
      </Link>

      <Link
        href="/demo/aviator"
        className="force-dark mt-3 block rounded-2xl border border-white/10 bg-gradient-to-r from-red-800 to-zinc-900 p-4 active:scale-[0.98] transition-transform"
      >
        <p className="text-xs font-bold text-white/70">DEMO · VIRTUAL POINTS</p>
        <p className="text-lg font-black text-white">Aviator</p>
        <p className="text-xs text-white/70">Cash out before the plane flies away. No real money.</p>
      </Link>

      <Link
        href="/demo/roulette"
        className="force-dark mt-3 block rounded-2xl border border-white/10 bg-gradient-to-r from-emerald-800 to-zinc-900 p-4 active:scale-[0.98] transition-transform"
      >
        <p className="text-xs font-bold text-white/70">DEMO · VIRTUAL POINTS</p>
        <p className="text-lg font-black text-white">Roulette</p>
        <p className="text-xs text-white/70">European wheel, 0-36. No real money.</p>
      </Link>

      <OriginalsEntry />

      <ProviderGamesSection />
    </div>
  );
}
