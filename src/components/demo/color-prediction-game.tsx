"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Clock, FileText, Plus, RotateCcw, ShieldCheck, Volume2 } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  LOCK_SECONDS,
  START_POINTS,
  betLabel,
  colorsOf,
  payout,
  randomSeed,
  resultFromSeed,
  sha256Hex,
  sizeOf,
  type Bet,
  type Color,
} from "@/lib/demo-color-game";

/* ---------- types & constants ---------- */
const MODES = [
  { label: "30sec", seconds: 30 },
  { label: "1Min", seconds: 60 },
  { label: "3Min", seconds: 180 },
  { label: "5Min", seconds: 300 },
] as const;
const BASES = [1, 10, 100, 1000];
const MULTS = [1, 5, 10, 20, 50, 100];
const STORAGE_KEY = "xarena-demo-points";
const PAGE_SIZE = 10;

interface Round { id: string; seed: string; commit: string; endsAt: number }
interface PlacedBet { uid: number; bet: Bet; stake: number }
interface HistoryItem { id: string; n: number; sample?: boolean }
interface MyItem { id: string; label: string; stake: number; returned: number; n: number }
interface Revealed { id: string; seed: string; commit: string; n: number }
type Tab = "game" | "chart" | "mine";

/* ---------- helpers ---------- */
function makeId(modeIdx: number, n: number, d = new Date()) {
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
  return `${ymd}${1000 + modeIdx}${String(n).padStart(5, "0")}`;
}
function periodNumber(seconds: number, d = new Date()) {
  const s = d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
  return Math.floor(s / seconds) + 1;
}
function sampleHistory(modeIdx: number, seconds: number): HistoryItem[] {
  const cur = periodNumber(seconds);
  const out: HistoryItem[] = [];
  for (let k = 1; k <= 20 && cur - k >= 1; k++) {
    out.push({ id: makeId(modeIdx, cur - k), n: Math.floor(Math.random() * 10), sample: true });
  }
  return out;
}

const BALL_GRADIENT: Record<Color, string> = {
  green: "linear-gradient(145deg,#5ee0a0,#17a05a)",
  red: "linear-gradient(145deg,#ff7b7b,#d12a3a)",
  violet: "linear-gradient(145deg,#c08cff,#7b3fe4)",
};
function ballBackground(n: number) {
  if (n === 0) return "linear-gradient(135deg,#ff6b6b 0%,#d12a3a 55%,#a855f7 55%,#7b3fe4 100%)";
  if (n === 5) return "linear-gradient(135deg,#5ee0a0 0%,#17a05a 55%,#a855f7 55%,#7b3fe4 100%)";
  return BALL_GRADIENT[colorsOf(n)[0]];
}
function numberTextStyle(n: number): React.CSSProperties {
  if (n === 0) return { backgroundImage: "linear-gradient(180deg,#ef4444 50%,#a855f7 50%)", WebkitBackgroundClip: "text", color: "transparent" };
  if (n === 5) return { backgroundImage: "linear-gradient(180deg,#22c55e 50%,#a855f7 50%)", WebkitBackgroundClip: "text", color: "transparent" };
  return { color: colorsOf(n)[0] === "green" ? "#22c55e" : "#ef4444" };
}

function Ball({ n, size = 56, onClick, label }: { n: number; size?: number; onClick?: () => void; label?: string }) {
  const inner = (
    <span
      className="relative flex items-center justify-center rounded-full shadow-[inset_0_-4px_8px_rgba(0,0,0,0.25),0_2px_6px_rgba(0,0,0,0.4)]"
      style={{ width: size, height: size, background: ballBackground(n) }}
    >
      <span
        className="flex items-center justify-center rounded-full"
        style={{ width: size * 0.72, height: size * 0.72, background: "radial-gradient(circle at 35% 30%,#ffffff,#e9ecf5)" }}
      >
        <span className="font-black leading-none" style={{ fontSize: size * 0.5, ...numberTextStyle(n) }}>{n}</span>
      </span>
    </span>
  );
  if (!onClick) return inner;
  return (
    <button type="button" onClick={onClick} aria-label={label ?? `Bet on ${n}`} className="active:scale-90 transition-transform">
      {inner}
    </button>
  );
}

