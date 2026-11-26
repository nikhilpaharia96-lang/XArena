"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatPaise } from "@/lib/format";
import type { VipSummary } from "@/hooks/use-vip";

export const formatExp = (n: number) => n.toLocaleString("en-IN");

/** VIP tier, EXP progress bar and "X EXP to VIP N". Solid colours only. */
export function VipCard({ data, href, className }: { data: VipSummary; href?: string; className?: string }) {
  const { level, next, progressPct, exp } = data;
  const body = (
    <div className={cn("force-dark rounded-2xl border border-[#2A3555] bg-gradient-to-br from-[#2A1F2E] to-[#121A30] p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-lg font-black tracking-wide text-white uppercase">VIP {level}</p>
        {href && <ChevronRight className="h-5 w-5 text-white/50" />}
      </div>
      <div className="mt-3 flex items-center gap-3">
        <div
          className="h-2.5 flex-1 rounded-full bg-[#0B1224] overflow-hidden"
          role="progressbar"
          aria-label="EXP progress to next VIP level"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(progressPct)}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-[#F97316] to-[#FBBF24]" style={{ width: `${Math.max(progressPct, 3)}%` }} />
        </div>
        <p className="shrink-0 text-xs text-white">
          {next ? (
            <>
              <b>{formatExp(next.expToNext)} EXP</b> to <span className="text-white/70 uppercase">VIP {next.level}</span>
            </>
          ) : (
            <b>Top level · {formatExp(exp)} EXP</b>
          )}
        </p>
      </div>
      {next && <p className="mt-2 text-[11px] text-white/60">Reach VIP {next.level} for a {formatPaise(next.levelUpRewardPaise)} reward. Bet ₹1 = 1 EXP.</p>}
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
