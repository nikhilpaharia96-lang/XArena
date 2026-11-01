"use client";

import { Card } from "@/components/ui/card";
import { formatDateTime, formatPaiseExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { useOriginalsHistory } from "@/hooks/use-originals";

const NAMES = { DICE: "Dice", COINFLIP: "Coin Flip", MINES: "Mines", CRASH: "Crash", SLOT: "Garuda Ascent", COINS: "Lakshmi Coins" } as const;

export function HistoryList() {
  const { data } = useOriginalsHistory();
  const rounds = data?.rounds ?? [];
  return (
    <Card className="p-5">
      <h3 className="font-black text-white mb-3">My recent bets</h3>
      {rounds.length === 0 ? (
        <p className="text-xs text-white/40">No bets yet.</p>
      ) : (
        <ul className="divide-y divide-white/5">
          {rounds.slice(0, 12).map((r) => (
            <li key={r.id} className="py-2 flex items-center justify-between text-sm">
              <div>
                <p className="font-semibold text-white">{NAMES[r.game]}</p>
                <p className="text-[11px] text-white/40">{formatDateTime(r.createdAt)} · bet {formatPaiseExact(r.bet)}</p>
              </div>
              <span className={cn("font-bold", r.status === "WON" ? "text-signal" : r.status === "ACTIVE" ? "text-gold" : r.status === "VOID" ? "text-white/60" : "text-crimson")}>
                {r.status === "WON" ? `+${formatPaiseExact(r.payout - r.bet)}` : r.status === "ACTIVE" ? "Open" : r.status === "VOID" ? "Refunded" : `-${formatPaiseExact(r.bet)}`}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
