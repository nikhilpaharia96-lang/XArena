"use client";

import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetInput, rupeesToPaise } from "./bet-input";
import { ResultBanner } from "./result-banner";
import { formatPaiseExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { newRequestId, originals, toastError, useRefreshMoney, type OriginalGame, type Round } from "@/hooks/use-originals";

const BPS = 10_000;

export function DiceGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
  const [bet, setBet] = useState("10");
  const [direction, setDirection] = useState<"UNDER" | "OVER">("UNDER");
  const [chance, setChance] = useState(50); // percent
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const refresh = useRefreshMoney();

  const chanceBps = Math.round(chance * 100);
  const mult = Math.floor(((BPS - cfg.houseEdgeBps) * BPS) / chanceBps);
  const stake = rupeesToPaise(bet);
  const payout = Math.floor((stake * mult) / BPS);
  const roll = round?.result ? Number(round.result.roll) / 100 : null;
  const threshold = direction === "UNDER" ? chance : 100 - chance;

  const play = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await originals.dice({ bet: stake, direction, chanceBps, requestId: newRequestId() });
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
      <div className="relative h-24 rounded-xl bg-surface-2 border border-white/10 flex items-center justify-center overflow-hidden">
        <div
          className={cn("absolute inset-y-0 bg-signal/15", direction === "UNDER" ? "left-0" : "right-0")}
          style={{ width: `${chance}%` }}
        />
        <span className={cn("relative text-5xl font-black tabular-nums", round?.status === "WON" ? "text-signal" : round?.status === "LOST" ? "text-crimson" : "text-white")}>
          {roll === null ? "--.--" : roll.toFixed(2)}
        </span>
        {roll !== null && <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: `${roll}%` }} />}
      </div>

      <div className="grid grid-cols-2 gap-2">
        {(["UNDER", "OVER"] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDirection(d)}
            className={cn("h-10 rounded-xl text-sm font-bold border", direction === d ? "gradient-brand text-white border-transparent" : "bg-surface-2 text-white/60 border-white/10")}
          >
            Roll {d === "UNDER" ? "Under" : "Over"} {d === "UNDER" ? threshold.toFixed(2) : threshold.toFixed(2)}
          </button>
        ))}
      </div>

      <div>
        <div className="flex justify-between text-xs text-white/60 mb-1.5">
          <span>Win chance</span>
          <span className="font-bold text-white">{chance.toFixed(2)}%</span>
        </div>
        <input
          type="range"
          min={1}
          max={95}
          step={0.5}
          value={chance}
          onChange={(e) => setChance(Number(e.target.value))}
          className="w-full accent-violet"
          aria-label="Win chance"
        />
      </div>

      <div className="grid grid-cols-2 gap-3 text-center">
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] text-white/40">Multiplier</p>
          <p className="font-black text-white">{(mult / BPS).toFixed(4)}×</p>
        </div>
        <div className="rounded-xl bg-surface-2 p-3">
          <p className="text-[11px] text-white/40">Payout if you win</p>
          <p className="font-black text-white">{formatPaiseExact(Math.min(payout, cfg.maxPayout))}</p>
        </div>
      </div>

      <BetInput value={bet} onChange={setBet} min={cfg.minBet} max={cfg.maxBet} balance={balance} disabled={busy} />
      <Button fullWidth size="lg" variant="cta" loading={busy} disabled={stake < cfg.minBet || stake > cfg.maxBet || payout > cfg.maxPayout} onClick={play}>
        Roll dice
      </Button>
      {payout > cfg.maxPayout && <p className="text-xs text-crimson text-center">Payout above the table limit of {formatPaiseExact(cfg.maxPayout)}. Lower the bet or raise the chance.</p>}
      <ResultBanner round={round} />
    </Card>
  );
}
