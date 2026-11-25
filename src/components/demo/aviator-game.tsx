"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { START_POINTS, randomSeed, sha256Hex } from "@/lib/demo-color-game";
import {
  CRASHED_SECONDS,
  GROWTH,
  WAIT_SECONDS,
  cashOutPayout,
  chipClass,
  crashPointFromSeed,
  multiplierAt,
} from "@/lib/demo-aviator";

/* ---------- types ---------- */
type Phase = "loading" | "waiting" | "flying" | "crashed";
interface Round { id: string; seed: string; commit: string; crash: number; waitEnd: number; flightStart: number; nextAt: number }
interface Panel { amount: number; auto: boolean; autoAt: number; placed: number | null; queued: boolean; cashedAt: number | null; win: number }
interface MyItem { id: string; stake: number; cashedAt: number | null; win: number; crash: number }
interface Revealed { id: string; seed: string; commit: string; crash: number }

const STORAGE_KEY = "xarena-demo-points";
const CHIPS = [10, 50, 100, 500];
const emptyPanel = (): Panel => ({ amount: 10, auto: false, autoAt: 2, placed: null, queued: false, cashedAt: null, win: 0 });

function sampleCrashes(): number[] {
  return Array.from({ length: 14 }, () => {
    const r = Math.random();
    return Math.min(200, Math.max(1, Math.floor(99 / (1 - r)) / 100));
  });
}

/* ---------- canvas ---------- */
function drawScene(canvas: HTMLCanvasElement, mult: number, phase: Phase) {
  const dpr = window.devicePixelRatio || 1;
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  if (canvas.width !== w * dpr) { canvas.width = w * dpr; canvas.height = h * dpr; }
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);

  // sunburst background
  ctx.save();
  ctx.translate(0, h);
  for (let i = 0; i < 14; i++) {
    ctx.rotate((Math.PI / 2) / 14);
    ctx.fillStyle = i % 2 ? "rgba(255,255,255,0.025)" : "rgba(255,255,255,0)";
    ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(w * 1.6, -14); ctx.lineTo(w * 1.6, 14); ctx.fill();
  }
  ctx.restore();

  const pad = 28;
  const tNow = Math.log(Math.max(1, mult)) / GROWTH;
  const tView = Math.max(8, tNow * 1.08);
  const mView = Math.max(2, mult * 1.08);
  const X = (t: number) => pad + (t / tView) * (w - pad * 2);
  const Y = (m: number) => h - pad - ((m - 1) / (mView - 1)) * (h - pad * 2);

  // axes
  ctx.strokeStyle = "rgba(255,255,255,0.12)";
  ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(pad, 8); ctx.lineTo(pad, h - pad); ctx.lineTo(w - 8, h - pad); ctx.stroke();

  if (phase === "waiting" || phase === "loading") return;

  // curve
  const steps = 60;
  const pts: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (tNow * i) / steps;
    pts.push([X(t), Y(Math.exp(GROWTH * t))]);
  }
  const [ex, ey] = pts[pts.length - 1];
  const color = phase === "crashed" ? "#6b7280" : "#d0021b";
  ctx.beginPath();
  ctx.moveTo(pad, h - pad);
  pts.forEach(([x, y]) => ctx.lineTo(x, y));
  ctx.lineTo(ex, h - pad);
  ctx.closePath();
  ctx.fillStyle = phase === "crashed" ? "rgba(107,114,128,0.18)" : "rgba(208,2,27,0.28)";
  ctx.fill();
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.strokeStyle = color;
  ctx.lineWidth = 3;
  ctx.stroke();

  // plane (hidden once it flew away)
  if (phase === "flying") {
    const [px, py] = pts[pts.length - 4] ?? pts[0];
    const ang = Math.atan2(ey - py, ex - px);
    ctx.save();
    ctx.translate(ex, ey);
    ctx.rotate(ang);
    ctx.fillStyle = "#e5253a";
    ctx.beginPath(); // fuselage
    ctx.moveTo(22, 0); ctx.quadraticCurveTo(10, -7, -16, -5); ctx.lineTo(-20, -9); ctx.lineTo(-24, -9); ctx.lineTo(-20, 0); ctx.lineTo(-24, 9); ctx.lineTo(-20, 9); ctx.lineTo(-16, 5); ctx.quadraticCurveTo(10, 7, 22, 0);
    ctx.fill();
    ctx.fillStyle = "#b01629";
    ctx.beginPath(); // wing
    ctx.moveTo(4, 0); ctx.lineTo(-10, -20); ctx.lineTo(-15, -20); ctx.lineTo(-8, 0); ctx.lineTo(-15, 20); ctx.lineTo(-10, 20); ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
}

