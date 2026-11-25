"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/cn";
import { START_POINTS, randomSeed, sha256Hex } from "@/lib/demo-color-game";
import { BETS, LINES, NAMES, PAY, SYMBOLS, evaluate, spinGrid, type LineWin, type Sym } from "@/lib/demo-gems";

const STORAGE_KEY = "xarena-demo-points";
const STOP_AT = [700, 1100, 1500];
const INITIAL: Sym[] = ["ruby", "sapphire", "emerald", "topaz", "wild", "ruby", "amethyst", "diamond", "sapphire"];

interface Round { id: string; seed: string; commit: string }
interface Revealed { id: string; seed: string; commit: string; grid: Sym[] }
interface HistoryItem { id: string; bet: number; win: number }

/* ---------- original gem art (SVG) ---------- */
const GRAD: Record<Sym, [string, string]> = {
  diamond: ["#e8fbff", "#4fc3f7"],
  amethyst: ["#d9a8ff", "#7a2fd0"],
  topaz: ["#ffe27a", "#f08a00"],
  emerald: ["#7df0a8", "#0b8a46"],
  sapphire: ["#8fc2ff", "#1747c7"],
  ruby: ["#ff8f9c", "#c4122e"],
  wild: ["#fff1a8", "#d99a00"],
};

function Gem({ sym, size = 72 }: { sym: Sym; size?: number }) {
  const [c1, c2] = GRAD[sym];
  const id = `gem-${sym}`;
  const facet = "rgba(255,255,255,0.35)";
  const shade = "rgba(0,0,0,0.22)";
  let body: React.ReactNode;
  switch (sym) {
    case "diamond":
      body = (<>
        <polygon points="25,22 75,22 94,42 50,92 6,42" fill={`url(#${id})`} />
        <polygon points="25,22 50,42 6,42" fill={facet} /><polygon points="75,22 50,42 94,42" fill={shade} />
        <polygon points="25,22 50,22 50,42" fill="rgba(255,255,255,0.5)" /><polygon points="6,42 50,42 50,92" fill={shade} />
      </>);
      break;
    case "ruby":
      body = (<>
        <polygon points="30,10 70,10 94,50 70,90 30,90 6,50" fill={`url(#${id})`} />
        <polygon points="30,10 70,10 60,34 40,34" fill={facet} /><polygon points="6,50 30,10 40,34" fill="rgba(255,255,255,0.18)" />
        <polygon points="70,90 94,50 60,66" fill={shade} /><polygon points="30,90 70,90 60,66 40,66" fill={shade} />
      </>);
      break;
    case "sapphire":
      body = (<>
        <polygon points="50,6 92,50 50,94 8,50" fill={`url(#${id})`} />
        <polygon points="50,6 92,50 50,50" fill={facet} /><polygon points="50,94 92,50 50,50" fill={shade} /><polygon points="8,50 50,50 50,94" fill="rgba(0,0,0,0.1)" />
      </>);
      break;
    case "emerald":
      body = (<>
        <polygon points="26,8 74,8 92,26 92,74 74,92 26,92 8,74 8,26" fill={`url(#${id})`} />
        <polygon points="30,30 70,30 70,70 30,70" fill="rgba(255,255,255,0.12)" stroke={facet} strokeWidth="2" />
        <polygon points="26,8 74,8 70,30 30,30" fill={facet} /><polygon points="26,92 74,92 70,70 30,70" fill={shade} />
      </>);
      break;
    case "topaz":
      body = (<>
        <circle cx="50" cy="50" r="43" fill={`url(#${id})`} />
        <polygon points="50,12 78,28 78,62 50,88 22,62 22,28" fill="rgba(255,255,255,0.14)" stroke={facet} strokeWidth="2" />
        <polygon points="50,12 78,28 50,40 22,28" fill={facet} /><polygon points="50,88 78,62 50,52 22,62" fill={shade} />
      </>);
      break;
    case "amethyst":
      body = (<>
        <polygon points="50,6 88,30 88,64 50,94 12,64 12,30" fill={`url(#${id})`} />
        <polygon points="50,6 88,30 50,46 12,30" fill={facet} /><polygon points="12,30 50,46 12,64" fill="rgba(255,255,255,0.15)" />
        <polygon points="50,94 88,64 50,46" fill={shade} />
      </>);
      break;
    case "wild":
      body = (<>
        <polygon points="50,4 62,36 96,38 69,59 79,92 50,72 21,92 31,59 4,38 38,36" fill={`url(#${id})`} stroke="#8a5a00" strokeWidth="2" />
        <text x="50" y="62" textAnchor="middle" fontSize="30" fontWeight="900" fill="#5a3600" fontFamily="system-ui,sans-serif">W</text>
      </>);
      break;
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label={NAMES[sym]} role="img" className="drop-shadow-[0_3px_6px_rgba(0,0,0,0.55)]">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      {body}
    </svg>
  );
}

