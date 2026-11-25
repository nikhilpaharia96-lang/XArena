"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BetInput, rupeesToPaise } from "../bet-input";
import { DEMO_START, ModeBar, Outcome, roundOutcome, useDemoWallet } from "./demo-wallet";
import { cn } from "@/lib/cn";
import { colorMultiplierBps } from "@/server/games/table-math";
import type { ColorPick } from "@/server/games/table-math";
import { newRequestId, originals, toastError, useRefreshMoney, type ColorOutcome, type DemoOutcome, type OriginalGame } from "@/hooks/use-originals";

const COLORS = {
  GREEN: { label: "Green", cls: "bg-[#12A150] text-white", dot: "bg-[#12A150]" },
  VIOLET: { label: "Violet", cls: "bg-[#8B3FE0] text-white", dot: "bg-[#8B3FE0]" },
  RED: { label: "Red", cls: "bg-[#E03A3A] text-white", dot: "bg-[#E03A3A]" },
} as const;

const ballClass = (n: number) =>
  n === 0 ? "bg-gradient-to-br from-[#E03A3A] to-[#8B3FE0]" : n === 5 ? "bg-gradient-to-br from-[#12A150] to-[#8B3FE0]" : n % 2 ? "bg-[#12A150]" : "bg-[#E03A3A]";

export function ColorGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
  const w = useDemoWallet(cfg, balance);
  const refresh = useRefreshMoney();
  const [bet, setBet] = useState("10");
  const [pick, setPick] = useState<ColorPick>("GREEN");
  const [busy, setBusy] = useState(false);
  const [shown, setShown] = useState<number | null>(null);
  const [out, setOut] = useState<{ r: DemoOutcome<ColorOutcome>; bet: number } | null>(null);
  const [recent, setRecent] = useState<number[]>([]);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);

  const stake = rupeesToPaise(bet);
  const mult = colorMultiplierBps(pick, cfg.houseEdgeBps) / 10_000;
  const ok = stake >= cfg.minBet && stake <= cfg.maxBet && stake <= w.shown;

  const play = async () => {
    if (busy || !ok) return;
    setBusy(true);
    setOut(null);
    if (w.demo) w.setDemoBal((b) => b - stake);
    timer.current = setInterval(() => setShown(Math.floor(Math.random() * 10)), 70);
    try {
      const [r] = await Promise.all([
        w.demo ? originals.colorDemo(stake, pick) : originals.colorPlay({ bet: stake, pick, requestId: newRequestId() }).then((x) => roundOutcome<ColorOutcome>(x)),
        new Promise((res) => setTimeout(res, 900)),
      ]);
      if (w.demo) w.setDemoBal((b) => b + r.payout);
      else refresh();
      setShown(r.result.number);
      setRecent((x) => [r.result.number, ...x].slice(0, 12));
      setOut({ r, bet: stake });
    } catch (e) {
      if (w.demo) w.setDemoBal((b) => b + stake);
      setShown(null);
      toastError(e);
    } finally {
      if (timer.current) clearInterval(timer.current);
      setBusy(false);
    }
  };

  return (
    <Card className="p-5 space-y-4">
      <ModeBar w={w} disabled={busy} />
      <div className="h-36 rounded-xl bg-surface-2 border border-white/10 flex flex-col items-center justify-center gap-2">
        <div className={cn("h-20 w-20 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-lg", shown === null ? "bg-surface border border-white/15 text-white/30" : ballClass(shown))}>
          {shown ?? "?"}
        </div>
        <span className="text-xs text-white/40">{busy ? "Drawing…" : out ? (out.r.result.win ? "Your pick came in" : "Not this time") : "Pick a colour or number"}</span>
      </div>
      {recent.length > 0 && (
        <div className="flex gap-1.5 overflow-x-auto" aria-label="Recent draws">
          {recent.map((n, i) => (
            <span key={i} className={cn("h-6 w-6 shrink-0 rounded-full text-[11px] font-black text-white flex items-center justify-center", ballClass(n))}>{n}</span>
          ))}
        </div>
      )}
      <div className="grid grid-cols-3 gap-2">
        {(["GREEN", "VIOLET", "RED"] as const).map((c) => (
          <button key={c} type="button" disabled={busy} onClick={() => setPick(c)} className={cn("h-12 rounded-xl text-sm font-bold border-2 transition", COLORS[c].cls, pick === c ? "border-white" : "border-transparent opacity-70")}>
            {COLORS[c].label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-5 gap-2">
        {Array.from({ length: 10 }, (_, n) => {
          const key = `N${n}` as ColorPick;
          return (
            <button key={n} type="button" disabled={busy} onClick={() => setPick(key)} className={cn("h-10 rounded-xl text-sm font-black text-white border-2 transition", ballClass(n), pick === key ? "border-white" : "border-transparent opacity-70")}>
              {n}
            </button>
          );
        })}
      </div>
      <div className="text-center text-xs text-white/50">
        {pick.startsWith("N") ? `Number ${pick.slice(1)}` : COLORS[pick as keyof typeof COLORS].label} pays <b className="text-white">{mult.toFixed(2)}×</b> ·{" "}
        {pick === "GREEN" || pick === "RED" ? "5 of 10 digits win (0 and 5 are also violet)" : pick === "VIOLET" ? "digits 0 and 5 win" : "1 of 10 digits wins"}
      </div>
      <BetInput value={bet} onChange={setBet} min={cfg.minBet} max={cfg.maxBet} balance={w.shown} disabled={busy} />
      <Button fullWidth size="lg" variant="cta" loading={busy} disabled={!ok} onClick={play}>Play</Button>
      {stake > w.shown && <p className="text-xs text-crimson text-center">{w.demo ? `Demo credits low. Reload to restart with ${DEMO_START / 100}.` : "Add cash to your wallet to play."}</p>}
      {out && <Outcome won={out.r.result.win} bet={out.bet} payout={out.r.payout} />}
      <p className="text-[11px] text-white/40 text-center">Every digit 0-9 has an equal 10% chance. Results come from the server and are provably fair.</p>
    </Card>
  );
}
