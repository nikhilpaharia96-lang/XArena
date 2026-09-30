"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, Trophy, Users } from "lucide-react";
import { categoryHref, findCategoryByValue, type FreeFireCategoryValue } from "@/lib/free-fire-categories";
import { formatPaise } from "@/lib/format";
import { CATEGORY_VISUALS } from "./category-visuals";
import { CategoryArt } from "./category-art";

export function CategoryCard({
  value,
  activeCount,
  prizePool,
  index = 0,
}: {
  value: FreeFireCategoryValue;
  activeCount: number;
  prizePool: number;
  index?: number;
}) {
  const cat = findCategoryByValue(value)!;
  const reduce = useReducedMotion();
  const { accent } = CATEGORY_VISUALS[value];

  return (
    <motion.li
      layout={!reduce}
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? undefined : { opacity: 0, scale: 0.97 }}
      transition={{ duration: 0.25, delay: reduce ? 0 : Math.min(index * 0.04, 0.3) }}
      className="list-none"
    >
      <Link
        href={categoryHref(value)}
        aria-label={`${cat.label} tournaments — ${activeCount} active`}
        className="group block h-full rounded-[20px] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-cobalt"
      >
        <motion.div
          whileTap={reduce ? undefined : { scale: 0.97 }}
          whileHover={reduce ? undefined : { y: -3 }}
          transition={{ duration: 0.15 }}
          style={{ "--accent": accent } as React.CSSProperties}
          className="neon-card flex h-full min-h-[286px] flex-col overflow-hidden rounded-[20px] bg-elevated"
        >
          <div className="h-[112px] shrink-0">
            <CategoryArt value={value} sizes="(min-width: 1024px) 22vw, (min-width: 640px) 30vw, 46vw" priority={index < 2} />
          </div>

          <div className="flex flex-1 flex-col gap-2 p-2.5 pt-1">
            <div className="min-h-[58px]">
              <h3 className="text-[15px] font-extrabold uppercase leading-tight tracking-tight text-white line-clamp-2">{cat.label}</h3>
              <p className="mt-1 text-[11px] leading-snug text-[#94A3B8] line-clamp-2">{cat.description}</p>
            </div>

            <div className="mt-auto flex items-center justify-between text-[11px] font-semibold">
              <span className="flex items-center gap-1 text-cobalt">
                <Users className="h-3.5 w-3.5" aria-hidden /> {activeCount} Active
              </span>
              <span className="flex items-center gap-1 text-gold">
                <Trophy className="h-3.5 w-3.5" aria-hidden /> {formatPaise(prizePool)}
              </span>
            </div>

            <span className="gradient-cta-blue flex h-[42px] w-full items-center justify-center gap-1 whitespace-nowrap rounded-xl text-[12px] font-bold tracking-tight text-white transition-transform group-hover:brightness-110">
              View Tournaments <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </span>
          </div>
        </motion.div>
      </Link>
    </motion.li>
  );
}
