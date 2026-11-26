"use client";

import Link from "next/link";
import { Check, Crown, Gift, Target, Wallet } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useLoyalty } from "@/hooks/use-loyalty";
import { LevelCard } from "@/components/rewards/level-card";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatPaise, formatDateTime } from "@/lib/format";

export default function RewardsPage() {
  useRequireAuth();
  const { data, isLoading } = useLoyalty();

  if (isLoading || !data) {
    return (
      <div className="space-y-4 max-w-xl mx-auto">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-28 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  const m = data.month;
  const topTarget = m.milestones[m.milestones.length - 1].targetPaise;

  return (
    <div className="mx-auto w-full max-w-xl pb-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2.5 text-3xl font-black text-white">
          <Crown className="h-7 w-7 text-gold" /> Rewards
        </h1>
        <p className="text-sm text-white/60 mt-1">Add money, earn XP, level up and collect rebates.</p>
      </div>

      <LevelCard data={data} />

      <Card className="p-4">
        <div className="flex items-center gap-2">
          <Target className="h-5 w-5 text-gold" />
          <h2 className="font-bold text-white">{m.label} target</h2>
          <span className="ml-auto text-xs text-white/50">Resets on the 1st</span>
        </div>
        <p className="mt-2 text-2xl font-black text-white">
          {formatPaise(m.depositedPaise)}
          <span className="text-sm font-semibold text-white/50"> added this month</span>
        </p>
        <div
          className="mt-3 h-2.5 rounded-full bg-[#0B1224] overflow-hidden"
          role="progressbar"
          aria-label="Monthly deposit progress"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(Math.min(100, (m.depositedPaise / topTarget) * 100))}
        >
          <div className="h-full rounded-full bg-gradient-to-r from-[#F97316] to-[#FBBF24]" style={{ width: `${Math.min(100, (m.depositedPaise / topTarget) * 100)}%` }} />
        </div>
        <ul className="mt-4 space-y-2">
          {m.milestones.map((t) => (
            <li key={t.targetPaise} className={cn("force-dark flex items-center gap-3 rounded-xl border px-3 py-2.5", t.reached ? "border-signal/40 bg-[#10261B]" : "border-[#26314F] bg-[#0B1224]")}>
              <span className={cn("h-7 w-7 rounded-full flex items-center justify-center shrink-0", t.reached ? "bg-signal text-black" : "bg-[#1B2440] text-white/50")}>
                {t.reached ? <Check className="h-4 w-4" /> : <Gift className="h-4 w-4" />}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white">Add {formatPaise(t.targetPaise)}</p>
                <p className="text-xs text-white/55">{t.reached ? (t.paid ? "Rebate credited" : "Reached") : `${formatPaise(t.targetPaise - m.depositedPaise)} to go`}</p>
              </div>
              <span className="text-sm font-black text-gold">+{formatPaise(t.rewardPaise)}</span>
            </li>
          ))}
        </ul>
        <Link href="/wallet/deposit" className="block mt-4">
          <Button fullWidth variant="cta">
            <Wallet className="h-4 w-4" /> Add money
          </Button>
        </Link>
      </Card>

      <Card className="p-4">
        <h2 className="font-bold text-white mb-1">Levels</h2>
        <p className="text-xs text-white/55 mb-3">₹1 added = 1 XP. Every level-up pays a one-time rebate.</p>
        <ul className="divide-y divide-[#1B2440]">
          {data.levels.map((l) => {
            const current = l.index === data.level.index;
            return (
              <li key={l.index} className="flex items-center gap-3 py-2.5">
                <span className={cn("h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-black shrink-0", current ? "bg-gold text-black" : l.reached ? "bg-signal text-black" : "bg-[#1B2440] text-white/50")}>
                  {l.reached && !current ? <Check className="h-4 w-4" /> : l.index + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className={cn("text-sm font-semibold", l.reached ? "text-white" : "text-white/60")}>
                    {l.name} {current && <span className="ml-1 rounded-full bg-gold px-1.5 py-0.5 text-[10px] font-black text-black">YOU</span>}
                  </p>
                  <p className="text-xs text-white/45">{l.minXp.toLocaleString("en-IN")} XP · ₹{l.minXp.toLocaleString("en-IN")} added</p>
                </div>
                <span className={cn("text-sm font-bold", l.rewardPaise ? (l.paid ? "text-signal" : "text-gold") : "text-white/30")}>
                  {l.rewardPaise ? (l.paid ? `+${formatPaise(l.rewardPaise)} ✓` : `+${formatPaise(l.rewardPaise)}`) : "Start"}
                </span>
              </li>
            );
          })}
        </ul>
      </Card>

      {data.recent.length > 0 && (
        <Card className="p-4">
          <h2 className="font-bold text-white mb-2">Rewards you got · {formatPaise(data.earnedPaise)}</h2>
          <ul className="divide-y divide-[#1B2440]">
            {data.recent.map((r, i) => (
              <li key={i} className="flex items-center justify-between py-2 text-sm">
                <span className="text-white">
                  {r.label}
                  <span className="block text-[11px] text-white/45">{formatDateTime(r.createdAt)}</span>
                </span>
                <span className="font-bold text-signal">+{formatPaise(r.amount)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      <Link href="/vip" className="block rounded-2xl border border-[#26314F] bg-[#0B1224] p-4 force-dark">
        <p className="font-bold text-white">VIP levels: earn on every bet</p>
        <p className="mt-0.5 text-xs text-white/60">Bet ₹1 = 1 EXP. VIP 1 to 10 with monthly rewards and rebates, settled at 2:00 AM on the 1st.</p>
      </Link>

      <p className="text-[11px] text-white/45 leading-relaxed">
        XP comes from approved deposits only. Rebates are added to your bonus balance, which you can use to play but cannot withdraw directly; anything you win from it is yours.
        Monthly targets count deposits made from the 1st to the last day of the month (India time). Rewards can change or be withdrawn at any time. 18+ only.
      </p>
    </div>
  );
}
