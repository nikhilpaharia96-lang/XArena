"use client";

import { Check, Crown, Lock } from "lucide-react";
import { useRequireAuth } from "@/hooks/use-require-auth";
import { useLoyalty } from "@/hooks/use-loyalty";
import { LevelCard, formatExp } from "@/components/rewards/level-card";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/cn";
import { formatPaise, formatDateTime } from "@/lib/format";

const pct = (bps: number) => `${(bps / 100).toFixed(2)}%`;

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
  const lvl = data.levels.find((l) => l.level === data.level);

  return (
    <div className="mx-auto w-full max-w-xl pb-6 space-y-5">
      <div>
        <h1 className="flex items-center gap-2.5 text-3xl font-black text-white">
          <Crown className="h-7 w-7 text-gold" /> VIP
        </h1>
        <p className="text-sm text-white/60 mt-1">Play, earn EXP, level up. VIP rewards are settled at 2:00 AM on the 1st of every month.</p>
      </div>

      <LevelCard data={data} />

      <Card className="p-4">
        <h2 className="font-bold text-white">{m.label} so far</h2>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="EXP earned" value={formatExp(m.exp)} />
          <Stat label="Rebate so far" value={formatPaise(m.expectedRebatePaise)} />
          <Stat label="Monthly reward" value={formatPaise(m.expectedMonthlyPaise)} />
        </div>
        <p className="mt-3 text-xs text-white/55">
          {lvl
            ? `At VIP ${lvl.level} you get ${pct(lvl.rebateBps)} of what you bet back, plus the monthly reward if you play this month. Paid on ${m.settleLabel} (IST).`
            : "Reach VIP 1 to start earning a monthly reward and rebate on your bets."}
        </p>
      </Card>

      <div className="space-y-3">
        {data.levels.map((l) => {
          const current = l.level === data.level;
          return (
            <Card key={l.level} className={cn("p-4", current && "ring-1 ring-gold")}>
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-white">VIP {l.level}</h3>
                <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold", current ? "bg-gold text-black" : l.reached ? "bg-signal text-black" : "bg-[#1B2440] text-white/60")}>
                  {l.reached ? <Check className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                  {current ? "Your level" : l.reached ? "Unlocked" : "Not open yet"}
                </span>
              </div>
              <p className="mt-1 text-xs text-white/55">
                Upgrading VIP {l.level} requires {formatExp(l.expRequired)} EXP · Bet ₹1 = 1 EXP
              </p>
              {!l.reached && (
                <div className="mt-2">
                  <div className="h-1.5 rounded-full bg-[#0B1224] overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#F97316] to-[#FBBF24]" style={{ width: `${Math.min(100, (data.exp / l.expRequired) * 100)}%` }} />
                  </div>
                  <p className="mt-1 text-[11px] text-white/45">{formatExp(Math.min(data.exp, l.expRequired))} / {formatExp(l.expRequired)}</p>
                </div>
              )}
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                <Stat label="Level-up reward" value={formatPaise(l.levelUpRewardPaise)} note={l.paid ? "Received" : "Once per account"} />
                <Stat label="Monthly reward" value={formatPaise(l.monthlyRewardPaise)} note="Once per month" />
                <Stat label="Rebate rate" value={pct(l.rebateBps)} note="On your bets" />
              </div>
            </Card>
          );
        })}
      </div>

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

      <p className="text-[11px] text-white/45 leading-relaxed">
        EXP counts tournament entry fees and game bets, minus any refunds; deposits and winnings do not count. Rewards are added to your bonus balance, which you can use to play but cannot withdraw directly;
        anything you win from it is yours. Settlement happens once a month, so a level you reach this month is paid on the 1st. Rewards can change or be withdrawn at any time. 18+ only.
      </p>
    </div>
  );
}

function Stat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div className="force-dark rounded-xl bg-[#0B1224] border border-[#26314F] px-2 py-2.5">
      <p className="text-[10px] uppercase tracking-wide text-white/50">{label}</p>
      <p className="mt-0.5 text-sm font-black text-gold">{value}</p>
      {note && <p className="text-[10px] text-white/45">{note}</p>}
    </div>
  );
}
