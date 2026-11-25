"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetInput, rupeesToPaise } from "../bet-input";
import { DEMO_START, ModeBar, Outcome, roundOutcome, useDemoWallet } from "./demo-wallet";
import { cn } from "@/lib/cn";
import { GEM_NAMES, GEM_REELS, GEM_ROWS, gemPairMultBps, gemTripleMultBps } from "@/server/games/table-math";
import { newRequestId, originals, toastError, useRefreshMoney, type DemoOutcome, type GemsOutcome, type OriginalGame } from "@/hooks/use-originals";

const GEM_COLORS = ["#7DE3FF", "#F0405A", "#22C768", "#3B82F6", "#A855F7", "#F5B921"];

function Gem({ i, dim }: { i: number; dim?: boolean }) {
  const c = GEM_COLORS[i];
  return (
    <svg viewBox="0 0 48 48" className={cn("h-full w-full transition-opacity", dim && "opacity-40")} aria-label={GEM_NAMES[i]} role="img">
      <polygon points="24,3 42,17 24,45 6,17" fill={c} stroke="rgba(255,255,255,.55)" strokeWidth="1.5" />
      <polygon points="24,3 33,17 24,45 15,17" fill="rgba(255,255,255,.28)" />
      <polygon points="6,17 42,17 24,10" fill="rgba(255,255,255,.18)" />
    </svg>
  );
}

const randGrid = () => Array.from({ length: GEM_ROWS }, () => Array.from({ length: GEM_REELS }, () => Math.floor(Math.random() * 6)));

export function GemsGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
  const w = useDemoWallet(cfg, balance);
  const refresh = useRefreshMoney();
  const [bet, setBet] = useState("10");
  const [busy, setBusy] = useState(false);
  const [grid, setGrid] = useState<number[][]>(randGrid);
  const [stopped, setStopped] = useState(GEM_REELS);
  const [out, setOut] = useState<{ r: DemoOutcome<GemsOutcome>; bet: number } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const stake = rupeesToPaise(bet);
  const ok = stake >= cfg.minBet && stake <= cfg.maxBet && stake <= w.shown;
  const winRows = new Set(out?.r.result.wins.map((x) => x.row));

  const spin = async () => {
    if (busy || !ok) return;
    setBusy(true);
    setOut(null);
    setStopped(0);
    if (w.demo) w.setDemoBal((b) => b - stake);
    timer.current = setInterval(() => setGrid((g) => g.map((row) => row.map(() => Math.floor(Math.random() * 6)))), 80);
    try {
      const [r] = await Promise.all([
        w.demo ? originals.gemsDemo(stake) : originals.gemsPlay({ bet: stake, requestId: newRequestId() }).then((x) => roundOutcome<GemsOutcome>(x)),
        new Promise((res) => setTimeout(res, 700)),
      ]);
      const final = r.result.grid;
      for (let reel = 1; reel <= GEM_REELS; reel++) {
        await new Promise((res) => setTimeout(res, 260));
        setStopped(reel);
        setGrid((g) => g.map((row, ri) => row.map((v, ci) => (ci < reel ? final[ri][ci] : v))));
      }
      if (timer.current) clearInterval(timer.current);
      if (w.demo) w.setDemoBal((b) => b + r.payout);
      else refresh();
      setOut({ r, bet: stake });
    } catch (e) {
      if (w.demo) w.setDemoBal((b) => b + stake);
      setStopped(GEM_REELS);
      toastError(e);
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <ModeBar w={w} disabled={busy} />
      <div className="rounded-2xl p-3 bg-gradient-to-b from-[#1B1442] to-[#0B1224] border border-white/10">
        <p className="text-center text-xs font-black tracking-[0.25em] text-gold mb-2">FORTUNE GEMS</p>
        <div className="grid gap-2" style={{ gridTemplateRows: `repeat(${GEM_ROWS}, 1fr)` }}>
          {grid.map((row, r) => (
            <div key={r} className={cn("grid grid-cols-3 gap-2 rounded-xl p-1.5 border", winRows.has(r) ? "border-gold bg-gold/10" : "border-white/10 bg-black/20")}>
              {row.map((g, c) => (
                <div key={c} className={cn("aspect-square p-1.5", busy && c >= stopped && "animate-pulse")}>
                  <Gem i={g} dim={!!out && !winRows.has(r)} />
                </div>
              ))}
            </div>
          ))}
        </div>
        <p className="text-center text-[11px] text-white/50 mt-2">Three lines, a third of your bet on each. Match from the left.</p>
      </div>
      <BetInput value={bet} onChange={setBet} min={cfg.minBet} max={cfg.maxBet} balance={w.shown} disabled={busy} />
      <Button fullWidth size="lg" variant="cta" loading={busy} disabled={!ok} onClick={spin}>Spin</Button>
      {stake > w.shown && <p className="text-xs text-crimson text-center">{w.demo ? `Demo credits low. Reload to restart with ${DEMO_START / 100}.` : "Add cash to your wallet to play."}</p>}
      {out && <Outcome won={out.r.payout > 0} bet={out.bet} payout={out.r.payout} />}
      <details className="rounded-xl bg-surface-2 border border-white/10 p-3 text-xs text-white/70">
        <summary className="cursor-pointer font-bold text-white">Paytable (per line, × the line stake)</summary>
        <div className="mt-2 space-y-1">
          {GEM_NAMES.map((n, i) => (
            <div key={n} className="flex items-center gap-2">
              <span className="h-5 w-5"><Gem i={i} /></span>
              <span className="flex-1">{n}</span>
              <span className="tabular-nums">2×: {(gemPairMultBps(i, cfg.houseEdgeBps) / 10_000).toFixed(2)}</span>
              <span className="tabular-nums w-24 text-right">3×: {(gemTripleMultBps(i, cfg.houseEdgeBps) / 10_000).toFixed(0)}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 text-white/40">Designed to return {(100 - cfg.houseEdgeBps / 100).toFixed(1)}% of all bets over time.</p>
      </details>
    </Card>
  );
}
