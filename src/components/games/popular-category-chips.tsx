"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Flame } from "lucide-react";
import { cn } from "@/lib/cn";
import { POPULAR_CATEGORY_VALUES, categoryHref, findCategoryByValue } from "@/lib/free-fire-categories";
import { CATEGORY_VISUALS } from "./category-visuals";

/** Horizontally scrollable shortcut chips. The first (top) category is highlighted. */
export function PopularCategoryChips({ onViewAll }: { onViewAll: () => void }) {
  const reduce = useReducedMotion();
  return (
    <section aria-labelledby="popular-title">
      <div className="mb-3 flex items-center justify-between">
        <h2 id="popular-title" className="flex items-center gap-2 text-base font-bold text-white">
          <Flame className="h-5 w-5 text-gold" aria-hidden /> Popular Categories
        </h2>
        <button
          type="button"
          onClick={onViewAll}
          className="flex items-center gap-1 rounded-lg px-1 py-1 text-xs font-semibold text-cobalt focus-visible:outline-2 focus-visible:outline-cobalt"
        >
          View All <ArrowRight className="h-3.5 w-3.5" aria-hidden />
        </button>
      </div>

      <ul className="no-scrollbar -mx-4 flex gap-2.5 overflow-x-auto px-4 py-1">
        {POPULAR_CATEGORY_VALUES.map((v, i) => {
          const cat = findCategoryByValue(v)!;
          const Icon = CATEGORY_VISUALS[v].icon;
          const featured = i === 0;
          return (
            <li key={v} className="shrink-0">
              <motion.div whileTap={reduce ? undefined : { scale: 0.95 }} whileHover={reduce ? undefined : { y: -1 }}>
                <Link
                  href={categoryHref(v)}
                  className={cn(
                    "inline-flex h-11 items-center gap-2 rounded-full border px-4 text-sm font-semibold text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt",
                    featured
                      ? "border-gold/70 bg-gold/15 shadow-[0_0_18px_-4px_rgba(255,122,0,0.75)]"
                      : "border-white/10 bg-elevated hover:border-cobalt/50"
                  )}
                >
                  <Icon className={cn("h-4 w-4", featured ? "text-gold" : "text-cobalt")} aria-hidden /> {cat.label}
                </Link>
              </motion.div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
