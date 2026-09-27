"use client";
import Link from "next/link";
import { useGames } from "@/hooks/use-tournaments";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Gamepad2 } from "lucide-react";
import { motion } from "framer-motion";

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
              <Link href={`/tournaments?game=${g.slug}`}>
                <Card className="p-5 flex flex-col items-center gap-3 text-center hover:glow-border transition-shadow">
                  <div className="h-14 w-14 rounded-2xl gradient-brand flex items-center justify-center">
                    <Gamepad2 className="h-7 w-7 text-white" />
                  </div>
                  <div>
                    <p className="font-bold text-white text-sm">{g.name}</p>
                    <p className="text-[11px] text-white/40 mt-0.5">{g.supportedModes.length} modes</p>
                  </div>
                </Card>
              </Link>
            </motion.div>
          ))}
        </div>
      ) : (
        <EmptyState icon={Gamepad2} title="No games available yet" />
      )}
    </div>
  );
}