function Dots({ n }: { n: number }) {
  const map: Record<Color, string> = { green: "#22c55e", red: "#ef4444", violet: "#d946ef" };
  return (
    <span className="inline-flex gap-1.5">
      {colorsOf(n).map((c) => (
        <span key={c} className="h-3.5 w-3.5 rounded-full" style={{ background: map[c] }} />
      ))}
    </span>
  );
}

const SHEET_THEME = (b: Bet): { bg: string; text: string; solid: string } => {
  if (b.kind === "size") return b.size === "big" ? { bg: "bg-[#dd9338]", text: "Big", solid: "#dd9338" } : { bg: "bg-[#5088d3]", text: "Small", solid: "#5088d3" };
  if (b.kind === "color") {
    return b.color === "green" ? { bg: "bg-[#17b15e]", text: "Green", solid: "#17b15e" } : b.color === "red" ? { bg: "bg-[#d23838]", text: "Red", solid: "#d23838" } : { bg: "bg-[#9b48db]", text: "Violet", solid: "#9b48db" };
  }
  const c = colorsOf(b.n)[0];
  return c === "green" ? { bg: "bg-[#17b15e]", text: String(b.n), solid: "#17b15e" } : { bg: "bg-[#d23838]", text: String(b.n), solid: "#d23838" };
};

