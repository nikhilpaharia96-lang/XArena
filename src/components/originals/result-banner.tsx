"use client";

import { formatPaiseExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { Round } from "@/hooks/use-originals";

export function ResultBanner({ round }: { round: Round | null }) {
  if (!round || round.status === "ACTIVE") return null;
  const won = round.status === "WON";
  return (
    <div
      role="status"
      className={cn(
        "rounded-xl px-4 py-3 text-center text-sm font-bold border",
        won ? "bg-signal/10 border-signal/30 text-signal" : round.status === "VOID" ? "bg-white/5 border-white/10 text-white/70" : "bg-crimson/10 border-crimson/30 text-crimson"
      )}
    >
      {won
        ? `You won ${formatPaiseExact(round.payout)} (${(round.multiplierBps / 10_000).toFixed(2)}×)`
        : round.status === "VOID"
          ? "Round voided - stake refunded"
          : `You lost ${formatPaiseExact(round.bet)}`}
    </div>
  );
}
