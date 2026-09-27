"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { Card } from "@/components/ui/card";
import type { Game } from "@/hooks/use-tournaments";
import { Gamepad2 } from "lucide-react";

export function GameCard({ game }: { game: Game }) {
  return (
    <Link href={`/tournaments?game=${game.slug}`} className="shrink-0 w-24">
      <motion.div whileTap={{ scale: 0.94 }}>
        <Card className="aspect-square flex flex-col items-center justify-center gap-2 p-2">
          <div className="h-10 w-10 rounded-xl gradient-brand flex items-center justify-center">
            <Gamepad2 className="h-5 w-5 text-white" />
          </div>
          <span className="text-[11px] font-semibold text-white/80 text-center leading-tight line-clamp-2">
            {game.shortName ?? game.name}
          </span>
        </Card>
      </motion.div>
    </Link>
  );
}
