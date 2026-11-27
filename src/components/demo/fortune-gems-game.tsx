"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Info, Minus, Plus, Repeat, Settings, ShieldCheck, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { START_POINTS, randomSeed, sha256Hex } from "@/lib/demo-color-game";
import {
  BETS,
  EXTRA_BET_FACTOR,
  LINES,
  NAMES,
  PAY,
  SYMBOLS,
  evaluate,
  spinRound,
  totalCost,
  type LineWin,
  type Sym,
} from "@/lib/demo-gems";

const STORAGE_KEY = "xarena-demo-points";
const STOP_AT = [700, 1050, 1400, 1900];
const INITIAL: Sym[] = ["ruby", "sapphire", "emerald", "topaz", "wild", "ruby", "amethyst", "diamond", "sapphire"];
const INITIAL_MULTS = [3, 5, 2];
const SPIN_MULTS = [1, 2, 3, 5, 8, 10, 15, 20];
const ROW_H = 92; // px per row on the reel board

interface Round { id: string; seed: string; commit: string }
interface Revealed { id: string; seed: string; commit: string; grid: Sym[]; mults: number[]; extra: boolean }
interface HistoryItem { id: string; cost: number; win: number; mult: number }

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
  const facet = "rgba(255,255,255,0.38)";
  const shade = "rgba(0,0,0,0.24)";
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
    case "wild": {
      // golden sun idol: rays + face (original artwork)
      const rays = Array.from({ length: 12 }, (_, i) => (
        <polygon key={i} points="50,2 56,22 44,22" fill="#f6c431" stroke="#8a5a00" strokeWidth="1.2" transform={`rotate(${i * 30} 50 50)`} />
      ));
      body = (<>
        {rays}
        <circle cx="50" cy="50" r="28" fill={`url(#${id})`} stroke="#8a5a00" strokeWidth="2.5" />
        <path d="M36 44 q5 -5 10 0 M54 44 q5 -5 10 0" stroke="#5a3600" strokeWidth="3" fill="none" strokeLinecap="round" />
        <path d="M40 60 q10 9 20 0" stroke="#5a3600" strokeWidth="3.5" fill="none" strokeLinecap="round" />
        <circle cx="50" cy="52" r="3" fill="#b8231f" />
        <text x="50" y="97" textAnchor="middle" fontSize="12" fontWeight="900" fill="#fff6c8" stroke="#5a3600" strokeWidth="0.6" fontFamily="system-ui,sans-serif">WILD</text>
      </>);
      break;
    }
  }
  return (
    <svg viewBox="0 0 100 100" width={size} height={size} aria-label={NAMES[sym]} role="img" className="drop-shadow-[0_3px_5px_rgba(0,0,0,0.5)]">
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={c1} /><stop offset="1" stopColor={c2} />
        </linearGradient>
      </defs>
      {body}
    </svg>
  );
}

