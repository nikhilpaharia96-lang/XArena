"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Redo2, ShieldCheck, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { START_POINTS, randomSeed, sha256Hex } from "@/lib/demo-color-game";
import { WHEEL_ORDER, betLabel, betReturn, colorOf, rouletteResult, type RColor } from "@/lib/demo-roulette";

const STORAGE_KEY = "xarena-demo-points";
const CHIPS = [1, 5, 10, 50, 100];
const SPIN_MS = 4600;
const STEP = 360 / 37;

const FILL: Record<RColor, string> = { red: "#c8202f", black: "#17171c", green: "#0e8f4a" };
const BG: Record<RColor, string> = { red: "bg-[#c8202f]", black: "bg-[#17171c]", green: "bg-[#0e8f4a]" };

interface Round { id: string; seed: string; commit: string }
interface Revealed { id: string; seed: string; commit: string; n: number }
interface Placed { key: string; amt: number }

/* ---------- wheel ---------- */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const a = (deg * Math.PI) / 180;
  return [Number((cx + r * Math.sin(a)).toFixed(2)), Number((cy - r * Math.cos(a)).toFixed(2))];
}
function slicePath(i: number): string {
  const a0 = i * STEP - STEP / 2;
  const a1 = i * STEP + STEP / 2;
  const [x0, y0] = polar(100, 100, 96, a0);
  const [x1, y1] = polar(100, 100, 96, a1);
  const [x2, y2] = polar(100, 100, 58, a1);
  const [x3, y3] = polar(100, 100, 58, a0);
  return `M${x0} ${y0} A96 96 0 0 1 ${x1} ${y1} L${x2} ${y2} A58 58 0 0 0 ${x3} ${y3}Z`;
}

function Wheel({ rotation, ballRotation, spinning }: { rotation: number; ballRotation: number; spinning: boolean }) {
  const t = spinning ? `transform ${SPIN_MS}ms cubic-bezier(0.12,0.6,0.1,1)` : "none";
  return (
    <div className="relative mx-auto h-64 w-64">
      {/* pointer */}
      <div className="absolute left-1/2 top-[-6px] z-20 h-0 w-0 -translate-x-1/2 border-x-[9px] border-t-[16px] border-x-transparent border-t-amber-300" />
      <div className="absolute inset-0 rounded-full bg-gradient-to-br from-amber-700 to-amber-950 p-1.5 shadow-[0_0_30px_rgba(0,0,0,0.6)]">
        <div className="relative h-full w-full" style={{ transform: `rotate(${rotation}deg)`, transition: t }}>
          <svg viewBox="0 0 200 200" className="h-full w-full">
            <circle cx="100" cy="100" r="99" fill="#2a1a0a" />
            {WHEEL_ORDER.map((n, i) => (
              <g key={n}>
                <path d={slicePath(i)} fill={FILL[colorOf(n)]} stroke="#d4a437" strokeWidth="0.4" />
                <text transform={`rotate(${(i * STEP).toFixed(3)} 100 100)`} x="100" y="16" textAnchor="middle" fontSize="7.5" fontWeight="700" fill="#fff">{n}</text>
              </g>
            ))}
            <circle cx="100" cy="100" r="58" fill="#3a2410" stroke="#d4a437" strokeWidth="1" />
            <circle cx="100" cy="100" r="38" fill="#1d1208" stroke="#d4a437" strokeWidth="1" />
            <circle cx="100" cy="100" r="6" fill="#d4a437" />
            {[0, 90, 180, 270].map((a) => (
              <rect key={a} x="98.5" y="64" width="3" height="28" rx="1.5" fill="#d4a437" transform={`rotate(${a} 100 100)`} />
            ))}
          </svg>
        </div>
        {/* ball orbits the opposite way and rests under the pointer */}
        <div className="pointer-events-none absolute inset-1.5" style={{ transform: `rotate(${ballRotation}deg)`, transition: t }}>
          <span className="absolute left-1/2 top-[3.5%] h-3.5 w-3.5 -translate-x-1/2 rounded-full bg-white shadow-[0_0_6px_rgba(255,255,255,0.9)]" />
        </div>
      </div>
    </div>
  );
}

