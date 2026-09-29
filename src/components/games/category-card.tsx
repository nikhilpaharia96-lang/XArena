"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Trophy, Users } from "lucide-react";
import { categoryHref, findCategoryByValue, type FreeFireCategoryValue } from "@/lib/free-fire-categories";
import { formatPaise } from "@/lib/format";
import { CATEGORY_VISUALS } from "./category-visuals";

export function CategoryCard({ value, activeCount, prizePool }: { value: FreeFireCategoryValue; activeCount: number; prizePool: number }) {
  const cat = findCategoryByValue(value)!;
  const { icon: Icon, gradient } = CATEGORY_VISUALS[value];

  return (
    <Link href={categoryHref(value)} aria-label={`${cat.label} tournaments`}>
      <motion.div
        whileTap={{ scale: 0.97 }}
        whileHover={{ y: -2 }}
        transition={{ duration: 0.15 }}
        className="rounded-2xl bg-surface border border-white/8 overflow-hidden h-full flex flex-col"
      >
        <div className={`relative h-24 bg-gradient-to-br ${gradient} flex items-center justify-center`}>
          <Icon className="h-12 w-12 text-white/85 drop-shadow-lg" />
          <div className="absolute inset-0 bg-gradient-to-t from-surface/80 to-transparent" />
        </div>
        <div className="p-3 flex flex-col gap-2 flex-1">
          <div>
            <h3 className="font-extrabold text-white text-sm leading-tight">{cat.label.toUpperCase()}</h3>
            <p className="text-[11px] text-white/50 leading-snug mt-0.5 line-clamp-2">{cat.description}</p>
          </div>
          <div className="flex items-center justify-between text-[11px] font-semibold mt-auto">
            <span className="flex items-center gap-1 text-cobalt">
              <Users className="h-3 w-3" /> {activeCount} Active
            </span>
            <span className="flex items-center gap-1 text-gold">
              <Trophy className="h-3 w-3" /> {formatPaise(prizePool)}
            </span>
          </div>
          <span className="rounded-lg bg-cobalt text-white text-xs font-bold h-8 flex items-center justify-center gap-1">
            View Tournaments <ArrowRight className="h-3 w-3" />
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
