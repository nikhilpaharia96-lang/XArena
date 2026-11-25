"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { DEMO_START, ModeBar, Outcome, roundOutcome, useDemoWallet } from "./demo-wallet";
import { cn } from "@/lib/cn";
import { formatPaiseExact } from "@/lib/format";
import { isRed, rouletteBetWins, rouletteMultiplierBps, ROULETTE_MAX_BETS, type RouletteBetType } from "@/server/games/table-math";
import { newRequestId, originals, toastError, useRefreshMoney, type DemoOutcome, type OriginalGame, type RouletteChip, type RouletteOutcome } from "@/hooks/use-originals";

const CHIPS = [1000, 5000, 10000, 50000]; // paise
const numColor = (n: number) => (n === 0 ? "bg-[#12A150]" : isRed(n) ? "bg-[#C62E3E]" : "bg-[#1F2937]");

interface Placed { type: RouletteBetType; number?: number; amount: number }
const keyOf = (type: string, number?: number) => (type === "STRAIGHT" ? `S${number}` : type);

const OUTSIDE: { type: RouletteBetType; label: string; cls?: string }[] = [
  { type: "LOW", label: "1–18" }, { type: "EVEN", label: "Even" }, { type: "RED", label: "Red", cls: "bg-[#C62E3E]" },
  { type: "BLACK", label: "Black", cls: "bg-[#1F2937]" }, { type: "ODD", label: "Odd" }, { type: "HIGH", label: "19–36" },
];