/* ---------- original temple & jungle scene ---------- */
function Scene() {
  const leaf = (cx: number, cy: number, r: number, c: string) => <circle key={`${cx}-${cy}-${r}`} cx={cx} cy={cy} r={r} fill={c} />;
  return (
    <svg viewBox="0 0 400 230" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full" aria-hidden="true">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#3f93de" /><stop offset="0.45" stopColor="#f2a56c" /><stop offset="0.75" stopColor="#ffd98a" /><stop offset="1" stopColor="#6a4a22" />
        </linearGradient>
        <radialGradient id="sun" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#fffbe0" stopOpacity="1" /><stop offset="1" stopColor="#ffd98a" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="stone" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7a5128" /><stop offset="0.5" stopColor="#b98a50" /><stop offset="1" stopColor="#6e4822" />
        </linearGradient>
      </defs>
      <rect width="400" height="230" fill="url(#sky)" />
      <circle cx="200" cy="150" r="120" fill="url(#sun)" />
      {/* distant towers */}
      <g fill="#a8744a" opacity="0.8">
        <polygon points="70,170 70,140 78,140 78,122 86,122 86,108 94,108 94,122 102,122 102,140 110,140 110,170" />
        <polygon points="290,170 290,140 298,140 298,122 306,122 306,108 314,108 314,122 322,122 322,140 330,140 330,170" />
      </g>
      {/* main temple */}
      <g fill="url(#stone)" stroke="#4a2e12" strokeWidth="1">
        <rect x="120" y="170" width="160" height="14" />
        <polygon points="150,170 150,150 250,150 250,170" />
        <polygon points="165,150 165,128 235,128 235,150" />
        <polygon points="178,128 178,108 222,108 222,128" />
        <polygon points="188,108 188,90 212,90 212,108" />
        <polygon points="196,90 200,70 204,90" />
      </g>
      <rect x="190" y="152" width="20" height="18" fill="#2a1808" />
      {[130, 142, 154, 246, 258, 270].map((x) => <rect key={x} x={x} y="154" width="5" height="16" fill="#8a5d2e" />)}
      {/* ground */}
      <rect x="0" y="184" width="400" height="46" fill="#4a3a1c" />
      <rect x="0" y="184" width="400" height="6" fill="#6b5a2a" />
      {/* foliage */}
      <g>
        {[[10, 20, 46, "#2c6a2a"], [50, 10, 40, "#3a8a34"], [20, 70, 40, "#2f7a2e"], [70, 55, 30, "#3f9a3c"], [0, 120, 34, "#2c6a2a"]].map(([x, y, r, c]) => leaf(x as number, y as number, r as number, c as string))}
        {[[390, 20, 46, "#2c6a2a"], [350, 10, 40, "#3a8a34"], [380, 70, 40, "#2f7a2e"], [330, 55, 30, "#3f9a3c"], [400, 120, 34, "#2c6a2a"]].map(([x, y, r, c]) => leaf(x as number, y as number, r as number, c as string))}
      </g>
      <g fill="#c2552e">
        <circle cx="352" cy="176" r="5" /><circle cx="364" cy="180" r="4" /><circle cx="44" cy="178" r="5" />
      </g>
    </svg>
  );
}

/* ---------- multiplier badge ---------- */
function multColor(m: number): [string, string] {
  if (m >= 15) return ["#ff6b6b", "#b3122e"];
  if (m >= 8) return ["#c39bff", "#6a2fc9"];
  if (m >= 5) return ["#8da2ff", "#2c3fb8"];
  if (m >= 3) return ["#7fd3ee", "#1f86b8"];
  if (m >= 2) return ["#7fe0c2", "#12856a"];
  return ["#cfd8e3", "#6a7b8f"];
}
function MultBadge({ m, active, glow }: { m: number; active: boolean; glow: boolean }) {
  const [a, b] = multColor(m);
  return (
    <div className={cn("flex flex-1 items-center justify-center rounded-lg", active && "bg-black/20 ring-2 ring-amber-300", active && glow && "animate-pulse shadow-[0_0_16px_rgba(252,211,77,0.95)]")}>
      <span className="flex h-[66px] w-[66px] items-center justify-center rounded-full border-[3px] border-amber-400 shadow-[inset_0_-4px_8px_rgba(0,0,0,0.35),0_2px_5px_rgba(0,0,0,0.5)]" style={{ background: `radial-gradient(circle at 35% 30%, ${a}, ${b})` }}>
        <span className="text-2xl font-black italic text-amber-200 [text-shadow:0_2px_0_#5a3600]">{m}x</span>
      </span>
    </div>
  );
}