function randomSym(): Sym {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

/* ---------- component ---------- */
export function FortuneGemsGame() {
  const [balance, setBalance] = useState(START_POINTS);
  const [betIdx, setBetIdx] = useState(1);
  const [grid, setGrid] = useState<Sym[]>(INITIAL);
  const [stopped, setStopped] = useState(3);
  const [spinning, setSpinning] = useState(false);
  const [wins, setWins] = useState<LineWin[]>([]);
  const [lastWin, setLastWin] = useState(0);
  const [round, setRound] = useState<Round | null>(null);
  const [auto, setAuto] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPay, setShowPay] = useState(false);

  const balanceRef = useRef(START_POINTS);
  const roundRef = useRef<Round | null>(null);
  const spinningRef = useRef(false);
  const counterRef = useRef(1);
  const betRef = useRef(BETS[1]);

  const updateBalance = useCallback((fn: (b: number) => number) => {
    balanceRef.current = fn(balanceRef.current);
    setBalance(balanceRef.current);
  }, []);

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

  const newRound = useCallback(async () => {
    const seed = randomSeed();
    const commit = await sha256Hex(seed);
    const id = `GM${Date.now().toString().slice(-6)}${String(counterRef.current++).padStart(3, "0")}`;
    const r = { id, seed, commit };
    roundRef.current = r;
    setRound(r);
  }, []);
  useEffect(() => {
    const t = setTimeout(() => { void newRound(); }, 0);
    return () => clearTimeout(t);
  }, [newRound]);

  const spin = useCallback(async () => {
    const r = roundRef.current;
    if (spinningRef.current || !r) return;
    const bet = betRef.current;
    if (bet > balanceRef.current) { setMessage("Not enough demo points. Lower the bet or tap +1000."); setAuto(0); return; }
    spinningRef.current = true;
    setSpinning(true);
    setStopped(0);
    setWins([]);
    setLastWin(0);
    setMessage(null);
    setVerifyMsg(null);
    updateBalance((b) => b - bet);

    const final = await spinGrid(r.seed, r.id);
    const start = Date.now();
    await new Promise<void>((resolve) => {
      const iv = setInterval(() => {
        const el = Date.now() - start;
        setGrid((prev) => prev.map((_, i) => (el >= STOP_AT[i % 3] ? final[i] : randomSym())));
        setStopped(STOP_AT.filter((t) => el >= t).length);
        if (el >= STOP_AT[2] + 40) { clearInterval(iv); resolve(); }
      }, 80);
    });

    setGrid(final);
    setStopped(3);
    const res = evaluate(final, bet);
    if (res.total > 0) updateBalance((b) => b + res.total);
    setWins(res.wins);
    setLastWin(res.total);
    setHistory((h) => [{ id: r.id, bet, win: res.total }, ...h].slice(0, 12));
    setRevealed({ id: r.id, seed: r.seed, commit: r.commit, grid: final });
    if (res.total >= bet * 20) setMessage(`MEGA WIN! +${res.total} pts`);
    else if (res.total >= bet * 8) setMessage(`BIG WIN! +${res.total} pts`);
    else if (res.total > 0) setMessage(`You won ${res.total} pts`);
    await newRound();
    spinningRef.current = false;
    setSpinning(false);
  }, [newRound, updateBalance]);

  /* autoplay */
  useEffect(() => {
    if (auto <= 0 || spinning || !round) return;
    const t = setTimeout(() => { setAuto((a) => a - 1); void spin(); }, 1100);
    return () => clearTimeout(t);
  }, [auto, spinning, round, spin]);

  const bet = BETS[betIdx];
  const changeBet = (d: number) => {
    if (spinning) return;
    const i = Math.min(BETS.length - 1, Math.max(0, betIdx + d));
    setBetIdx(i);
    betRef.current = BETS[i];
  };
  const maxBet = () => { if (spinning) return; setBetIdx(BETS.length - 1); betRef.current = BETS[BETS.length - 1]; };

  const verify = async () => {
    if (!revealed) return;
    const okHash = (await sha256Hex(revealed.seed)) === revealed.commit;
    const regrid = await spinGrid(revealed.seed, revealed.id);
    setVerifyMsg(okHash && regrid.every((s, i) => s === revealed.grid[i]) ? "Verified: hash and reels match." : "Mismatch!");
  };

  const winCells = new Set(wins.flatMap((w) => w.cells));

  return (
    <div className="force-dark mx-auto max-w-md space-y-3 rounded-3xl bg-gradient-to-b from-[#2a0b52] to-[#12041f] p-3 pb-6 text-white">
      <div className="flex items-center justify-between px-1">
        <p className="whitespace-nowrap bg-gradient-to-b from-[#fff3b0] to-[#e0a100] bg-clip-text text-xl font-black text-transparent">Fortune Gems <span className="text-xs font-bold text-white/50">DEMO</span></p>
        <div className="flex items-center gap-2">
          <span className="whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-sm font-bold text-amber-300 tabular-nums">{balance.toLocaleString("en-IN")} pts</span>
          <button type="button" onClick={() => { updateBalance((b) => b + 1000); setMessage("+1000 free demo points"); }} className="rounded-full bg-white/10 px-3 py-1 text-xs font-bold active:scale-95">+1000</button>
        </div>
      </div>
      <div className="rounded-lg bg-amber-500/15 px-3 py-2 text-center text-xs text-white/90">
        <b>DEMO MODE</b> · Virtual points only. No deposit, no withdraw, no real money.
      </div>

      {/* reels */}
      <div className="rounded-3xl border-4 border-amber-500/80 bg-gradient-to-b from-[#3b1470] to-[#1e0a3a] p-3 shadow-[0_0_30px_rgba(245,197,66,0.25)]">
        <div className="grid grid-cols-3 gap-2">
          {[0, 1, 2].map((col) => (
            <div key={col} className={cn("space-y-2 rounded-2xl bg-black/40 p-2", spinning && stopped <= col && "blur-[1.5px]")}>
              {[0, 1, 2].map((row) => {
                const i = row * 3 + col;
                const hit = winCells.has(i);
                return (
                  <div key={row} className={cn("flex aspect-square items-center justify-center rounded-xl bg-gradient-to-b from-[#2f1160] to-[#190833]", hit && "animate-pulse ring-4 ring-amber-300 shadow-[0_0_18px_rgba(252,211,77,0.9)]")}>
                    <Gem sym={grid[i]} size={72} />
                  </div>
                );
              })}
            </div>
          ))}
        </div>
        <div className="mt-3 flex h-12 items-center justify-center rounded-xl bg-black/50">
          {spinning ? <p className="animate-pulse text-sm font-bold text-white/70">Good luck...</p>
            : lastWin > 0 ? <p className="text-xl font-black text-amber-300">WIN +{lastWin}</p>
            : <p className="text-sm text-white/50">5 paylines · wild substitutes</p>}
        </div>
      </div>

      {message && <p className={cn("text-center text-sm font-bold", lastWin > 0 ? "text-amber-300" : "text-emerald-300")}>{message}</p>}
      {wins.length > 0 && !spinning && (
        <div className="space-y-1 rounded-xl bg-black/30 p-2 text-xs text-white/80">
          {wins.map((w) => (
            <div key={w.line} className="flex items-center justify-between">
              <span>Line {w.line + 1}: 3 × {NAMES[w.symbol]}</span><span className="font-bold text-amber-300">+{w.amount}</span>
            </div>
          ))}
        </div>
      )}

      {/* controls */}
      <div className="grid grid-cols-[1fr_auto] items-center gap-3">
        <div className="space-y-2">
          <div className="flex items-center justify-between rounded-full bg-black/50 px-2 py-1.5">
            <button type="button" onClick={() => changeBet(-1)} disabled={spinning || betIdx === 0} aria-label="Decrease bet" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"><Minus className="h-4 w-4" /></button>
            <div className="text-center leading-tight"><p className="text-[10px] text-white/50">BET</p><p className="text-lg font-black tabular-nums">{bet}</p></div>
            <button type="button" onClick={() => changeBet(1)} disabled={spinning || betIdx === BETS.length - 1} aria-label="Increase bet" className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 disabled:opacity-40"><Plus className="h-4 w-4" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={maxBet} disabled={spinning} className="h-9 rounded-lg bg-white/10 text-xs font-bold disabled:opacity-40">MAX BET</button>
            <button type="button" onClick={() => setAuto((a) => (a > 0 ? 0 : 10))} className={cn("h-9 rounded-lg text-xs font-bold", auto > 0 ? "bg-red-600" : "bg-white/10")}>{auto > 0 ? `STOP (${auto})` : "AUTO ×10"}</button>
          </div>
        </div>
        <button type="button" onClick={() => void spin()} disabled={spinning || !round} aria-label="Spin" className="flex h-24 w-24 items-center justify-center rounded-full border-4 border-amber-200 bg-gradient-to-b from-[#ffd84d] to-[#e08a00] text-lg font-black text-[#4a2a00] shadow-[0_0_20px_rgba(245,197,66,0.5)] active:scale-95 transition-transform disabled:opacity-60">
          {spinning ? "…" : "SPIN"}
        </button>
      </div>

      {/* paytable */}
      <button type="button" onClick={() => setShowPay((v) => !v)} className="w-full rounded-xl bg-white/10 py-2 text-sm font-bold">{showPay ? "Hide paytable" : "Show paytable"}</button>
      {showPay && (
        <div className="space-y-2 rounded-2xl bg-black/30 p-3">
          <div className="grid grid-cols-2 gap-2">
            {SYMBOLS.slice().sort((a, b) => PAY[b] - PAY[a]).map((s) => (
              <div key={s} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1">
                <Gem sym={s} size={32} />
                <div className="text-xs leading-tight"><p className="font-bold">{NAMES[s]}</p><p className="text-amber-300">3× = {PAY[s]}× line bet</p></div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-white/60">Bet is split over 5 paylines (top, middle, bottom, 2 diagonals). Wild substitutes for any gem. Lines: {LINES.map((l) => l.map((c) => c + 1).join("-")).join(" · ")} (cells numbered 1-9, row by row).</p>
        </div>
      )}

      {history.length > 0 && (
        <div className="space-y-1 rounded-2xl bg-black/30 p-3 text-xs">
          <p className="font-bold text-white/70">Recent spins</p>
          {history.map((h) => (
            <div key={h.id} className="flex items-center justify-between text-white/80">
              <span className="tabular-nums">{h.id.slice(-6)} · bet {h.bet}</span>
              <span className={cn("font-bold tabular-nums", h.win > 0 ? "text-amber-300" : "text-white/40")}>{h.win > 0 ? `+${h.win}` : "0"}</span>
            </div>
          ))}
        </div>
      )}

      {/* fairness */}
      <div className="space-y-2 rounded-2xl bg-black/30 p-3 text-[11px] text-white/60">
        <p className="flex items-center gap-1 font-bold text-white/80"><ShieldCheck className="h-4 w-4 text-emerald-400" /> Provably fair (demo)</p>
        <p className="break-all">Current round hash (committed before you spin): {round?.commit ?? "..."}</p>
        {revealed && (
          <>
            <p className="break-all">Last round {revealed.id}: seed {revealed.seed}</p>
            <button type="button" onClick={verify} className="rounded-lg bg-white/10 px-3 py-1.5 text-white">Verify last round</button>
            {verifyMsg && <span className="ml-2 text-emerald-300">{verifyMsg}</span>}
          </>
        )}
        <p>Each reel cell comes from SHA-256(&quot;seed:round&quot;). Return to player about 95%.</p>
      </div>
      <p className="text-center text-[11px] text-white/40">Runs only in your browser. Nothing touches your XArena wallet.</p>
    </div>
  );
}
