"use client";

import { useEffect, useState } from "react";
import { Bomb, Gem } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetInput, rupeesToPaise } from "./bet-input";
import { ResultBanner } from "./result-banner";
import { formatPaiseExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { newRequestId, originals, toastError, useRefreshMoney, type OriginalGame, type Round } from "@/hooks/use-originals";

const TILES = 25;

interface Live {
  mines: number;
  revealed: number[];
  currentMultiplierBps: number;
  currentPayout: number;
  nextMultiplierBps: number;
}

export function MinesGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
  const [bet, setBet] = useState("10");
  const [mines, setMines] = useState(3);
  const [busy, setBusy] = useState(false);
  const [round, setRound] = useState<Round | null>(null);
  const refresh = useRefreshMoney();

  // Resume an open round after a page refresh.
  useEffect(() => {
    originals.minesActive().then((r) => r.round && setRound(r.round)).catch(() => undefined);
  }, []);

  const active = round?.status === "ACTIVE";
  const live = (active ? round?.live : null) as Live | null;
  const result = round && round.status !== "ACTIVE" ? round.result : null;
  const revealed: number[] = live?.revealed ?? ((result?.revealed as number[] | undefined) ?? []);
  const mineTiles: number[] = (result?.mines as number[] | undefined) ?? [];
  const hit = result?.hit as number | undefined;
  const stake = rupeesToPaise(bet);

  const run = async (fn: () => Promise<Round>, settled: boolean) => {
    if (busy) return;
    setBusy(true);
    try {
      const r = await fn();
      setRound(r);
      refresh(settled || r.status !== "ACTIVE");
    } catch (e) {
      toastError(e);
      originals.minesActive().then((r) => setRound(r.round)).catch(() => undefined);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: TILES }, (_, i) => {
          const open = revealed.includes(i);
          const isMine = mineTiles.includes(i);
          return (
            <button
              key={i}
              type="button"
              aria-label={`Tile ${i + 1}`}
              disabled={!active || open || busy}
              onClick={() => run(() => originals.minesReveal(i), false)}
              className={cn(
                "aspect-square rounded-xl flex items-center justify-center border transition-colors",
                open ? "bg-signal/15 border-signal/40 text-signal" : isMine ? (hit === i ? "bg-crimson/30 border-crimson text-crimson" : "bg-crimson/10 border-crimson/30 text-crimson/70") : "bg-surface-2 border-white/10 hover:border-violet/50",
                !active && !open && !isMine && "opacity-60"
              )}
            >
              {open ? <Gem className="h-5 w-5" /> : isMine ? <Bomb className="h-5 w-5" /> : null}
            </button>
          );
        })}
      </div>

      {active && live ? (
        <>
          <div className="grid grid-cols-2 gap-3 text-center">
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[11px] text-white/40">Current payout</p>
              <p className="font-black text-white">{formatPaiseExact(live.currentPayout)}</p>
              <p className="text-[11px] text-white/40">{(live.currentMultiplierBps / 10_000).toFixed(2)}×</p>
            </div>
            <div className="rounded-xl bg-surface-2 p-3">
              <p className="text-[11px] text-white/40">Next tile</p>
              <p className="font-black text-white">{(live.nextMultiplierBps / 10_000).toFixed(2)}×</p>
              <p className="text-[11px] text-white/40">{live.mines} mines hidden</p>
            </div>
          </div>
          <Button fullWidth size="lg" variant="cta" loading={busy} disabled={live.revealed.length < 1} onClick={() => run(() => originals.minesCashout(), true)}>
            Cash out {live.revealed.length ? formatPaiseExact(live.currentPayout) : ""}
          </Button>
        </>
      ) : (
        <>
          <div>
            <div className="flex justify-between text-xs text-white/60 mb-1.5">
              <span>Mines</span>
              <span className="font-bold text-white">{mines}</span>
            </div>
            <input type="range" min={1} max={24} value={mines} onChange={(e) => setMines(Number(e.target.value))} className="w-full accent-violet" aria-label="Number of mines" />
          </div>
          <BetInput value={bet} onChange={setBet} min={cfg.minBet} max={cfg.maxBet} balance={balance} disabled={busy} />
          <Button
            fullWidth
            size="lg"
            variant="cta"
            loading={busy}
            disabled={stake < cfg.minBet || stake > cfg.maxBet}
            onClick={() => run(() => originals.minesStart({ bet: stake, mines, requestId: newRequestId() }), false)}
          >
            Start game
          </Button>
        </>
      )}
      <ResultBanner round={round} />
    </Card>
  );
}
