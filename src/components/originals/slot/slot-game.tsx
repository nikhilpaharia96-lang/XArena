"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Minus, Plus, RotateCw, Volume2, VolumeX, Zap } from "lucide-react";
import { formatPaiseExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast-store";
import {
  originals,
  newRequestId,
  toastError,
  useRefreshMoney,
  type OriginalGame,
  type SlotResult,
  type SlotStep,
} from "@/hooks/use-originals";
import { FREE_SPINS_AWARD, MAX_ASCENT, PAYLINES, PAYTABLE, SCATTER_PAY_TOTAL, SLOT_LINES } from "@/server/games/slot-math";
import { GarudaHero } from "./garuda-hero";
import { SymbolArt, SymbolDefs, SYMBOL_LABEL } from "./symbols";
import { SLOT_CSS } from "./slot-styles";
import { useSlotAudio } from "./use-slot-audio";
import { useBurst } from "./use-burst";

const REELS = 5;
const STRIP_CELLS = 12; // 9 random + first 3 repeated so the loop is seamless
const LADDER = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
const DEMO_START = 1_000_000; // 10,000.00 virtual credits
const AUTO_STEPS = [0, 10, 25, 50, 100];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rnd = () => Math.floor(Math.random() * 6);
const initialCols = () => Array.from({ length: REELS }, () => [rnd(), rnd(), rnd()]);
const makeStrip = () => {
  const s = Array.from({ length: STRIP_CELLS }, rnd);
  s[9] = s[0]; s[10] = s[1]; s[11] = s[2];
  return s;
};

interface Overlay { kind: "free" | "freeEnd" | "big"; title: string; sub?: string; amount?: number }

function winCellsOf(step: SlotStep): Set<string> {
  const set = new Set<string>();
  for (const w of step.lineWins) {
    const rows = PAYLINES[w.line];
    for (let r = 0; r < w.count; r++) set.add(`${r}-${rows[r]}`);
  }
  if (step.scatters >= 3) step.grid.forEach((col, r) => col.forEach((s, row) => s === 7 && set.add(`${r}-${row}`)));
  return set;
}

export function SlotGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
  const bets = useMemo(() => {
    const l = LADDER.filter((b) => b >= cfg.minBet && b <= cfg.maxBet);
    return l.length ? l : [cfg.minBet];
  }, [cfg.minBet, cfg.maxBet]);

  const [mode, setMode] = useState<"demo" | "real">("demo");
  const [demoBal, setDemoBal] = useState(DEMO_START);
  const [realOverride, setRealOverride] = useState<number | null>(null);
  const [seenBalance, setSeenBalance] = useState(balance);
  const [betIdx, setBetIdx] = useState(0);
  const [cols, setCols] = useState<number[][]>(initialCols);
  const [spinning, setSpinning] = useState<boolean[]>(Array(REELS).fill(false));
  const [strips, setStrips] = useState<number[][]>(() => Array.from({ length: REELS }, makeStrip));
  const [settle, setSettle] = useState<number[]>(Array(REELS).fill(0));
  const [winCells, setWinCells] = useState<Set<string>>(new Set());
  const [winShown, setWinShown] = useState(0);
  const [busy, setBusy] = useState(false);
  const [fs, setFs] = useState<{ k: number; total: number; ascent: number } | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [shake, setShake] = useState(false);
  const [pulse, setPulse] = useState(0);
  const [sound, setSound] = useState(true);
  const [turbo, setTurbo] = useState(false);
  const [panel, setPanel] = useState(false);
  const [autoLeft, setAutoLeft] = useState(0);

  const audio = useSlotAudio(sound);
  const { canvasRef, burst, rain } = useBurst();
  const refresh = useRefreshMoney();
  const boardRef = useRef<HTMLDivElement | null>(null);
  const alive = useRef(true);
  const busyRef = useRef(false);
  const autoRef = useRef(0);
  const winRef = useRef(0);
  const countRaf = useRef(0);
  const latest = useRef<() => Promise<boolean>>(async () => false);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      cancelAnimationFrame(countRaf.current);
    };
  }, []);

  // While a round plays out we show a locally tracked balance; once the wallet query refreshes, the server value wins again.
  if (balance !== seenBalance) {
    setSeenBalance(balance);
    setRealOverride(null);
  }

  const bet = bets[Math.min(betIdx, bets.length - 1)];
  const shown = mode === "demo" ? demoBal : (realOverride ?? balance);
  const rtp = ((10_000 - cfg.houseEdgeBps) / 100).toFixed(1);

  const countTo = useCallback((target: number, ms = 700) => {
    cancelAnimationFrame(countRaf.current);
    const from = winRef.current;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / ms);
      const v = Math.round(from + (target - from) * (1 - Math.pow(1 - k, 3)));
      winRef.current = v;
      setWinShown(v);
      if (k < 1 && alive.current) countRaf.current = requestAnimationFrame(tick);
    };
    countRaf.current = requestAnimationFrame(tick);
  }, []);

  const cellBurst = useCallback((cells: Set<string>, power: number) => {
    const el = boardRef.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    let n = 0;
    cells.forEach((key) => {
      if (n++ > 6) return;
      const [r, row] = key.split("-").map(Number);
      burst(((r + 0.5) / REELS) * w, ((row + 0.5) / 3) * h, 18 + power * 10, 0.8 + power * 0.3);
    });
  }, [burst]);

  /** Spins the reels to `step` (the server's already-decided result) and reveals them left to right. */
  const reveal = useCallback(async (step: SlotStep, fast: boolean) => {
    setWinCells(new Set());
    setStrips(Array.from({ length: REELS }, makeStrip));
    setSpinning(Array(REELS).fill(true));
    audio.spin();
    await sleep(fast ? 380 : 650);
    for (let r = 0; r < REELS && alive.current; r++) {
      setCols((prev) => prev.map((c, i) => (i === r ? step.grid[r] : c)));
      setSpinning((prev) => prev.map((s, i) => (i === r ? false : s)));
      setSettle((prev) => prev.map((s, i) => (i === r ? s + 1 : s)));
      audio.stop();
      await sleep(fast ? 100 : 230);
    }
  }, [audio]);

  const doSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    if (shown < bet) {
      toast({ title: "Not enough balance", description: mode === "demo" ? "Your demo credits ran out. Switch modes or reload to restart." : "Add cash to your wallet to keep playing.", tone: "error" });
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    setOverlay(null);
    cancelAnimationFrame(countRaf.current);
    winRef.current = 0;
    setWinShown(0);
    if (mode === "demo") setDemoBal((b) => b - bet);
    else setRealOverride((o) => (o ?? balance) - bet);

    // Reels start spinning right away while the server decides the result.
    setStrips(Array.from({ length: REELS }, makeStrip));
    setSpinning(Array(REELS).fill(true));
    setWinCells(new Set());

    let result: SlotResult;
    let finalReal: number | null = null;
    try {
      if (mode === "demo") {
        result = await originals.slotDemo(bet);
      } else {
        const round = await originals.slot({ bet, requestId: newRequestId() });
        result = round.result as unknown as SlotResult;
        finalReal = round.balance;
      }
    } catch (e) {
      setSpinning(Array(REELS).fill(false));
      if (mode === "demo") setDemoBal((b) => b + bet);
      else setRealOverride(null);
      toastError(e);
      refresh(false);
      busyRef.current = false;
      setBusy(false);
      autoRef.current = 0;
      setAutoLeft(0);
      return false;
    }

    let running = 0;
    const base = result.steps[0];
    await reveal(base, turbo);
    const baseCells = winCellsOf(base);
    setWinCells(baseCells);
    if (base.win > 0) {
      running += base.win;
      countTo(running);
      cellBurst(baseCells, 1);
      audio.win(1);
      setPulse((p) => p + 1);
    }
    await sleep(base.win > 0 ? 900 : 250);

    // ---- free-spin round (decided server-side in the same bet) ----
    const free = result.steps.slice(1);
    if (free.length > 0 && alive.current) {
      setOverlay({ kind: "free", title: "FREE SPINS", sub: `${free.length} spins · Ascent multiplier up to x${MAX_ASCENT}` });
      audio.bonus();
      rain(70);
      await sleep(2300);
      setOverlay(null);
      for (let i = 0; i < free.length && alive.current; i++) {
        const st = free[i];
        setFs({ k: i + 1, total: free.length, ascent: st.ascent });
        await reveal(st, true);
        const cells = winCellsOf(st);
        setWinCells(cells);
        if (st.win > 0) {
          running += st.win;
          countTo(Math.min(running, result.payout));
          cellBurst(cells, Math.min(3, st.ascent));
          audio.win(Math.min(3, st.ascent));
          setPulse((p) => p + 1);
        }
        await sleep(st.win > 0 ? 850 : 300);
      }
      setOverlay({ kind: "freeEnd", title: "FEATURE COMPLETE", sub: "Total free-spin win", amount: result.payout });
      countTo(result.payout, 600);
      await sleep(2200);
      setOverlay(null);
      setFs(null);
    }

    // ---- final settle ----
    countTo(result.payout, 500);
    const x = result.payout / bet;
    if (x >= 10 && alive.current) {
      const tier = x >= 50 ? "EPIC WIN" : x >= 25 ? "MEGA WIN" : "BIG WIN";
      setOverlay({ kind: "big", title: tier, sub: `${x.toFixed(1)}× your bet`, amount: result.payout });
      setShake(true);
      rain(110);
      audio.win(3);
      await sleep(2600);
      setShake(false);
      setOverlay(null);
      if (x >= 25) { autoRef.current = 0; setAutoLeft(0); }
    }
    if (result.capped) toast({ title: "Max payout reached", description: "This round hit the table's payout limit.", tone: "info" });

    if (mode === "demo") setDemoBal((b) => b + result.payout);
    else if (finalReal !== null) setRealOverride(finalReal);
    refresh();
    busyRef.current = false;
    setBusy(false);
    return true;
  }, [shown, balance, bet, mode, turbo, reveal, countTo, cellBurst, audio, rain, refresh]);

  useEffect(() => {
    latest.current = doSpin;
  }, [doSpin]);

  const startSpin = async () => {
    const ok = await latest.current();
    // auto-spin loop: always calls the freshest doSpin so balance/bet are current
    while (ok && autoRef.current > 0 && alive.current) {
      autoRef.current -= 1;
      setAutoLeft(autoRef.current);
      await sleep(turbo ? 250 : 500);
      if (!alive.current || autoRef.current < 0) break;
      const next = await latest.current();
      if (!next) { autoRef.current = 0; setAutoLeft(0); break; }
    }
  };

  const onSpinClick = () => {
    if (busy) return;
    void startSpin();
  };

  const cycleAuto = () => {
    const i = AUTO_STEPS.indexOf(autoLeft > 0 ? AUTO_STEPS.find((s) => s >= autoLeft) ?? 100 : 0);
    const next = AUTO_STEPS[(i + 1) % AUTO_STEPS.length];
    autoRef.current = next;
    setAutoLeft(next);
    if (next > 0 && !busyRef.current) void startSpin();
  };

  const stopAuto = () => {
    autoRef.current = 0;
    setAutoLeft(0);
  };

  const switchMode = (m: "demo" | "real") => {
    if (busy || m === mode) return;
    if (m === "real" && !window.confirm("Real wallet mode bets your actual XArena balance. Continue?")) return;
    stopAuto();
    setMode(m);
  };

  return (
    <div className={cn("ga-root", shake && "ga-shake", fs && "ga-fs")}>
      <style>{SLOT_CSS}</style>
      <SymbolDefs />
      <div className="relative">
        <GarudaHero fever={!!fs} pulse={pulse} />
        <div className="ga-brand">
          GARUDA ASCENT
          <small>GOLDEN WINGS · TEMPLE OF FORTUNE</small>
        </div>
      </div>

      <div className="ga-frame">
        {fs && <div className="ga-fsbadge">FREE SPIN {fs.k}/{fs.total} · ASCENT ×{fs.ascent}</div>}
        <div className="ga-titlebar">
          <span>GARUDA ASCENT</span>
          <span className="flex gap-1.5">
            <button type="button" className={cn("ga-chip", mode === "demo" && "on")} onClick={() => switchMode("demo")} disabled={busy}>DEMO</button>
            <button type="button" className={cn("ga-chip", mode === "real" && "on")} onClick={() => switchMode("real")} disabled={busy}>WALLET</button>
          </span>
        </div>

        <div className="ga-boardwrap">
          <div className="ga-board ga-shine" ref={boardRef}>
            {Array.from({ length: REELS }, (_, r) => (
              <div className="ga-reel" key={r}>
                {spinning[r] ? (
                  <div className="ga-strip">
                    {strips[r].map((s, i) => (
                      <div className="ga-cell" key={i}><SymbolArt id={s} /></div>
                    ))}
                  </div>
                ) : (
                  <div key={settle[r]} className={settle[r] > 0 ? "ga-settle" : ""}>
                    {cols[r].map((s, row) => (
                      <div className={cn("ga-cell", winCells.has(`${r}-${row}`) && "win")} key={row}>
                        <SymbolArt id={s} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <canvas ref={canvasRef} className="ga-canvas" />
          </div>
          <div className="ga-side">
            <div className="ga-sidelabel">ASCENT</div>
            <div className="ga-ladder">
              {Array.from({ length: MAX_ASCENT }, (_, i) => MAX_ASCENT - i).map((m) => (
                <div key={m} className={cn("ga-rung", fs?.ascent === m && "on")}>×{m}</div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="ga-hud">
        <div className="ga-win">
          <b>WIN</b>
          <span className={cn(winShown > 0 && winShown >= bet * 10 && "big")}>{formatPaiseExact(winShown)}</span>
        </div>
        <div className="ga-controls">
          <div className="ga-stack">
            <button type="button" className={cn("ga-round", panel && "on")} onClick={() => setPanel((p) => !p)} aria-label="Game info and settings"><Info className="h-4 w-4" /></button>
            <button type="button" className={cn("ga-round", sound && "on")} onClick={() => setSound((s) => !s)} aria-label={sound ? "Mute" : "Unmute"}>{sound ? <Volume2 className="h-4 w-4" /> : <VolumeX className="h-4 w-4" />}</button>
          </div>
          <div className="ga-betgrp">
            <button type="button" className="ga-round lg" disabled={busy || betIdx === 0} onClick={() => setBetIdx((i) => Math.max(0, i - 1))} aria-label="Lower bet"><Minus className="h-4 w-4" /></button>
            <div className="ga-betbox"><small>BET</small><b>{formatPaiseExact(bet)}</b></div>
            <button type="button" className="ga-round lg" disabled={busy || betIdx >= bets.length - 1} onClick={() => setBetIdx((i) => Math.min(bets.length - 1, i + 1))} aria-label="Raise bet"><Plus className="h-4 w-4" /></button>
          </div>
          {autoLeft > 0 ? (
            <button type="button" className="ga-spinbtn" onClick={stopAuto} aria-label="Stop auto spin">STOP<br /><small>{autoLeft}</small></button>
          ) : (
            <button type="button" className={cn("ga-spinbtn", busy && "spinning")} disabled={busy} onClick={onSpinClick} aria-label="Spin">
              {busy ? <RotateCw className="h-7 w-7 mx-auto" /> : "SPIN"}
            </button>
          )}
          <div className="ga-stack">
            <button type="button" className={cn("ga-round", autoLeft > 0 && "on")} disabled={busy && autoLeft === 0} onClick={cycleAuto} aria-label="Auto spin">{autoLeft > 0 ? autoLeft : "AUTO"}</button>
            <button type="button" className={cn("ga-round", turbo && "on")} onClick={() => setTurbo((t) => !t)} aria-label="Turbo"><Zap className="h-4 w-4" /></button>
          </div>
        </div>
        <div className="ga-bal">
          <span>{mode === "demo" ? "DEMO CREDITS (no cash value)" : "WALLET BALANCE"}</span>
          <b>{formatPaiseExact(shown)}</b>
        </div>
      </div>

      {panel && (
        <div className="ga-panel">
          <p><b>How it works.</b> {SLOT_LINES} fixed lines, wins pay left to right from reel 1. Wild Sun replaces everything except Temple Bonus (reels 2-4 only). 3+ Temple Bonus symbols anywhere pay {SCATTER_PAY_TOTAL[0]}×/{SCATTER_PAY_TOTAL[1]}×/{SCATTER_PAY_TOTAL[2]}× your bet and start {FREE_SPINS_AWARD[0]}/{FREE_SPINS_AWARD[1]}/{FREE_SPINS_AWARD[2]} free spins; every winning free spin raises the Ascent multiplier up to ×{MAX_ASCENT}.</p>
          <table>
            <thead><tr><th /><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr></thead>
            <tbody>
              {[5, 4, 3, 2, 1, 0].map((id) => (
                <tr key={id}>
                  <td><SymbolArt id={id} /></td>
                  <td style={{ textAlign: "left" }}>{SYMBOL_LABEL[id]}</td>
                  {PAYTABLE[id].map((u, i) => <td key={i}>{(u / SLOT_LINES).toFixed(2)}×</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="opacity-70">Line pays are multiples of your total bet. Return to player ≈ {rtp}%. Results are decided by the server and provably fair (see Fairness below). Max payout per round {formatPaiseExact(cfg.maxPayout)}. Demo credits are virtual; wallet mode uses real balance. 18+ only, play responsibly.</p>
        </div>
      )}

      {overlay && (
        <div className="ga-overlay" role="status">
          <div className="burst" />
          <h2>{overlay.title}</h2>
          {overlay.sub && <p>{overlay.sub}</p>}
          {overlay.amount !== undefined && <div className="amt">{formatPaiseExact(overlay.amount)}</div>}
        </div>
      )}
    </div>
  );
}
