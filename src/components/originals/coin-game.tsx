"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetInput, rupeesToPaise } from "./bet-input";
import { ResultBanner } from "./result-banner";
import { cn } from "@/lib/cn";
import { newRequestId, originals, toastError, useRefreshMoney, type OriginalGame, type Round } from "@/hooks/use-originals";

export function CoinGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
  const [bet, setBet] = useState("10");
  const [pick, setPick] = useState<"HEADS" | "TAILS">("HEADS");
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const refresh = useRefreshMoney();
  const stake = rupeesToPaise(bet);
  const mult = (2 * (10_000 - cfg.houseEdgeBps)) / 10_000;
  const side = round?.result ? String(round.result.side) : null;

  const play = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await originals.coin({ bet: stake, pick, requestId: newRequestId() });
      setRound(r);
      refresh();
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="flex flex-col items-center gap-2 py-4">
        <div
          className={cn(
            "h-28 w-28 rounded-full flex items-center justify-center text-lg font-black border-4 transition-colors",
            side === null ? "bg-surface-2 border-white/10 text-white/40" : round?.status === "WON" ? "bg-signal/15 border-signal text-signal" : "bg-crimson/15 border-crimson text-crimson"
          )}
        >
          {side ?? "?"}
        </div>
        <p className="text-xs text-white/50">Pays {mult.toFixed(2)}× on a correct call</p>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {(["HEADS", "TAILS"] as const).map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => setPick(s)}
            className={cn("h-11 rounded-xl text-sm font-bold border", pick === s ? "gradient-brand text-white border-transparent" : "bg-surface-2 text-white/60 border-white/10")}
          >
            {s === "HEADS" ? "Heads" : "Tails"}
          </button>
        ))}
      </div>
      <BetInput value={bet} onChange={setBet} min={cfg.minBet} max={cfg.maxBet} balance={balance} disabled={busy} />
      <Button fullWidth size="lg" variant="cta" loading={busy} disabled={stake < cfg.minBet || stake > cfg.maxBet} onClick={play}>
        Flip coin
      </Button>
      <ResultBanner round={round} />
    </Card>
  );
}