/* ---------- component ---------- */
export function ColorPredictionGame() {
  const [modeIdx, setModeIdx] = useState(0);
  const [balance, setBalance] = useState(START_POINTS);
  const [round, setRound] = useState<Round | null>(null);
  const [now, setNow] = useState(0);
  const [bets, setBets] = useState<PlacedBet[]>([]);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mine, setMine] = useState<MyItem[]>([]);
  const [revealed, setRevealed] = useState<Revealed | null>(null);
  const [verifyMsg, setVerifyMsg] = useState<string | null>(null);

  const [sheet, setSheet] = useState<Bet | null>(null);
  const [base, setBase] = useState(1);
  const [qty, setQty] = useState(1);
  const [mult, setMult] = useState(1);
  const [agree, setAgree] = useState(true);

  const [tab, setTab] = useState<Tab>("game");
  const [page, setPage] = useState(1);
  const [showRules, setShowRules] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const roundRef = useRef<Round | null>(null);
  const betsRef = useRef<PlacedBet[]>([]);
  const modeRef = useRef(0);
  const uidRef = useRef(1);
  const settlingRef = useRef(false);

  /* demo points persist in this browser only */
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

  const startRound = useCallback(async (idx: number) => {
    const seconds = MODES[idx].seconds;
    const seed = randomSeed();
    const commit = await sha256Hex(seed);
    const t = Date.now();
    const r: Round = {
      id: makeId(idx, periodNumber(seconds, new Date(t))),
      seed,
      commit,
      endsAt: (Math.floor(t / (seconds * 1000)) + 1) * seconds * 1000,
    };
    roundRef.current = r;
    setRound(r);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      setNow(Date.now());
      setHistory(sampleHistory(0, MODES[0].seconds));
      void startRound(0);
    }, 0);
    return () => clearTimeout(t);
  }, [startRound]);

  const settle = useCallback(async () => {
    const r = roundRef.current;
    if (!r || settlingRef.current) return;
    settlingRef.current = true;
    try {
      const n = await resultFromSeed(r.seed, r.id);
      const placed = betsRef.current;
      let returned = 0;
      const rows: MyItem[] = placed.map((b) => {
        const ret = payout(b.bet, b.stake, n);
        returned += ret;
        return { id: r.id, label: betLabel(b.bet), stake: b.stake, returned: ret, n };
      });
      const staked = placed.reduce((s, b) => s + b.stake, 0);
      if (returned > 0) setBalance((b) => b + returned);
      setHistory((h) => [{ id: r.id, n }, ...h].slice(0, 100));
      setRevealed({ id: r.id, seed: r.seed, commit: r.commit, n });
      setVerifyMsg(null);
      if (rows.length) {
        setMine((m) => [...rows.reverse(), ...m].slice(0, 50));
        const net = returned - staked;
        setMessage(net >= 0 ? `Result ${n} · you won ${net} pts` : `Result ${n} · you lost ${-net} pts`);
      } else setMessage(`Result ${n}`);
      betsRef.current = [];
      setBets([]);
      await startRound(modeRef.current);
    } finally {
      settlingRef.current = false;
    }
  }, [startRound]);

  useEffect(() => {
    const t = setInterval(() => {
      const t0 = Date.now();
      setNow(t0);
      if (roundRef.current && t0 >= roundRef.current.endsAt) void settle();
    }, 250);
    return () => clearInterval(t);
  }, [settle]);

  const seconds = MODES[modeIdx].seconds;
  const secondsLeft = round && now ? Math.max(0, Math.ceil((round.endsAt - now) / 1000)) : seconds;
  const locked = !round || secondsLeft <= LOCK_SECONDS;
  const countdown = locked && round && secondsLeft > 0;

  /* ---- actions ---- */
  const switchMode = (i: number) => {
    if (i === modeIdx || settlingRef.current) return;
    const refund = betsRef.current.reduce((s, b) => s + b.stake, 0);
    if (refund) setBalance((b) => b + refund);
    betsRef.current = [];
    setBets([]);
    modeRef.current = i;
    setModeIdx(i);
    setSheet(null);
    setPage(1);
    setHistory(sampleHistory(i, MODES[i].seconds));
    setMine([]);
    setMessage(refund ? "Switched room, open bets were refunded." : null);
    void startRound(i);
  };

  const openSheet = (b: Bet) => {
    if (locked) return;
    setBase(1);
    setQty(1);
    setAgree(true);
    setSheet(b);
  };
  const total = base * qty * mult;
  const confirm = () => {
    if (!sheet || locked || !agree) return;
    if (total > balance) { setMessage("Not enough demo points. Tap Reset or +1000."); setSheet(null); return; }
    setBalance((b) => b - total);
    const next = [...betsRef.current, { uid: uidRef.current++, bet: sheet, stake: total }];
    betsRef.current = next;
    setBets(next);
    setSheet(null);
    setMessage(`Bet placed: ${betLabel(sheet)} · ${total} pts`);
  };
  const random = () => openSheet({ kind: "number", n: Math.floor(Math.random() * 10) });

  const verify = async () => {
    if (!revealed) return;
    const okHash = (await sha256Hex(revealed.seed)) === revealed.commit;
    const okRes = (await resultFromSeed(revealed.seed, revealed.id)) === revealed.n;
    setVerifyMsg(okHash && okRes ? "Verified: hash and result match." : "Mismatch!");
  };

  /* ---- derived ---- */
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const digits = [mm[0], mm[1], ":", ss[0], ss[1]];
  const last5 = history.slice(0, 5);
  const totalPages = Math.max(1, Math.ceil(history.length / PAGE_SIZE));
  const pageRows = history.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const stats = Array.from({ length: 10 }, (_, d) => {
    const freq = history.filter((h) => h.n === d).length;
    const idx = history.findIndex((h) => h.n === d);
    const missing = idx === -1 ? history.length : idx;
    let maxC = 0, cur = 0;
    for (const h of [...history].reverse()) { cur = h.n === d ? cur + 1 : 0; maxC = Math.max(maxC, cur); }
    return { d, freq, missing, avg: Math.floor(history.length / (freq + 1)), maxC };
  });

  return (
    <div className="force-dark mx-auto max-w-md rounded-3xl bg-[#050a26] p-3 pb-6 space-y-4 text-white">
      {/* wallet */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-[#0d2a6b] to-[#0a1448] p-5 text-center">
        <div className="pointer-events-none absolute -left-10 top-6 h-40 w-40 rounded-full bg-white/5" />
        <div className="pointer-events-none absolute -right-8 -top-10 h-44 w-44 rounded-full bg-white/5" />
        <p className="relative text-4xl font-black tabular-nums">{balance.toLocaleString("en-IN")}.00</p>
        <p className="relative mt-1 text-sm text-white/80">Demo points (virtual)</p>
        <div className="relative mt-4 grid grid-cols-2 gap-3">
          <button type="button" onClick={() => { setBalance(START_POINTS); setMessage(`Reset to ${START_POINTS} pts`); }} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#d23838] font-bold active:scale-95 transition-transform">
            <RotateCcw className="h-4 w-4" /> Reset
          </button>
          <button type="button" onClick={() => { setBalance((b) => b + 1000); setMessage("+1000 free demo points"); }} className="flex h-12 items-center justify-center gap-2 rounded-full bg-[#17b15e] font-bold active:scale-95 transition-transform">
            <Plus className="h-4 w-4" /> Free 1000
          </button>
        </div>
      </div>

      {/* notice */}
      <div className="flex items-center gap-3 rounded-full border border-cyan-400/40 bg-[#07123a] py-2 pl-4 pr-2 text-xs">
        <Volume2 className="h-4 w-4 shrink-0 text-cyan-300" />
        <p className="flex-1 leading-snug text-white/90">DEMO MODE: virtual points only. No deposit, no withdraw, no real money.</p>
        <button type="button" onClick={() => setShowRules((v) => !v)} className="rounded-full bg-gradient-to-r from-emerald-300 to-cyan-400 px-4 py-1.5 font-bold text-[#06204a]">
          Detail
        </button>
      </div>

      {/* mode tabs */}
      <div className="grid grid-cols-4 gap-1 rounded-2xl bg-[#07123a] p-1">
        {MODES.map((m, i) => (
          <button key={m.label} type="button" onClick={() => switchMode(i)} className={cn("flex flex-col items-center gap-1 rounded-2xl py-3 text-sm", i === modeIdx ? "bg-gradient-to-b from-emerald-300 to-teal-500 font-semibold text-[#06204a]" : "text-sky-200/70")}>
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-full", i === modeIdx ? "bg-green-500/80 text-white" : "bg-slate-400/70 text-white")}>
              <Clock className="h-6 w-6" />
            </span>
            <span className="leading-tight">WinGo<br />{m.label}</span>
          </button>
        ))}
      </div>

      {/* ticket */}
      <div className="relative rounded-2xl bg-gradient-to-br from-emerald-300 to-teal-500 p-4 text-[#06204a]">
        <span className="absolute -top-2 left-[56%] h-4 w-4 rounded-full bg-[#050a26]" />
        <span className="absolute -bottom-2 left-[56%] h-4 w-4 rounded-full bg-[#050a26]" />
        <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3">
          <div className="min-w-0 space-y-3 border-r border-dashed border-[#06204a]/40 pr-3">
            <button type="button" onClick={() => setShowRules((v) => !v)} className="flex w-full items-center justify-center gap-2 rounded-full border border-[#06204a]/60 py-2 text-sm">
              <FileText className="h-4 w-4" /> How to play
            </button>
            <p className="text-sm">WinGo {MODES[modeIdx].label}</p>
            <div className="flex gap-1.5">
              {last5.map((h) => <Ball key={h.id} n={h.n} size={28} />)}
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-semibold">Time remaining</p>
            <div className="mt-2 flex justify-end gap-1">
              {digits.map((d, i) =>
                d === ":" ? (
                  <span key={i} className="flex h-11 w-3 items-center justify-center rounded bg-[#0a1a52] text-lg font-black text-white">:</span>
                ) : (
                  <span key={i} className="flex h-11 w-7 items-center justify-center rounded bg-[#0a1a52] text-xl font-black text-white tabular-nums">{d}</span>
                )
              )}
            </div>
            <p className="mt-3 text-xs font-black tabular-nums">{round?.id ?? "..."}</p>
          </div>
        </div>
      </div>

      {showRules && (
        <div className="rounded-2xl border border-white/10 bg-[#07123a] p-4 text-xs leading-relaxed text-white/80">
          <p className="mb-1 font-bold text-white">How to play (demo)</p>
          <p>Pick Green, Violet, Red, a number (0-9) or Big/Small before the last 5 seconds. Green: 1,3,7,9 (5 is green + violet). Red: 2,4,6,8 (0 is red + violet). Big: 5-9, Small: 0-4.</p>
          <p className="mt-1">Payout: Green/Red 2x (1.5x on 0 and 5), Violet 4.5x, Big/Small 2x, Number 9x. All amounts are virtual demo points.</p>
        </div>
      )}

      {/* betting area */}
      <div className="rounded-2xl bg-[#07123a] p-3 space-y-3">
        <div className="grid grid-cols-3 gap-3">
          {(["green", "violet", "red"] as Color[]).map((c) => (
            <button key={c} type="button" onClick={() => openSheet({ kind: "color", color: c })} className={cn("h-12 rounded-xl text-base font-bold capitalize active:scale-95 transition-transform", c === "green" ? "bg-[#17b15e]" : c === "violet" ? "bg-[#9b48db]" : "bg-[#d23838]")}>
              {c}
            </button>
          ))}
        </div>

        <div className="relative rounded-2xl bg-[#04061c] p-4">
          <div className="grid grid-cols-5 justify-items-center gap-x-2 gap-y-4">
            {Array.from({ length: 10 }, (_, n) => (
              <Ball key={n} n={n} size={56} onClick={() => openSheet({ kind: "number", n })} />
            ))}
          </div>
          {countdown && (
            <div className="absolute inset-0 flex items-center justify-center gap-4 rounded-2xl bg-black/60">
              {String(secondsLeft).padStart(2, "0").split("").map((d, i) => (
                <span key={i} className="flex h-28 w-20 items-center justify-center rounded-2xl bg-[#0a1a52] text-7xl font-black text-[#00e5b8] tabular-nums">{d}</span>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          <button type="button" onClick={random} className="h-11 rounded-xl border border-red-500 px-5 text-base text-red-400 active:scale-95 transition-transform">Random</button>
          {MULTS.map((m) => (
            <button key={m} type="button" onClick={() => setMult(m)} className={cn("h-11 flex-1 rounded-xl text-sm", m === mult ? "bg-[#17b15e] font-bold" : "bg-[#04061c] text-white/80")}>
              X{m}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 overflow-hidden rounded-full">
          <button type="button" onClick={() => openSheet({ kind: "size", size: "big" })} className="h-12 bg-[#dd9338] text-lg font-semibold active:brightness-90">Big</button>
          <button type="button" onClick={() => openSheet({ kind: "size", size: "small" })} className="h-12 bg-[#5088d3] text-lg font-semibold active:brightness-90">Small</button>
        </div>
      </div>

      {message && <p className="text-center text-sm font-bold text-emerald-300">{message}</p>}

      {/* history tabs */}
      <div className="grid grid-cols-3 gap-3">
        {([["game", "Game history"], ["chart", "Chart"], ["mine", "My history"]] as [Tab, string][]).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)} className={cn("h-12 rounded-xl text-base", tab === k ? "bg-gradient-to-r from-emerald-300 to-teal-400 font-bold text-[#06204a]" : "bg-[#07123a] text-sky-200/60")}>
            {l}
          </button>
        ))}
      </div>

      {tab === "game" && (
        <div className="overflow-hidden rounded-2xl bg-[#04103a]">
          <div className="grid grid-cols-[1.7fr_1fr_1fr_0.8fr] bg-[#2d5fd0] px-3 py-3 text-center text-sm font-bold">
            <span>Period</span><span>Number</span><span>Big Small</span><span>Color</span>
          </div>
          {pageRows.map((h) => (
            <div key={h.id} className="grid grid-cols-[1.7fr_1fr_1fr_0.8fr] items-center px-3 py-3 text-center text-sm">
              <span className="text-xs tabular-nums text-white/85">{h.id}</span>
              <span className="text-3xl font-black leading-none" style={numberTextStyle(h.n)}>{h.n}</span>
              <span className="capitalize">{sizeOf(h.n)}</span>
              <span className="flex justify-center"><Dots n={h.n} /></span>
            </div>
          ))}
          <div className="flex items-center justify-center gap-8 bg-[#07123a] py-3">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} aria-label="Previous page" className="flex h-10 w-12 items-center justify-center rounded-lg bg-[#0d2a6b] disabled:opacity-40"><ChevronLeft /></button>
            <span className="text-sm text-white/60">{page}/{totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} aria-label="Next page" className="flex h-10 w-12 items-center justify-center rounded-lg bg-[#00e5b8] text-[#06204a] disabled:opacity-40"><ChevronRight /></button>
          </div>
        </div>
      )}

      {tab === "chart" && (
        <div className="overflow-hidden rounded-2xl bg-[#04103a]">
          <div className="grid grid-cols-[1fr_3fr] bg-[#2d5fd0] px-3 py-3 text-center text-sm font-bold"><span>Period</span><span>Number</span></div>
          <div className="space-y-2 p-3 text-xs">
            <p className="text-base font-bold">Statistic <span className="text-xs font-normal text-white/60">(last {history.length} periods)</span></p>
            {([["Missing", "missing"], ["Avg missing", "avg"], ["Frequency", "freq"], ["Max consecutive", "maxC"]] as const).map(([label, key]) => (
              <div key={key} className="grid grid-cols-[88px_1fr] items-center">
                <span className="text-sm">{label}</span>
                <div className="grid grid-cols-10 text-center tabular-nums text-white/85">
                  {stats.map((s) => <span key={s.d}>{s[key]}</span>)}
                </div>
              </div>
            ))}
            <div className="grid grid-cols-[88px_1fr] items-center pt-1">
              <span className="text-sm">Numbers</span>
              <div className="grid grid-cols-10 text-center">
                {stats.map((s) => <span key={s.d} className="mx-auto flex h-5 w-5 items-center justify-center rounded-full border border-red-400 text-[11px] text-red-300">{s.d}</span>)}
              </div>
            </div>
          </div>
          {history.slice(0, 8).map((h) => (
            <div key={h.id} className="grid grid-cols-[88px_1fr_24px] items-center gap-1 border-t border-white/5 px-3 py-2 text-[11px]">
              <span className="tabular-nums text-white/70">{h.id.slice(-9)}</span>
              <div className="grid grid-cols-10 text-center">
                {Array.from({ length: 10 }, (_, d) => (
                  <span key={d} className={cn("mx-auto flex h-5 w-5 items-center justify-center rounded-full border text-[11px]", d === h.n ? "border-transparent font-bold text-white" : "border-white/25 text-white/50")} style={d === h.n ? { background: ballBackground(h.n) } : undefined}>{d}</span>
                ))}
              </div>
              <span className={cn("flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-[#06204a]", sizeOf(h.n) === "big" ? "bg-amber-400" : "bg-sky-400")}>{sizeOf(h.n) === "big" ? "B" : "S"}</span>
            </div>
          ))}
        </div>
      )}

      {tab === "mine" && (
        <div className="space-y-2 rounded-2xl bg-[#04103a] p-3">
          {bets.map((b) => (
            <div key={b.uid} className="flex items-center justify-between rounded-xl bg-[#07123a] px-3 py-2 text-sm">
              <span>{round?.id.slice(-9)} · {betLabel(b.bet)}</span>
              <span className="text-amber-300">{b.stake} pts · waiting</span>
            </div>
          ))}
          {mine.length === 0 && bets.length === 0 && <p className="py-6 text-center text-sm text-white/50">No bets yet. Place a bet to see it here.</p>}
          {mine.map((m, i) => {
            const net = m.returned - m.stake;
            return (
              <div key={i} className="flex items-center justify-between rounded-xl bg-[#07123a] px-3 py-2 text-sm">
                <span>{m.id.slice(-9)} · {m.label} <span className="text-white/50">(result {m.n})</span></span>
                <span className={cn("font-bold tabular-nums", net >= 0 ? "text-emerald-300" : "text-red-400")}>{net >= 0 ? `+${net}` : net}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* fairness */}
      <div className="space-y-2 rounded-2xl bg-[#07123a] p-3 text-[11px] text-white/60">
        <p className="flex items-center gap-1 font-bold text-white/80"><ShieldCheck className="h-4 w-4 text-emerald-300" /> Provably fair (demo)</p>
        <p className="break-all">Current round hash (committed before betting): {round?.commit ?? "..."}</p>
        {revealed && (
          <>
            <p className="break-all">Last round {revealed.id}: seed {revealed.seed}</p>
            <button type="button" onClick={verify} className="rounded-lg bg-[#0d2a6b] px-3 py-1.5 text-white">Verify last round</button>
            {verifyMsg && <span className="ml-2 text-emerald-300">{verifyMsg}</span>}
          </>
        )}
      </div>
      <p className="text-center text-[11px] text-white/40">Runs only in your browser. Nothing touches your XArena wallet.</p>

      {/* bet sheet */}
      {sheet && (
        <div className="fixed inset-0 z-[70] flex items-end justify-center bg-black/60" onClick={() => setSheet(null)}>
          <div className="w-full max-w-md overflow-hidden rounded-t-3xl bg-[#07123a]" onClick={(e) => e.stopPropagation()}>
            {(() => {
              const th = SHEET_THEME(sheet);
              return (
                <>
                  <div className={cn("px-6 pb-10 pt-5 text-center text-sm [clip-path:polygon(0_0,100%_0,100%_70%,50%_100%,0_70%)]", th.bg)}>
                    <p>WinGo {MODES[modeIdx].label}</p>
                    <div className="mt-2 rounded-lg bg-white py-2 text-base text-black">Select {th.text}</div>
                  </div>
                  <div className="space-y-4 px-5 pb-4 pt-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xl">Balance</span>
                      <div className="flex gap-2">
                        {BASES.map((b) => (
                          <button key={b} type="button" onClick={() => setBase(b)} className={cn("h-10 min-w-12 rounded px-3 text-base", b === base ? "text-white" : "bg-[#0d1d52] text-sky-200")} style={b === base ? { background: th.solid } : undefined}>{b}</button>
                        ))}
                      </div>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-xl">Quantity</span>
                      <div className="flex items-center gap-3">
                        <button type="button" onClick={() => setQty((q) => Math.max(1, q - 1))} className="h-10 w-12 rounded-lg text-xl text-white" style={{ background: th.solid }}>-</button>
                        <input aria-label="Quantity" inputMode="numeric" value={qty} onChange={(e) => setQty(Math.min(999, Math.max(1, Number(e.target.value.replace(/\D/g, "")) || 1)))} className="h-10 w-32 rounded bg-[#04061c] text-center text-lg" />
                        <button type="button" onClick={() => setQty((q) => Math.min(999, q + 1))} className="h-10 w-12 rounded-lg text-xl text-white" style={{ background: th.solid }}>+</button>
                      </div>
                    </div>
                    <div className="flex justify-end gap-2">
                      {MULTS.map((m) => (
                        <button key={m} type="button" onClick={() => setMult(m)} className={cn("h-10 rounded px-3 text-sm", m === mult ? "text-white" : "bg-[#0d1d52] text-sky-200")} style={m === mult ? { background: th.solid } : undefined}>X{m}</button>
                      ))}
                    </div>
                    <label className="flex items-center gap-3 text-sm">
                      <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} className="h-6 w-6 accent-emerald-400" />
                      I agree <span className="text-red-400">《Demo rules》</span>
                    </label>
                  </div>
                  <div className="grid grid-cols-[1fr_2fr]">
                    <button type="button" onClick={() => setSheet(null)} className="h-14 bg-[#0d1d52] text-lg text-sky-200">Cancel</button>
                    <button type="button" onClick={confirm} disabled={!agree || locked || total > balance} className="h-14 text-lg text-white disabled:opacity-50" style={{ background: th.solid }}>
                      Total amount {total} pts
                    </button>
                  </div>
                </>
              );
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