/* ---------- reel with merged tall symbols ---------- */
function Reel({ col, grid, hit, blur }: { col: number; grid: Sym[]; hit: Set<number>; blur: boolean }) {
  const cells = [0, 1, 2].map((r) => ({ sym: grid[r * 3 + col], hit: hit.has(r * 3 + col) }));
  const runs: { sym: Sym; n: number; hit: boolean }[] = [];
  for (const c of cells) {
    const last = runs[runs.length - 1];
    if (last && last.sym === c.sym) { last.n++; last.hit = last.hit || c.hit; } else runs.push({ sym: c.sym, n: 1, hit: c.hit });
  }
  const size = [0, 52, 76, 88];
  return (
    <div className={cn("flex flex-col gap-1 rounded-xl bg-[#3a2410] p-1", blur && "blur-[1.5px]")} style={{ height: ROW_H * 3 + 12 }}>
      {runs.map((r, i) => (
        <div key={i} style={{ flex: r.n }} className={cn("flex items-center justify-center rounded-lg border-2 border-[#7a4a08] bg-gradient-to-b from-[#f9d25a] via-[#e3a521] to-[#b87a12] shadow-[inset_0_2px_3px_rgba(255,255,255,0.5)]", r.hit && "animate-pulse ring-4 ring-white/90 shadow-[0_0_20px_rgba(255,255,255,0.95)]")}>
          <Gem sym={r.sym} size={size[r.n]} />
        </div>
      ))}
    </div>
  );
}

function randomSym(): Sym { return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)]; }
function randomMult(): number { return SPIN_MULTS[Math.floor(Math.random() * SPIN_MULTS.length)]; }