export function RouletteGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
  const w = useDemoWallet(cfg, balance);
  const refresh = useRefreshMoney();
  const [chip, setChip] = useState(CHIPS[0]);
  const [placed, setPlaced] = useState<Placed[]>([]);
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<number | null>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const [out, setOut] = useState<{ r: DemoOutcome<RouletteOutcome>; bet: number; bets: Placed[] } | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const stake = placed.reduce((a, b) => a + b.amount, 0);
  const ok = stake >= cfg.minBet && stake <= cfg.maxBet && stake <= w.shown && placed.length > 0;
  const amountOn = (type: string, number?: number) => placed.find((p) => keyOf(p.type, p.number) === keyOf(type, number))?.amount ?? 0;
  const winning = out ? out.r.result.number : null;

  const add = (type: RouletteBetType, number?: number) => {
    if (busy) return;
    setOut(null);
    setPlaced((p) => {
      const k = keyOf(type, number);
      const i = p.findIndex((x) => keyOf(x.type, x.number) === k);
      if (i >= 0) return p.map((x, j) => (j === i ? { ...x, amount: x.amount + chip } : x));
      if (p.length >= ROULETTE_MAX_BETS) return p;
      return [...p, { type, number, amount: chip }];
    });
  };

  const spin = async () => {
    if (busy || !ok) return;
    setBusy(true);
    setOut(null);
    const bets: RouletteChip[] = placed.map((p) => ({ type: p.type, number: p.number, amount: p.amount }));
    if (w.demo) w.setDemoBal((b) => b - stake);
    timer.current = setInterval(() => setShown(Math.floor(Math.random() * 37)), 70);
    try {
      const [r] = await Promise.all([
        w.demo ? originals.rouletteDemo(bets) : originals.roulettePlay({ bets, requestId: newRequestId() }).then((x) => roundOutcome<RouletteOutcome>(x)),
        new Promise((res) => setTimeout(res, 1100)),
      ]);
      if (w.demo) w.setDemoBal((b) => b + r.payout);
      else refresh();
      setShown(r.result.number);
      setRecent((x) => [r.result.number, ...x].slice(0, 12));
      setOut({ r, bet: stake, bets: placed });
    } catch (e) {
      if (w.demo) w.setDemoBal((b) => b + stake);
      setShown(null);
      toastError(e);
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
    }
  };

  const cell = (type: RouletteBetType, label: string, number?: number, cls?: string, extra?: string) => {
    const amt = amountOn(type, number);
    const hit = winning !== null && rouletteBetWins({ type, number }, winning);
    return (
      <button
        key={keyOf(type, number)}
        type="button"
        disabled={busy}
        onClick={() => add(type, number)}
        className={cn("relative h-9 rounded-md text-[11px] font-bold text-white border flex items-center justify-center", cls ?? "bg-surface-2", hit ? "border-gold ring-1 ring-gold" : "border-white/15", extra)}
      >
        {label}
        {amt > 0 && <span className="absolute -top-1.5 -right-1 min-w-4 h-4 px-1 rounded-full bg-gold text-[9px] leading-4 text-black font-black">{amt / 100}</span>}
      </button>
    );
  };

  return (
    <Card className="p-5 space-y-4">
      <ModeBar w={w} disabled={busy} />
      <div className="h-32 rounded-xl bg-gradient-to-b from-[#0E3B2A] to-[#0A2A1F] border border-white/10 flex flex-col items-center justify-center gap-2">
        <div className={cn("h-16 w-16 rounded-full border-4 border-gold flex items-center justify-center text-3xl font-black text-white", shown === null ? "bg-surface" : numColor(shown), busy && "animate-pulse")}>
          {shown ?? "?"}
        </div>
        <span className="text-xs text-white/60">{busy ? "Spinning…" : out ? `${out.r.result.number} ${out.r.result.number === 0 ? "green" : isRed(out.r.result.number) ? "red" : "black"}` : "Place your chips"}</span>
      </div>
      {recent.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto">{recent.map((n, i) => <span key={i} className={cn("h-6 w-6 shrink-0 rounded-full text-[11px] font-black text-white flex items-center justify-center", numColor(n))}>{n}</span>)}</div>
      )}

      <div className="space-y-1.5">
        {cell("STRAIGHT", "0", 0, numColor(0), "w-full")}
        <div className="grid grid-cols-12 gap-1">
          {[3, 2, 1].flatMap((offset) => Array.from({ length: 12 }, (_, c) => 3 * c + offset)).map((n) => cell("STRAIGHT", String(n), n, numColor(n)))}
        </div>
        <div className="grid grid-cols-3 gap-1">{(["COL3", "COL2", "COL1"] as const).map((t, i) => cell(t, `Row ${3 - i} · 2:1`))}</div>
        <div className="grid grid-cols-3 gap-1">{(["DOZEN1", "DOZEN2", "DOZEN3"] as const).map((t, i) => cell(t, `${i * 12 + 1}–${i * 12 + 12} · 2:1`))}</div>
        <div className="grid grid-cols-6 gap-1">{OUTSIDE.map((o) => cell(o.type, o.label, undefined, o.cls))}</div>
      </div>

      <div className="flex items-center gap-2">
        {CHIPS.map((c) => (
          <button key={c} type="button" onClick={() => setChip(c)} className={cn("h-10 flex-1 rounded-full border-2 text-xs font-black", chip === c ? "border-gold bg-gold/20 text-gold" : "border-white/15 bg-surface-2 text-white/70")}>₹{c / 100}</button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={busy || !placed.length} onClick={() => setPlaced((p) => p.slice(0, -1))}>Undo</Button>
        <Button variant="outline" size="sm" disabled={busy || !placed.length} onClick={() => { setPlaced([]); setOut(null); }}>Clear</Button>
        <span className="ml-auto self-center text-sm font-bold text-white">Total {formatPaiseExact(stake)}</span>
      </div>
      <Button fullWidth size="lg" variant="cta" loading={busy} disabled={!ok} onClick={spin}>Spin</Button>
      {placed.length > 0 && (stake < cfg.minBet || stake > cfg.maxBet) && <p className="text-xs text-crimson text-center">Total bet must be between {formatPaiseExact(cfg.minBet)} and {formatPaiseExact(cfg.maxBet)}.</p>}
      {stake > w.shown && <p className="text-xs text-crimson text-center">{w.demo ? `Demo credits low. Reload to restart with ${DEMO_START / 100}.` : "Add cash to your wallet to play."}</p>}
      {out && <Outcome won={out.r.payout > 0} bet={out.bet} payout={out.r.payout} />}
      <p className="text-[11px] text-white/40 text-center">
        European wheel (single zero). Number pays {(rouletteMultiplierBps("STRAIGHT", cfg.houseEdgeBps) / 10_000).toFixed(1)}×, colour/odd/even/half {(rouletteMultiplierBps("RED", cfg.houseEdgeBps) / 10_000).toFixed(2)}×, dozen/row {(rouletteMultiplierBps("DOZEN1", cfg.houseEdgeBps) / 10_000).toFixed(2)}×.
      </p>
    </Card>
  );
}