/* ---------- component ---------- */
export function AviatorGame() {
  const [balance, setBalance] = useState(START_POINTS);
  const [phase, setPhase] = useState<Phase>("loading");
  const [mult, setMult] = useState(1);
  const [waitLeft, setWaitLeft] = useState(WAIT_SECONDS);
  const [panels, setPanels] = useState<Panel[]>([emptyPanel(), emptyPanel()]);
  const [history, setHistory] = useState<number[]>([]);
  const [mine, setMine] = useState<MyItem[]>([]);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [commit, setCommit] = useState<string>("");
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const roundRef = useRef<Round | null>(null);
  const phaseRef = useRef<Phase>("loading");
  const multRef = useRef(1);
  const panelsRef = useRef<Panel[]>(panels);
  const balanceRef = useRef(START_POINTS);
  const creatingRef = useRef(false);
  const counterRef = useRef(1);

  const updateBalance = useCallback((fn: (b: number) => number) => {
    balanceRef.current = fn(balanceRef.current);
    setBalance(balanceRef.current);
  }, []);
  const updatePanels = useCallback((fn: (p: Panel[]) => Panel[]) => {
    panelsRef.current = fn(panelsRef.current);
    setPanels(panelsRef.current);
  }, []);
  const setPhaseBoth = (p: Phase) => { phaseRef.current = p; setPhase(p); };

  /* persist demo points (shared with the Color Prediction demo) */
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = Number(localStorage.getItem(STORAGE_KEY));
        if (Number.isFinite(saved) && saved > 0) { balanceRef.current = saved; setBalance(saved); }
      } catch { /* storage unavailable */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(balance)); } catch { /* ignore */ }
  }, [balance]);

  /* ---- round lifecycle ---- */
  const newRound = useCallback(async () => {
    if (creatingRef.current) return;
    creatingRef.current = true;
    try {
      const seed = randomSeed();
      const c = await sha256Hex(seed);
      const id = `AV${Date.now().toString().slice(-6)}${String(counterRef.current++).padStart(3, "0")}`;
      const crash = await crashPointFromSeed(seed, id);
      roundRef.current = { id, seed, commit: c, crash, waitEnd: Date.now() + WAIT_SECONDS * 1000, flightStart: 0, nextAt: 0 };
      setCommit(c);
      multRef.current = 1;
      setMult(1);
      // reset panels; place queued bets for this round
      updatePanels((ps) =>
        ps.map((p) => {
          const base = { ...p, placed: null, cashedAt: null, win: 0 };
          if (p.queued && p.amount <= balanceRef.current) {
            updateBalance((b) => b - p.amount);
            return { ...base, placed: p.amount, queued: false };
          }
          return { ...base, queued: false };
        })
      );
      setPhaseBoth("waiting");
    } finally {
      creatingRef.current = false;
    }
  }, [updateBalance, updatePanels]);

  const cashOut = useCallback((i: number, at: number) => {
    const p = panelsRef.current[i];
    if (!p || p.placed === null || p.cashedAt !== null) return;
    const win = cashOutPayout(p.placed, at);
    updateBalance((b) => b + win);
    updatePanels((ps) => ps.map((x, k) => (k === i ? { ...x, cashedAt: at, win } : x)));
    const r = roundRef.current;
    if (r) setMine((m) => [{ id: r.id, stake: p.placed as number, cashedAt: at, win, crash: r.crash }, ...m].slice(0, 30));
    setMessage(`Cashed out at ${at.toFixed(2)}x: +${win - p.placed} pts`);
  }, [updateBalance, updatePanels]);

  useEffect(() => {
    const boot = setTimeout(() => { setHistory(sampleCrashes()); void newRound(); }, 0);
    const tick = setInterval(() => {
      const r = roundRef.current;
      if (!r) return;
      const t = Date.now();
      const ph = phaseRef.current;
      if (ph === "waiting") {
        setWaitLeft(Math.max(0, Math.ceil((r.waitEnd - t) / 1000)));
        if (t >= r.waitEnd) { r.flightStart = t; setPhaseBoth("flying"); setMessage(null); }
      } else if (ph === "flying") {
        const m = multiplierAt((t - r.flightStart) / 1000);
        if (m >= r.crash) {
          multRef.current = r.crash;
          setMult(r.crash);
          setPhaseBoth("crashed");
          r.nextAt = t + CRASHED_SECONDS * 1000;
          // unfinished bets are lost
          const lost: MyItem[] = [];
          panelsRef.current.forEach((p) => { if (p.placed !== null && p.cashedAt === null) lost.push({ id: r.id, stake: p.placed, cashedAt: null, win: 0, crash: r.crash }); });
          if (lost.length) { setMine((mm) => [...lost, ...mm].slice(0, 30)); setMessage(`Flew away at ${r.crash.toFixed(2)}x. Bet lost.`); }
          setHistory((h) => [r.crash, ...h].slice(0, 30));
          setRevealed({ id: r.id, seed: r.seed, commit: r.commit, crash: r.crash });
          setVerifyMsg(null);
        } else {
          multRef.current = m;
          setMult(m);
          panelsRef.current.forEach((p, i) => {
            if (p.placed !== null && p.cashedAt === null && p.auto && m >= p.autoAt) cashOut(i, p.autoAt);
          });
        }
      } else if (ph === "crashed" && t >= r.nextAt) {
        void newRound();
      }
    }, 50);
    return () => { clearTimeout(boot); clearInterval(tick); };
  }, [newRound, cashOut]);

  useEffect(() => {
    if (canvasRef.current) drawScene(canvasRef.current, mult, phase);
  }, [mult, phase]);

  /* ---- panel actions ---- */
  const patch = (i: number, p: Partial<Panel>) => updatePanels((ps) => ps.map((x, k) => (k === i ? { ...x, ...p } : x)));
  const setAmount = (i: number, v: number) => patch(i, { amount: Math.min(10000, Math.max(1, Math.floor(v) || 1)) });

  const onMainButton = (i: number) => {
    const p = panelsRef.current[i];
    const ph = phaseRef.current;
    if (p.placed !== null) {
      if (ph === "waiting") { updateBalance((b) => b + (p.placed as number)); patch(i, { placed: null }); }
      else if (ph === "flying" && p.cashedAt === null) cashOut(i, multRef.current);
      return;
    }
    if (ph === "waiting") {
      if (p.amount > balanceRef.current) { setMessage("Not enough demo points. Tap Free 1000."); return; }
      updateBalance((b) => b - p.amount);
      patch(i, { placed: p.amount });
      setMessage(null);
    } else {
      patch(i, { queued: !p.queued });
    }
  };

  const verify = async () => {
    if (!revealed) return;
    const okHash = (await sha256Hex(revealed.seed)) === revealed.commit;
    const okRes = (await crashPointFromSeed(revealed.seed, revealed.id)) === revealed.crash;
    setVerifyMsg(okHash && okRes ? "Verified: hash and crash point match." : "Mismatch!");
  };

  const btn = (p: Panel) => {
    if (p.placed !== null) {
      if (phase === "waiting") return { label: "Cancel", cls: "bg-[#d0021b]", disabled: false };
      if (p.cashedAt !== null) return { label: `Cashed out +${p.win - p.placed}`, cls: "bg-[#28a909]/50", disabled: true };
      if (phase === "flying") return { label: `Cash out ${cashOutPayout(p.placed, mult)}`, cls: "bg-[#e69308]", disabled: false };
      return { label: "Lost", cls: "bg-white/10", disabled: true };
    }
    if (phase === "waiting") return { label: `Bet ${p.amount} pts`, cls: "bg-[#28a909]", disabled: false };
    return p.queued ? { label: "Cancel next-round bet", cls: "bg-[#d0021b]", disabled: false } : { label: `Bet next round ${p.amount}`, cls: "bg-[#28a909]", disabled: false };
  };

  return (
    <div className="force-dark mx-auto max-w-md space-y-3 rounded-3xl bg-[#0e0e0e] p-3 pb-6 text-white">
      {/* header */}
      <div className="flex items-center justify-between px-1">
        <p className="text-2xl font-black italic text-[#e5253a]">Aviator <span className="text-xs font-bold not-italic text-white/50">DEMO</span></p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-black px-3 py-1 text-sm font-bold text-[#28a909] tabular-nums">{balance.toLocaleString("en-IN")} pts</span>
          <button type="button" onClick={() => { updateBalance((b) => b + 1000); setMessage("+1000 free demo points"); }} className="rounded-full bg-[#1b1c1d] px-3 py-1 text-xs font-bold active:scale-95">+1000</button>
        </div>
      </div>
      <div className="rounded-lg bg-[#e69308]/15 px-3 py-2 text-center text-xs text-white/90">
        <b>DEMO MODE</b> · Virtual points only. No deposit, no withdraw, no real money.
      </div>

      {/* history chips */}
      <div className="flex gap-2 overflow-x-auto rounded-full bg-[#1b1c1d] px-3 py-1.5 text-xs font-bold">
        {history.map((h, i) => <span key={i} className={cn("shrink-0 rounded-full bg-black/50 px-2.5 py-1 tabular-nums", chipClass(h))}>{h.toFixed(2)}x</span>)}
      </div>

      {/* stage */}
      <div className="relative h-60 overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-b from-[#1b1124] to-[#0b0b0f]">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
          {phase === "flying" && <p className="text-6xl font-black tabular-nums">{mult.toFixed(2)}x</p>}
          {phase === "crashed" && (
            <>
              <p className="text-sm font-bold uppercase tracking-wide text-white/70">Flew away!</p>
              <p className="text-6xl font-black tabular-nums text-[#e5253a]">{mult.toFixed(2)}x</p>
            </>
          )}
          {(phase === "waiting" || phase === "loading") && (
            <>
              <p className="text-sm font-bold uppercase tracking-widest text-white/70">Next round in</p>
              <p className="text-6xl font-black tabular-nums text-[#28a909]">{phase === "loading" ? "…" : waitLeft}</p>
              <div className="mt-3 h-1.5 w-40 overflow-hidden rounded-full bg-white/10">
                <div className="h-full bg-[#e5253a] transition-all" style={{ width: `${(waitLeft / WAIT_SECONDS) * 100}%` }} />
              </div>
            </>
          )}
        </div>
      </div>

      {message && <p className="text-center text-sm font-bold text-emerald-300">{message}</p>}

      {/* bet panels */}
      {panels.map((p, i) => {
        const b = btn(p);
        const lockedInputs = p.placed !== null;
        return (
          <div key={i} className="rounded-2xl border border-white/10 bg-[#1b1c1d] p-3">
            <div className="grid grid-cols-[1fr_1.2fr] gap-3">
              <div className="space-y-2">
                <div className="flex items-center justify-between rounded-full bg-black px-2 py-1">
                  <button type="button" disabled={lockedInputs} onClick={() => setAmount(i, p.amount - 10)} aria-label="Decrease bet" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2c2d30] disabled:opacity-40"><Minus className="h-4 w-4" /></button>
                  <input aria-label={`Bet ${i + 1} amount`} inputMode="numeric" disabled={lockedInputs} value={p.amount} onChange={(e) => setAmount(i, Number(e.target.value.replace(/\D/g, "")))} className="w-16 bg-transparent text-center text-lg font-bold tabular-nums outline-none disabled:opacity-60" />
                  <button type="button" disabled={lockedInputs} onClick={() => setAmount(i, p.amount + 10)} aria-label="Increase bet" className="flex h-7 w-7 items-center justify-center rounded-full bg-[#2c2d30] disabled:opacity-40"><Plus className="h-4 w-4" /></button>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {CHIPS.map((c) => <button key={c} type="button" disabled={lockedInputs} onClick={() => setAmount(i, c)} className="rounded-md bg-[#2c2d30] py-1 text-xs text-white/80 disabled:opacity-40">{c}</button>)}
                </div>
              </div>
              <button type="button" disabled={b.disabled} onClick={() => onMainButton(i)} className={cn("flex min-h-[84px] items-center justify-center rounded-2xl px-2 text-center text-lg font-bold leading-tight active:scale-[0.98] transition-transform", b.cls)}>
                {b.label}
              </button>
            </div>
            <div className="mt-3 flex items-center gap-3 text-sm text-white/80">
              <label className="flex items-center gap-2">
                <input type="checkbox" checked={p.auto} onChange={(e) => patch(i, { auto: e.target.checked })} className="h-4 w-4 accent-[#28a909]" /> Auto cash out
              </label>
              <input aria-label={`Bet ${i + 1} auto cash out multiplier`} inputMode="decimal" disabled={!p.auto || lockedInputs} value={p.autoAt} onChange={(e) => patch(i, { autoAt: Math.max(1.01, Number(e.target.value) || 1.01) })} className="w-20 rounded-full bg-black px-3 py-1 text-center tabular-nums disabled:opacity-40" />
              <span className="text-white/50">x</span>
            </div>
          </div>
        );
      })}

      {/* my bets */}
      <div className="space-y-2 rounded-2xl bg-[#1b1c1d] p-3">
        <p className="text-xs font-bold text-white/70">My bets</p>
        {mine.length === 0 && <p className="py-3 text-center text-xs text-white/40">No finished bets yet.</p>}
        {mine.map((m, i) => (
          <div key={i} className="flex items-center justify-between rounded-lg bg-black/40 px-3 py-2 text-sm">
            <span className="tabular-nums text-white/70">{m.id.slice(-6)} · {m.stake} pts</span>
            <span className={cn("font-bold tabular-nums", m.cashedAt ? "text-[#28a909]" : "text-[#e5253a]")}>
              {m.cashedAt ? `${m.cashedAt.toFixed(2)}x  +${m.win - m.stake}` : `crashed ${m.crash.toFixed(2)}x  -${m.stake}`}
            </span>
          </div>
        ))}
      </div>

      {/* fairness */}
      <div className="space-y-2 rounded-2xl bg-[#1b1c1d] p-3 text-[11px] text-white/60">
        <p className="flex items-center gap-1 font-bold text-white/80"><ShieldCheck className="h-4 w-4 text-[#28a909]" /> Provably fair (demo)</p>
        <p className="break-all">Current round hash (committed before betting): {commit || "..."}</p>
        {revealed && (
          <>
            <p className="break-all">Last round {revealed.id}: seed {revealed.seed}</p>
            <button type="button" onClick={verify} className="rounded-lg bg-[#2c2d30] px-3 py-1.5 text-white">Verify last round</button>
            {verifyMsg && <span className="ml-2 text-emerald-300">{verifyMsg}</span>}
          </>
        )}
        <p>Crash point = from SHA-256(&quot;seed:round&quot;), about 1% of rounds crash at 1.00x.</p>
      </div>
      <p className="text-center text-[11px] text-white/40">Runs only in your browser. Nothing touches your XArena wallet.</p>
    </div>
  );
}
