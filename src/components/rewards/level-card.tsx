"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import type { LoyaltySummary } from "@/hooks/use-loyalty";

/** Tier name, progress bar and "X XP to NEXT". Solid colours only (no transparency layers). */
export function LevelCard({ data, href, className }: { data: LoyaltySummary; href?: string; className?: string }) {
  const { level, next, progressPct, xp } = data;
  const body = (
    <div className={cn("force-dark rounded-2xl border border-[#2A3555] bg-gradient-to-br from-[#2A1F2E] to-[#121A30] p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-lg font-black tracking-wide text-white uppercase">{level.name}</p>
        {href && <ChevronRight className="h-5 w-5 text-white/50" />}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-2.5 flex-1 rounded-full bg-[#0B1224] overflow-hidden"
          role="progressbar"
          aria-label="XP progress to next level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-[#F97316] to-[#FBBF24]" style={{ width: `${Math.max(progressPct, 3)}%` }} />
        </div>
        <p className="shrink-0 text-xs text-white">
          {next ? (
            <>
              <b>{formatXp(next.xpToNext)} XP</b> to <span className="text-white/70 uppercase">{next.name}</span>
            </>
          ) : (
            <b>Top level · {formatXp(xp)} XP</b>
          )}
        </p>
      </div>
      {next && next.rewardPaise > 0 && (
        <p className="mt-2 text-[11px] text-white/60">Reach {next.name} to get a {formatPaise(next.rewardPaise)} rebate in your bonus balance.</p>
      )}
    </div>
  );
  return href ? (
    <Link href={href} className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet/60">
      {body}
    </Link>
  ) : (
    body
  );
}

export const formatXp = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n % 1000 === 0 ? 0 : 2).replace(/0$/, "")}K` : String(n));