/* ---------- component ---------- */
export function FortuneGemsGame() {
  const [balance, setBalance] = useState(START_POINTS);
  const [betIdx, setBetIdx] = useState(0);
  const [extra, setExtra] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [grid, setGrid] = useState<Sym[]>(INITIAL);
  const [mults, setMults] = useState<number[]>(INITIAL_MULTS);
  const [stopped, setStopped] = useState(4);
  const [spinning, setSpinning] = useState(false);
  const [wins, setWins] = useState<LineWin[]>([]);
  const [lastWin, setLastWin] = useState(0);
  const [usedMult, setUsedMult] = useState(1);
  const [round, setRound] = useState<Round | null>(null);
  const [auto, setAuto] = useState(0);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showInfo, setShowInfo] = useState(false);

  const balanceRef = useRef(START_POINTS);
  const roundRef = useRef<Round | null>(null);
  const spinningRef = useRef(false);
  const counterRef = useRef(1);
  const betRef = useRef(BETS[0]);
  const extraRef = useRef(false);
  const turboRef = useRef(false);

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
    const ex = extraRef.current;
    const cost = totalCost(bet, ex);
    if (cost > balanceRef.current) { setMessage("Not enough demo points. Lower the bet or tap +1000."); setAuto(0); return; }
    spinningRef.current = true;
    setSpinning(true);
    setStopped(0);
    setWins([]);
    setLastWin(0);
    setUsedMult(1);
    setMessage(null);
    setVerifyMsg(null);
    updateBalance((b) => b - cost);

    const result = await spinRound(r.seed, r.id, ex);
    const speed = turboRef.current ? 0.5 : 1;
    const stops = STOP_AT.map((t) => t * speed);
    const start = Date.now();
    await new Promise<void>((resolve) => {
      const iv = setInterval(() => {
        const el = Date.now() - start;
        setGrid((prev) => prev.map((_, i) => (el >= stops[i % 3] ? result.grid[i] : randomSym())));
        setMults(el >= stops[3] ? result.mults : [randomMult(), randomMult(), randomMult()]);
        setStopped(stops.filter((t) => el >= t).length);
        if (el >= stops[3] + 40) { clearInterval(iv); resolve(); }
      }, 80);
    });

    setGrid(result.grid);
    setMults(result.mults);
    setStopped(4);
    const active = result.mults[1];
    const res = evaluate(result.grid, bet, active);
    if (res.total > 0) updateBalance((b) => b + res.total);
    setWins(res.wins);
    setLastWin(res.total);
    setUsedMult(active);
    setHistory((h) => [{ id: r.id, cost, win: res.total, mult: res.total > 0 ? active : 1 }, ...h].slice(0, 12));
    setRevealed({ id: r.id, seed: r.seed, commit: r.commit, grid: result.grid, mults: result.mults, extra: ex });
    if (res.total >= cost * 20) setMessage(`MEGA WIN! +${res.total} pts`);
    else if (res.total >= cost * 8) setMessage(`BIG WIN! +${res.total} pts`);
    else if (res.total > 0) setMessage(`You won ${res.total} pts${active > 1 ? ` (${res.base} × ${active}x)` : ""}`);
    await newRound();
    spinningRef.current = false;
    setSpinning(false);
  }, [newRound, updateBalance]);

  /* autoplay */
  useEffect(() => {
    if (auto <= 0 || spinning || !round) return;
    const t = setTimeout(() => { setAuto((a) => a - 1); void spin(); }, turboRef.current ? 500 : 1000);
    return () => clearTimeout(t);
  }, [auto, spinning, round, spin]);

  const bet = BETS[betIdx];
  const cost = totalCost(bet, extra);
  const changeBet = (d: number) => {
    if (spinning) return;
    const i = Math.min(BETS.length - 1, Math.max(0, betIdx + d));
    setBetIdx(i);
    betRef.current = BETS[i];
  };
  const toggleExtra = () => { if (spinning) return; extraRef.current = !extra; setExtra(!extra); };
  const toggleTurbo = () => { turboRef.current = !turbo; setTurbo(!turbo); };

  const verify = async () => {
    if (!revealed) return;
    const okHash = (await sha256Hex(revealed.seed)) === revealed.commit;
    const re = await spinRound(revealed.seed, revealed.id, revealed.extra);
    const same = re.grid.every((s, i) => s === revealed.grid[i]) && re.mults.every((m, i) => m === revealed.mults[i]);
    setVerifyMsg(okHash && same ? "Verified: hash, reels and multiplier match." : "Mismatch!");
  };

  const winCells = new Set(wins.flatMap((w) => w.cells));

  return (
    <div className="force-dark mx-auto max-w-md overflow-hidden rounded-3xl bg-[#2a1a0c] text-white shadow-2xl">
      {/* scene */}
      <div className="relative h-52 overflow-hidden">
        <Scene />
        <div className="absolute right-3 top-3 flex items-center gap-2">
          <span className="whitespace-nowrap rounded-full bg-black/60 px-3 py-1 text-xs font-bold text-amber-300 tabular-nums">{balance.toLocaleString("en-IN")} pts</span>
          <button type="button" onClick={() => { updateBalance((b) => b + 1000); setMessage("+1000 free demo points"); }} className="rounded-full bg-black/60 px-3 py-1 text-xs font-bold active:scale-95">+1000</button>
        </div>
        <div className="absolute left-3 top-3 rounded-full bg-black/60 px-3 py-1 text-[11px] font-bold text-amber-200">DEMO · virtual points only</div>
        <div className="absolute bottom-3 left-2 flex items-center gap-2">
          <button type="button" onClick={toggleExtra} disabled={spinning} aria-pressed={extra} aria-label="Extra Bets" className="flex items-center gap-2 rounded-full border-2 border-amber-400 bg-gradient-to-r from-[#3a1670] to-[#5a22a0] py-1 pl-2 pr-1 text-xs font-bold shadow disabled:opacity-60">
            <span className="rounded-md bg-amber-400 px-1.5 text-sm font-black italic text-[#5a1a00]">EX</span>
            Extra Bets
            <span className={cn("rounded-full px-3 py-1 text-[11px] font-black", extra ? "bg-green-600" : "bg-red-700")}>{extra ? "ON" : "OFF"}</span>
          </button>
        </div>
      </div>

      {/* title bar */}
      <div className="flex items-center gap-3 border-y-2 border-[#7a4a08] bg-gradient-to-b from-[#6b4a26] to-[#4a3018] px-3 py-2">
        <button type="button" onClick={() => setShowInfo((v) => !v)} aria-label="Paytable" className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-amber-300/80 bg-black/30"><Info className="h-4 w-4 text-amber-200" /></button>
        <p className="flex-1 bg-gradient-to-b from-[#fff3b0] to-[#e0a100] bg-clip-text text-center text-2xl font-black italic text-transparent">Fortune Gems</p>
        <p className="rounded-md bg-[#7a1020] px-2 py-1 text-center text-[11px] font-black leading-tight text-amber-200">WIN<br />MULTIPLIER</p>
      </div>

      {/* board */}
      <div className="bg-gradient-to-b from-[#5a3a1c] to-[#3a2410] p-2">
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "1fr 1fr 1fr 0.78fr" }}>
          {[0, 1, 2].map((c) => <Reel key={c} col={c} grid={grid} hit={winCells} blur={spinning && stopped <= c} />)}
          <div className={cn("flex flex-col gap-1 rounded-xl bg-[#5a1220] p-1", spinning && stopped < 4 && "blur-[1.5px]")} style={{ height: ROW_H * 3 + 12 }}>
            {mults.map((m, i) => <MultBadge key={i} m={m} active={i === 1} glow={lastWin > 0 && !spinning && usedMult > 1} />)}
          </div>
        </div>
      </div>

      {/* win bar */}
      <div className="flex h-12 items-center justify-center gap-3 bg-gradient-to-b from-[#5a3d1f] to-[#3e2a14]">
        <span className="text-xl font-black italic text-amber-300">WIN</span>
        <span className={cn("text-2xl font-black tabular-nums", lastWin > 0 ? "text-white" : "text-white/60")}>{lastWin.toLocaleString("en-IN")}</span>
        {lastWin > 0 && usedMult > 1 && <span className="rounded-full bg-amber-400 px-2 py-0.5 text-xs font-black text-[#5a1a00]">×{usedMult}</span>}
      </div>

      {/* controls */}
      <div className="bg-gradient-to-b from-[#6a4826] to-[#3b2611] px-4 pb-3 pt-3">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto_auto_auto] items-center gap-2">
          <button type="button" onClick={() => setShowInfo((v) => !v)} aria-label="Settings" className="flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-200/40 bg-[#8a6a42] shadow"><Settings className="h-5 w-5 text-white/90" /></button>
          <div className="text-center">
            <div className="mx-auto flex w-full max-w-[7.5rem] items-center justify-between rounded-full bg-black/40 px-1 py-1">
              <button type="button" onClick={() => changeBet(-1)} disabled={spinning || betIdx === 0} aria-label="Decrease bet" className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/90 text-black disabled:opacity-40"><Minus className="h-4 w-4" /></button>
              <span className="text-sm font-black tabular-nums">{cost}</span>
              <button type="button" onClick={() => changeBet(1)} disabled={spinning || betIdx === BETS.length - 1} aria-label="Increase bet" className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500/90 text-black disabled:opacity-40"><Plus className="h-4 w-4" /></button>
            </div>
            <p className="mt-1 text-xs text-white/80">Bet {bet}{extra ? ` +50%` : ""}</p>
          </div>
          <button type="button" onClick={() => void spin()} disabled={spinning || !round} aria-label="Spin" className="flex h-[84px] w-[84px] items-center justify-center rounded-full border-[5px] border-[#c9a05a] bg-gradient-to-b from-[#9a7440] to-[#5a3d1c] shadow-[0_0_0_3px_#3b2611,0_6px_14px_rgba(0,0,0,0.6)] active:scale-95 transition-transform disabled:opacity-70">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-b from-[#ffd84d] to-[#e08a00] text-base font-black text-[#4a2a00]">{spinning ? "…" : "SPIN"}</span>
          </button>
          <button type="button" onClick={() => setAuto((a) => (a > 0 ? 0 : 10))} aria-label="Autoplay" className={cn("flex h-11 w-11 flex-col items-center justify-center rounded-full border-2 border-amber-200/40 shadow", auto > 0 ? "bg-red-700" : "bg-[#8a6a42]")}>
            <Repeat className="h-4 w-4" />{auto > 0 && <span className="text-[11px] font-black leading-none">{auto}</span>}
          </button>
          <button type="button" onClick={toggleTurbo} aria-pressed={turbo} aria-label="Turbo" className={cn("flex h-11 w-11 items-center justify-center rounded-full border-2 border-amber-200/40 shadow", turbo ? "bg-amber-500 text-black" : "bg-[#8a6a42]")}><Zap className="h-5 w-5" /></button>
        </div>
        <p className="mt-2 text-center text-sm font-bold text-amber-200">Balance <span className="tabular-nums text-white">{balance.toLocaleString("en-IN")}</span></p>
        {message && <p className="mt-1 text-center text-sm font-bold text-amber-300">{message}</p>}
      </div>

      <div className="space-y-3 bg-[#1a1008] p-3">
        {wins.length > 0 && !spinning && (
          <div className="space-y-1 rounded-xl bg-black/30 p-2 text-xs text-white/80">
            {wins.map((w) => (
              <div key={w.line} className="flex items-center justify-between"><span>Line {w.line + 1}: 3 × {NAMES[w.symbol]}</span><span className="font-bold text-amber-300">+{w.amount}</span></div>
            ))}
            {usedMult > 1 && <div className="flex items-center justify-between border-t border-white/10 pt-1"><span>Win multiplier</span><span className="font-bold text-amber-300">×{usedMult}</span></div>}
          </div>
        )}

        {showInfo && (
          <div className="space-y-2 rounded-2xl bg-black/30 p-3">
            <div className="grid grid-cols-2 gap-2">
              {SYMBOLS.slice().sort((a, b) => PAY[b] - PAY[a]).map((s) => (
                <div key={s} className="flex items-center gap-2 rounded-lg bg-white/5 px-2 py-1">
                  <Gem sym={s} size={32} />
                  <div className="text-xs leading-tight"><p className="font-bold">{NAMES[s]}</p><p className="text-amber-300">3× = {PAY[s]}× line bet</p></div>
                </div>
              ))}
            </div>
            <p className="text-[11px] leading-relaxed text-white/60">
              The bet is split over 5 paylines (top, middle, bottom, 2 diagonals). Wild substitutes for any gem. The middle value of the Win Multiplier reel multiplies the total of any win.
              Extra Bets costs {Math.round((EXTRA_BET_FACTOR - 1) * 100)}% more per spin and removes the 1x multiplier, so every win is at least ×2. Lines: {LINES.map((l) => l.map((c) => c + 1).join("-")).join(" · ")} (cells numbered 1-9, row by row).
            </p>
          </div>
        )}

        {history.length > 0 && (
          <div className="space-y-1 rounded-2xl bg-black/30 p-3 text-xs">
            <p className="font-bold text-white/70">Recent spins</p>
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-white/80">
                <span className="tabular-nums">{h.id.slice(-6)} · cost {h.cost}</span>
                <span className={cn("font-bold tabular-nums", h.win > 0 ? "text-amber-300" : "text-white/40")}>{h.win > 0 ? `+${h.win}${h.mult > 1 ? ` (×${h.mult})` : ""}` : "0"}</span>
              </div>
            ))}
          </div>
        )}

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
          <p>Gems and multiplier come from SHA-256(&quot;seed:round&quot;). Return to player about 95% (Extra Bets on or off).</p>
        </div>
        <p className="text-center text-[11px] text-white/40">Runs only in your browser. Nothing touches your XArena wallet.</p>
      </div>
    </div>
  );
}
