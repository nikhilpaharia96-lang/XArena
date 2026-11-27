"use client";
import { useState } from "react";
import { Check, Gift } from "lucide-react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import type { BonusGrantItem, BonusOfferItem } from "@/hooks/use-wallet";
import { formatPaiseExact } from "@/lib/format";

export const bonusFor = (o: BonusOfferItem, rupees: number) =>
  rupees * 100 < o.minDeposit ? 0 : Math.min(Math.floor((rupees * 100 * o.bonusPercent) / 100), o.maxBonus);

/** Pick a deposit bonus. Tapping the selected card again turns it off. */
export function BonusOffers({ offers, amount, selected, onSelect }: {
  offers: BonusOfferItem[]; amount: number | ""; selected: string | null; onSelect: (id: string | null) => void;
}) {
  if (offers.length === 0) return null;
  return (
    <Card className="p-4">
      <p className="text-sm font-bold text-white mb-1 flex items-center gap-1.5"><Gift className="h-4 w-4 text-gold" /> Deposit bonus</p>
      <p className="text-[11px] text-white/55 mb-3">Optional. Rolling = how many times the bonus must be played before it can be withdrawn.</p>
      <div className="grid grid-cols-1 gap-2.5" role="radiogroup" aria-label="Deposit bonus">
        {offers.map((o) => {
          const on = selected === o.id;
          const eligible = amount !== "" && amount * 100 >= o.minDeposit;
          const get = amount === "" ? 0 : bonusFor(o, amount);
          return (
            <button
              key={o.id}
              type="button"
              role="radio"
              aria-checked={on}
              onClick={() => onSelect(on ? null : o.id)}
              className={cn(
                "relative rounded-2xl border p-3.5 text-left transition-colors min-h-[84px]",
                on ? "border-gold bg-gold/10" : "border-white/10 bg-white/[0.04] active:bg-white/10"
              )}
            >
              {on && <span className="absolute right-3 top-3 h-5 w-5 rounded-full bg-gold flex items-center justify-center"><Check className="h-3.5 w-3.5 text-black" strokeWidth={3} /></span>}
              <p className="text-xs font-bold text-gold uppercase tracking-wide">{o.title}</p>
              <div className="mt-1.5 grid grid-cols-3 gap-2 pr-6">
                <div><p className="text-[11px] text-white/50">Bonus</p><p className="text-lg font-black text-white">{o.bonusPercent}%</p></div>
                <div><p className="text-[11px] text-white/50">Rolling</p><p className="text-lg font-black text-white">{o.rollingX}X</p></div>
                <div><p className="text-[11px] text-white/50">Max bonus</p><p className="text-lg font-black text-white">₹{(o.maxBonus / 100).toLocaleString("en-IN")}</p></div>
              </div>
              <p className="mt-2 text-[11px] font-semibold text-white/70">
                {o.validDays > 0 ? `Valid for ${o.validDays} days` : "Instant — no rolling"} · min deposit ₹{o.minDeposit / 100}
              </p>
              {on && eligible && <p className="mt-1.5 text-sm font-black text-signal">You get +₹{(get / 100).toLocaleString("en-IN")} bonus</p>}
              {on && amount !== "" && !eligible && <p className="mt-1.5 text-xs font-bold text-crimson">Add at least ₹{o.minDeposit / 100} to get this bonus</p>}
            </button>
          );
        })}
      </div>
    </Card>
  );
}

/** Rolling progress of the player's running bonuses. */
export function BonusProgress({ grants }: { grants: BonusGrantItem[] }) {
  const [now] = useState(() => Date.now());
  const active = grants.filter((g) => g.status === "ACTIVE");
  if (active.length === 0) return null;
  return (
    <div className="space-y-2.5">
      {active.map((g) => {
        const pct = g.requiredWager > 0 ? Math.min(100, Math.round((g.wagered / g.requiredWager) * 100)) : 100;
        const days = g.expiresAt ? Math.max(0, Math.ceil((new Date(g.expiresAt).getTime() - now) / 86_400_000)) : null;
        return (
          <Card key={g.id} className="p-4">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold text-white flex items-center gap-1.5"><Gift className="h-4 w-4 text-gold" /> {g.title} · {formatPaiseExact(g.bonusAmount)}</p>
              {days !== null && <span className="text-[11px] font-semibold text-white/60">{days}d left</span>}
            </div>
            <div className="mt-2.5 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full gradient-cta" style={{ width: `${pct}%` }} /></div>
            <p className="mt-1.5 text-[11px] text-white/60">Rolled {formatPaiseExact(g.wagered)} of {formatPaiseExact(g.requiredWager)} ({g.rollingX}x) — play to unlock for withdrawal</p>
          </Card>
        );
      })}
    </div>
  );
}
