"use client";

import { useEffect, useRef, useState } from "react";
import { Plane } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BetInput, rupeesToPaise } from "../bet-input";
import { DEMO_START, ModeBar, Outcome, useDemoWallet } from "./demo-wallet";
import { cn } from "@/lib/cn";
import { formatPaiseExact } from "@/lib/format";
import { crashMultiplierAt } from "@/server/games/math";
import { newRequestId, originals, toastError, useRefreshMoney, type OriginalGame, type Round } from "@/hooks/use-originals";

interface Live { startedAtMs: number; serverNowMs: number; autoCashoutBps: number | null; capMultiplierBps: number }
type Flight = { startedAt: number; autoBps: number | null; cap: number; demoCrash?: number; stake: number };

const W = 300;
const H = 150;
const pos = (mult: number) => {
  // x grows with log(multiplier) so the curve keeps rising smoothly
  const t = Math.min(1, Math.log(mult / 10_000) / Math.log(30));
  return { x: 10 + t * (W - 40), y: H - 14 - Math.pow(t, 0.8) * (H - 40) };
};

export function AviatorGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
  const w = useDemoWallet(cfg, balance);
  const refresh = useRefreshMoney();
  const [bet, setBet] = useState("10");
  const [auto, setAuto] = useState("");
  const [busy, setBusy] = useState(false);
  const [flight, setFlight] = useState<Flight | null>(null);
  const [mult, setMult] = useState(10_000);
  const [end, setEnd] = useState<{ crashed: boolean; payout: number; bet: number } | null>(null);
  const offset = useRef(0);
  const doneRef = useRef(false);

  const stake = rupeesToPaise(bet);
  const autoBps = auto ? Math.round(Number(auto) * 10_000) : undefined;
  const autoInvalid = auto !== "" && (!Number.isFinite(Number(auto)) || Number(auto) < 1.01 || Number(auto) > 1000);
  const ok = stake >= cfg.minBet && stake <= cfg.maxBet && stake <= w.shown && !autoInvalid;

  const finishDemo = (cashed: number | null, f: Flight) => {
    if (doneRef.current) return;
    doneRef.current = true;
    const payout = cashed ? Math.floor((f.stake * cashed) / 10_000) : 0;
    w.setDemoBal((b) => b + payout);
    if (cashed) setMult(cashed);
    else setMult(f.demoCrash ?? 10_000);
    setEnd({ crashed: !cashed, payout, bet: f.stake });
    setFlight(null);
  };

  const adopt = (r: Round | null) => {
    if (!r) return;
    if (r.status === "ACTIVE") {
      const l = r.live as unknown as Live;
      offset.current = l.serverNowMs - Date.now();
      setFlight({ startedAt: l.startedAtMs, autoBps: l.autoCashoutBps, cap: l.capMultiplierBps, stake: r.bet });
    } else {
      setFlight(null);
      refresh();
      setMult(r.status === "WON" ? r.multiplierBps : Number(r.result?.crashBps ?? 10_000));
      setEnd({ crashed: r.status === "LOST", payout: r.payout, bet: r.bet });
    }
  };

  // Resume an open real flight after refresh.
  useEffect(() => {
    if (w.demo) return;
    originals.aviatorState().then((r) => adopt(r.round)).catch(() => undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [w.demo]);

  useEffect(() => {
    if (!flight) return;
    let raf = 0;
    doneRef.current = false;
    const f = flight;
    const tick = () => {
      const elapsed = Date.now() + offset.current - f.startedAt;
      const cur = Math.min(crashMultiplierAt(elapsed), f.autoBps ?? Infinity, f.cap);
      if (w.demo) {
        if (f.demoCrash !== undefined && crashMultiplierAt(elapsed) >= f.demoCrash && (f.autoBps ?? Infinity) > f.demoCrash) return finishDemo(null, f);
        if (f.autoBps !== undefined && f.autoBps !== null && cur >= f.autoBps && f.autoBps < (f.demoCrash ?? Infinity)) return finishDemo(f.autoBps, f);
      }
      setMult(cur);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    const poll = w.demo
      ? null
      : setInterval(() => {
          originals.aviatorState().then((r) => r.round && r.round.status !== "ACTIVE" && adopt(r.round)).catch(() => undefined);
        }, 500);
    return () => {
      cancelAnimationFrame(raf);
      if (poll) clearInterval(poll);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [flight?.startedAt]);

  const start = async () => {
    if (busy || !ok) return;
    setBusy(true);
    setEnd(null);
    setMult(10_000);
    try {
      if (w.demo) {
        const { crashBps } = await originals.aviatorDemo(stake);
        w.setDemoBal((b) => b - stake);
        offset.current = 0;
        setFlight({ startedAt: Date.now(), autoBps: autoBps ?? null, cap: 10_000_000, demoCrash: crashBps, stake });
      } else {
        adopt(await originals.aviatorStart({ bet: stake, autoCashoutBps: autoBps, requestId: newRequestId() }));
        refresh(false);
      }
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const cashout = async () => {
    if (busy || !flight) return;
    if (w.demo) return finishDemo(Math.min(mult, flight.cap), flight);
    setBusy(true);
    try {
      adopt(await originals.aviatorCashout());
    } catch (e) {
      toastError(e);
    } finally {
      setBusy(false);
    }
  };

  const p = pos(mult);
  const path = Array.from({ length: 24 }, (_, i) => {
    const m = 10_000 * Math.pow(mult / 10_000, i / 23);
    const q = pos(m);
    return `${i ? "L" : "M"}${q.x.toFixed(1)},${q.y.toFixed(1)}`;
  }).join(" ");
  const crashed = end?.crashed;

  return (
    <Card className="p-5 space-y-4">
      <ModeBar w={w} disabled={!!flight || busy} />
      <div className="relative rounded-xl bg-gradient-to-b from-[#0B1B3A] to-[#0A1226] border border-white/10 overflow-hidden">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-44" role="img" aria-label="Flight curve">
          <path d={path} fill="none" stroke={crashed ? "#EF4444" : "#F97316"} strokeWidth="3" strokeLinecap="round" />
          <path d={`${path} L${p.x.toFixed(1)},${H - 14} L10,${H - 14} Z`} fill={crashed ? "rgba(239,68,68,.12)" : "rgba(249,115,22,.14)"} />
          <line x1="10" y1={H - 14} x2={W - 10} y2={H - 14} stroke="rgba(255,255,255,.15)" />
        </svg>
        {!crashed && <Plane className="absolute h-7 w-7 text-white -rotate-45 drop-shadow transition-none" style={{ left: `${(p.x / W) * 100}%`, top: `${(p.y / H) * 100}%`, transform: "translate(-50%,-60%) rotate(-30deg)" }} />}
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <span className={cn("text-5xl font-black tabular-nums", crashed ? "text-crimson" : end ? "text-signal" : "text-white")}>{(mult / 10_000).toFixed(2)}×</span>
          <span className="text-xs text-white/50 mt-1">{crashed ? "Flew away" : flight ? "Cash out before it flies away" : end ? "Cashed out" : "Place a bet to take off"}</span>
        </div>
      </div>

      {flight ? (
        <Button fullWidth size="lg" variant="cta" loading={busy} onClick={cashout}>Cash out {formatPaiseExact(Math.floor((flight.stake * mult) / 10_000))}</Button>
      ) : (
        <>
          <BetInput value={bet} onChange={setBet} min={cfg.minBet} max={cfg.maxBet} balance={w.shown} disabled={busy} />
          <div>
            <label className="text-xs font-semibold text-white/60 mb-1.5 block">Auto cash-out at (optional, e.g. 2.00)</label>
            <Input inputMode="decimal" value={auto} onChange={(e) => setAuto(e.target.value.replace(/[^0-9.]/g, ""))} error={autoInvalid ? "Use a value between 1.01 and 1000" : undefined} />
          </div>
          <Button fullWidth size="lg" variant="cta" loading={busy} disabled={!ok} onClick={start}>Place bet</Button>
          {stake > w.shown && <p className="text-xs text-crimson text-center">{w.demo ? `Demo credits low. Reload to restart with ${DEMO_START / 100}.` : "Add cash to your wallet to play."}</p>}
        </>
      )}
      {end && <Outcome won={!end.crashed} bet={end.bet} payout={end.payout} text={end.crashed ? "Flew away" : "Cashed out"} />}
    </Card>
  );
}