/* ---------- board cell ---------- */
function BoardCell({ k, label, cls, aria, bets, disabled, onPlace }: { k: string; label: React.ReactNode; cls: string; aria: string; bets: Record<string, number>; disabled: boolean; onPlace: (k: string) => void }) {
  return (
    <button type="button" disabled={disabled} onClick={() => onPlace(k)} aria-label={aria} className={cn("relative flex items-center justify-center border border-white/25 text-xs font-bold text-white active:brightness-125 disabled:opacity-70", cls)}>
      {label}
      {bets[k] ? (
        <span className="absolute -right-1 -top-1 z-10 flex h-5 min-w-5 items-center justify-center rounded-full border border-amber-200 bg-amber-400 px-1 text-[10px] font-black text-black shadow">{bets[k]}</span>
      ) : null}
    </button>
  );
}

/* ---------- component ---------- */
export function RouletteGame() {
  const [balance, setBalance] = useState(START_POINTS);
  const [chip, setChip] = useState(10);
  const [bets, setBets] = useState<Record<string, number>>({});
  const [stack, setStack] = useState<Placed[]>([]);
  const [lastBets, setLastBets] = useState<Record<string, number>>({});
  const [round, setRound] = useState<Round | null>(null);
  const [rotation, setRotation] = useState(0);
  const [ballRot, setBallRot] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [result, setResult] = useState<number | null>(null);
  const [history, setHistory] = useState<number[]>([]);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const rotRef = useRef(0);
  const ballRef = useRef(0);
  const counterRef = useRef(1);

  useEffect(() => {
    const t = setTimeout(() => {
      try {
        const saved = Number(localStorage.getItem(STORAGE_KEY));
        if (Number.isFinite(saved) && saved > 0) setBalance(saved);
      } catch { /* storage unavailable */ }
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(balance)); } catch { /* ignore */ }
  }, [balance]);

  const newRound = useCallback(async () => {
    const seed = randomSeed();
    const commit = await sha256Hex(seed);
    const id = `RL${Date.now().toString().slice(-6)}${String(counterRef.current++).padStart(3, "0")}`;
    setRound({ id, seed, commit });
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { void newRound(); }, 0);
    return () => clearTimeout(t);
  }, [newRound]);

  const total = Object.values(bets).reduce((s, v) => s + v, 0);

  const place = (key: string) => {
    if (spinning) return;
    if (chip > balance) { setMessage("Not enough demo points. Tap Free 1000."); return; }
    setBalance((b) => b - chip);
    setBets((p) => ({ ...p, [key]: (p[key] ?? 0) + chip }));
    setStack((s) => [...s, { key, amt: chip }]);
    setMessage(null);
  };
  const undo = () => {
    if (spinning || stack.length === 0) return;
    const last = stack[stack.length - 1];
    setStack((s) => s.slice(0, -1));
    setBalance((b) => b + last.amt);
    setBets((p) => {
      const next = { ...p, [last.key]: (p[last.key] ?? 0) - last.amt };
      if (next[last.key] <= 0) delete next[last.key];
      return next;
    });
  };
  const clear = () => {
    if (spinning || total === 0) return;
    setBalance((b) => b + total);
    setBets({});
    setStack([]);
  };
  const rebet = () => {
    if (spinning) return;
    const sum = Object.values(lastBets).reduce((s, v) => s + v, 0);
    if (sum === 0) return;
    if (total > 0) { setBalance((b) => b + total); }
    const have = total > 0 ? balance + total : balance;
    if (sum > have) { setMessage("Not enough demo points for the same bets."); if (total > 0) setBalance((b) => b - total); return; }
    setBalance(have - sum);
    setBets({ ...lastBets });
    setStack(Object.entries(lastBets).map(([key, amt]) => ({ key, amt })));
    setMessage(null);
  };

  const spin = async () => {
    if (spinning || total === 0 || !round) return;
    setSpinning(true);
    setMessage(null);
    setVerifyMsg(null);
    const r = round;
    const n = await rouletteResult(r.seed, r.id);
    const idx = WHEEL_ORDER.indexOf(n as (typeof WHEEL_ORDER)[number]);
    // land pocket idx under the top pointer after several full turns
    const target = rotRef.current + 360 * 5 + ((((360 - idx * STEP) - (rotRef.current % 360)) % 360) + 360) % 360;
    rotRef.current = target;
    ballRef.current -= 360 * 6;
    setRotation(target);
    setBallRot(ballRef.current);
    setResult(null);

    const placed = { ...bets };
    setTimeout(() => {
      const returned = Object.entries(placed).reduce((s, [k, v]) => s + betReturn(k, v, n), 0);
      const staked = Object.values(placed).reduce((s, v) => s + v, 0);
      if (returned > 0) setBalance((b) => b + returned);
      setResult(n);
      setHistory((h) => [n, ...h].slice(0, 15));
      setRevealed({ id: r.id, seed: r.seed, commit: r.commit, n });
      const net = returned - staked;
      setMessage(net > 0 ? `${n} ${colorOf(n)}: you won ${net} pts` : net === 0 ? `${n} ${colorOf(n)}: you got your stake back` : `${n} ${colorOf(n)}: you lost ${-net} pts`);
      setLastBets(placed);
      setBets({});
      setStack([]);
      setSpinning(false);
      void newRound();
    }, SPIN_MS + 150);
  };

  const verify = async () => {
    if (!revealed) return;
    const okHash = (await sha256Hex(revealed.seed)) === revealed.commit;
    const okRes = (await rouletteResult(revealed.seed, revealed.id)) === revealed.n;
    setVerifyMsg(okHash && okRes ? "Verified: hash and result match." : "Mismatch!");
  };

  const rows = [3, 2, 1];
  const outside: [string, string, string][] = [
    ["low", "1-18", "bg-[#0b5d3b]"], ["even", "Even", "bg-[#0b5d3b]"], ["red", "Red", BG.red], ["black", "Black", BG.black], ["odd", "Odd", "bg-[#0b5d3b]"], ["high", "19-36", "bg-[#0b5d3b]"],
  ];

  return (
    <div className="force-dark mx-auto max-w-md space-y-3 rounded-3xl bg-[#0a0f0c] p-3 pb-6 text-white">
      <div className="flex items-center justify-between px-1">
        <p className="text-2xl font-black text-amber-300">Roulette <span className="text-xs font-bold text-white/50">DEMO</span></p>
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-black px-3 py-1 text-sm font-bold text-emerald-400 tabular-nums">{balance.toLocaleString("en-IN")} pts</span>
          <button type="button" onClick={() => { setBalance((b) => b + 1000); setMessage("+1000 free demo points"); }} className="rounded-full bg-[#1b1f1d] px-3 py-1 text-xs font-bold active:scale-95">+1000</button>
        </div>
      </div>
      <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-center text-xs text-white/90">
        <b>DEMO MODE</b> · Virtual points only. No deposit, no withdraw, no real money.
      </div>

      {/* history */}
      <div className="flex min-h-9 gap-1.5 overflow-x-auto rounded-full bg-[#141917] px-3 py-1.5">
        {history.length === 0 && <span className="text-xs text-white/40">Spin results appear here</span>}
        {history.map((h, i) => <span key={i} className={cn("flex h-6 min-w-6 shrink-0 items-center justify-center rounded-full px-1 text-xs font-bold", BG[colorOf(h)])}>{h}</span>)}
      </div>

      {/* wheel */}
      <div className="relative rounded-2xl bg-gradient-to-b from-[#12261b] to-[#0a0f0c] px-2 py-5">
        <Wheel rotation={rotation} ballRotation={ballRot} spinning={spinning} />
        <div className="mt-3 flex h-10 items-center justify-center">
          {spinning && <p className="animate-pulse text-sm font-bold text-white/70">Spinning...</p>}
          {!spinning && result !== null && (
            <span className={cn("rounded-full px-5 py-1.5 text-2xl font-black", BG[colorOf(result)])}>{result}</span>
          )}
          {!spinning && result === null && <p className="text-sm text-white/50">Place chips, then press Spin</p>}
        </div>
      </div>

      {message && <p className="text-center text-sm font-bold text-emerald-300">{message}</p>}

      {/* chips */}
      <div className="flex items-center justify-between gap-1.5">
        {CHIPS.map((c) => (
          <button key={c} type="button" aria-label={`Chip ${c}`} onClick={() => setChip(c)} className={cn("flex h-12 w-12 items-center justify-center rounded-full border-4 border-dashed text-sm font-black active:scale-90 transition-transform", c === chip ? "border-white bg-amber-500 text-black" : "border-white/40 bg-[#1b1f1d] text-white/80")}>
            {c}
          </button>
        ))}
      </div>

      {/* board */}
      <div className="rounded-xl bg-[#0b5d3b] p-1.5 shadow-inner">
        <div className="grid" style={{ gridTemplateColumns: "repeat(13,minmax(0,1fr))" }}>
          <div className="col-span-13 grid" style={{ gridColumn: "1 / span 13" }}>
            <BoardCell bets={bets} disabled={spinning} onPlace={place} k="n:0" label="0" cls={cn("h-9", BG.green)} aria="Bet on 0" />
          </div>
          {rows.map((r) => (
            <div key={r} className="contents">
              {Array.from({ length: 12 }, (_, c) => {
                const n = r + 3 * c;
                return <BoardCell bets={bets} disabled={spinning} onPlace={place} key={n} k={`n:${n}`} label={n} cls={cn("h-10", BG[colorOf(n)])} aria={`Bet on ${n}`} />;
              })}
              <BoardCell bets={bets} disabled={spinning} onPlace={place} k={`c${r === 3 ? 3 : r === 2 ? 2 : 1}`} label="2:1" cls="h-10 bg-[#0b5d3b] text-[11px]" aria={`Bet on column ${r === 3 ? 3 : r === 2 ? 2 : 1}`} />
            </div>
          ))}
          {(["d1", "d2", "d3"] as const).map((k, i) => (
            <div key={k} className="grid" style={{ gridColumn: "span 4" }}>
              <BoardCell bets={bets} disabled={spinning} onPlace={place} k={k} label={["1st 12", "2nd 12", "3rd 12"][i]} cls="h-9 bg-[#0b5d3b]" aria={`Bet on ${["1st", "2nd", "3rd"][i]} dozen`} />
            </div>
          ))}
          <div />
        </div>
        <div className="mt-0 grid grid-cols-6">
          {outside.map(([k, l, c]) => <BoardCell bets={bets} disabled={spinning} onPlace={place} key={k} k={k} label={l} cls={cn("h-9 text-[11px]", c)} aria={`Bet on ${l}`} />)}
        </div>
      </div>

      {/* actions */}
      <div className="grid grid-cols-[auto_auto_auto_1fr] items-center gap-2">
        <button type="button" onClick={undo} disabled={spinning || stack.length === 0} aria-label="Undo" className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1b1f1d] disabled:opacity-40"><Undo2 className="h-5 w-5" /></button>
        <button type="button" onClick={clear} disabled={spinning || total === 0} aria-label="Clear bets" className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1b1f1d] disabled:opacity-40"><Trash2 className="h-5 w-5" /></button>
        <button type="button" onClick={rebet} disabled={spinning || Object.keys(lastBets).length === 0} aria-label="Repeat last bets" className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1b1f1d] disabled:opacity-40"><Redo2 className="h-5 w-5" /></button>
        <button type="button" onClick={spin} disabled={spinning || total === 0 || !round} className="h-12 rounded-xl bg-gradient-to-r from-amber-400 to-amber-600 text-base font-black text-black disabled:opacity-40 active:scale-[0.98] transition-transform">
          {spinning ? "Spinning..." : `Spin · ${total} pts`}
        </button>
      </div>

      {Object.keys(bets).length > 0 && (
        <div className="flex flex-wrap gap-1.5 text-[11px] text-white/70">
          {Object.entries(bets).map(([k, v]) => <span key={k} className="rounded-full bg-[#1b1f1d] px-2.5 py-1">{betLabel(k)}: {v}</span>)}
        </div>
      )}

      <p className="text-center text-[11px] text-white/50">Payouts: number 35:1 · Red/Black/Odd/Even/1-18/19-36 1:1 · Dozens and columns 2:1 · 0 loses outside bets</p>

      {/* fairness */}
      <div className="space-y-2 rounded-2xl bg-[#141917] p-3 text-[11px] text-white/60">
        <p className="flex items-center gap-1 font-bold text-white/80"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Provably fair (demo)</p>
        <p className="break-all">Current round hash (committed before you spin): {round?.commit ?? "..."}</p>
        {revealed && (
          <>
            <p className="break-all">Last round {revealed.id}: seed {revealed.seed}</p>
            <button type="button" onClick={verify} className="rounded-lg bg-[#1f2924] px-3 py-1.5 text-white">Verify last round</button>
            {verifyMsg && <span className="ml-2 text-emerald-300">{verifyMsg}</span>}
          </>
        )}
        <p>Result = first 8 hex of SHA-256(&quot;seed:round&quot;) mod 37.</p>
      </div>
      <p className="text-center text-[11px] text-white/40">Runs only in your browser. Nothing touches your XArena wallet.</p>
    </div>
  );
}
