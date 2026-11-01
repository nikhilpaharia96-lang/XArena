"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Info, Minus, Plus, RotateCw, Volume2, VolumeX, Zap } from "lucide-react";
import { formatPaiseExact } from "@/lib/format";
import { cn } from "@/lib/cn";
import { toast } from "@/lib/toast-store";
import { originals, newRequestId, toastError, useRefreshMoney, type CoinChipView, type CoinsResult, type OriginalGame } from "@/hooks/use-originals";
import { COIN_RESPINS, COIN_TRIGGER, UNITS_PER_BET, WAYS_PAY } from "@/server/games/coins-math";
import { SymbolDefs } from "../slot/symbols";
import { SLOT_CSS } from "../slot/slot-styles";
import { useSlotAudio } from "../slot/use-slot-audio";
import { useBurst } from "../slot/use-burst";
import { CoinSymbol, COIN_LABEL } from "./coin-symbols";
import { LotusHero } from "./lotus-hero";
import { COINS_CSS } from "./coins-styles";

const REELS = 5;
const STRIP_CELLS = 12;
const LADDER = [1000, 2000, 5000, 10000, 20000, 50000, 100000];
const DEMO_START = 1_000_000;
const AUTO_STEPS = [0, 10, 25, 50, 100];
const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const rnd = () => Math.floor(Math.random() * 8);
const initialCols = () => Array.from({ length: REELS }, () => [rnd() % 7, rnd() % 7, rnd() % 7]);
const makeStrip = () => {
  const s = Array.from({ length: STRIP_CELLS }, rnd);
  s[9] = s[0]; s[10] = s[1]; s[11] = s[2];
  return s;
};

interface Overlay { kind: "bonus" | "grand" | "big"; title: string; sub?: string; amount?: number }

function fmtCoin(paise: number): string {
  const r = paise / 100;
  if (r >= 1000) return `${(r / 1000).toFixed(r >= 10000 ? 0 : 1)}K`;
  if (r >= 100) return String(Math.round(r));
  return String(parseFloat(r.toFixed(r < 10 ? 2 : 1)));
}

function waysCells(res: CoinsResult, includeCoins: boolean): Set<string> {
  const set = new Set<string>();
  for (const w of res.ways) {
    for (let r = 0; r < w.reels; r++) res.grid[r].forEach((s, row) => (s === w.symbol || s === 6) && set.add(`${r}-${row}`));
  }
  if (includeCoins) res.grid.forEach((col, r) => col.forEach((s, row) => s === 7 && set.add(`${r}-${row}`)));
  return set;
}

export function CoinsGame({ cfg, balance }: { cfg: OriginalGame; balance: number }) {
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
  const [coinCount, setCoinCount] = useState(0);
  const [board, setBoard] = useState<Record<number, CoinChipView> | null>(null);
  const [bonusInfo, setBonusInfo] = useState<{ respins: number; seeking: boolean } | null>(null);
  const [popCell, setPopCell] = useState<number | null>(null);
  const [overlay, setOverlay] = useState<Overlay | null>(null);
  const [shake, setShake] = useState(false);
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

  const burstAt = useCallback((cells: Iterable<string>, power: number) => {
    const el = boardRef.current;
    if (!el) return;
    const w = el.clientWidth, h = el.clientHeight;
    let n = 0;
    for (const key of cells) {
      if (n++ > 6) break;
      const [r, row] = key.split("-").map(Number);
      burst(((r + 0.5) / REELS) * w, ((row + 0.5) / 3) * h, 18 + power * 10, 0.8 + power * 0.3);
    }
  }, [burst]);

  const reveal = useCallback(async (grid: number[][], fast: boolean) => {
    setWinCells(new Set());
    setStrips(Array.from({ length: REELS }, makeStrip));
    setSpinning(Array(REELS).fill(true));
    audio.spin();
    await sleep(fast ? 380 : 650);
    for (let r = 0; r < REELS && alive.current; r++) {
      setCols((prev) => prev.map((c, i) => (i === r ? grid[r] : c)));
      setSpinning((prev) => prev.map((s, i) => (i === r ? false : s)));
      setSettle((prev) => prev.map((s, i) => (i === r ? s + 1 : s)));
      audio.stop();
      await sleep(fast ? 100 : 230);
    }
  }, [audio]);

  const placeChip = useCallback(async (chips: Record<number, CoinChipView>, c: CoinChipView, fast: boolean) => {
    chips[c.cell] = c;
    setBoard({ ...chips });
    setPopCell(c.cell);
    audio.stop();
    burstAt([`${Math.floor(c.cell / 3)}-${c.cell % 3}`], 1);
    await sleep(fast ? 70 : 150);
  }, [audio, burstAt]);

  const doSpin = useCallback(async (): Promise<boolean> => {
    if (busyRef.current) return false;
    if (shown < bet) {
      toast({ title: "Not enough balance", description: mode === "demo" ? "Your demo credits ran out. Reload to restart." : "Add cash to your wallet to keep playing.", tone: "error" });
      return false;
    }
    busyRef.current = true;
    setBusy(true);
    setOverlay(null);
    cancelAnimationFrame(countRaf.current);
    winRef.current = 0;
    setWinShown(0);
    setCoinCount(0);
    if (mode === "demo") setDemoBal((b) => b - bet);
    else setRealOverride((o) => (o ?? balance) - bet);
    setStrips(Array.from({ length: REELS }, makeStrip));
    setSpinning(Array(REELS).fill(true));
    setWinCells(new Set());

    let res: CoinsResult;
    let finalReal: number | null = null;
    try {
      if (mode === "demo") res = await originals.coinsDemo(bet);
      else {
        const round = await originals.coins({ bet, requestId: newRequestId() });
        res = round.result as unknown as CoinsResult;
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
    await reveal(res.grid, turbo);
    setCoinCount(res.coinCount);
    const cells = waysCells(res, !!res.bonus);
    setWinCells(cells);
    if (res.waysWin > 0) {
      running += res.waysWin;
      countTo(running);
      burstAt(cells, 1);
      audio.win(1);
    }
    await sleep(res.waysWin > 0 ? 850 : 250);

    if (res.bonus && alive.current) {
      const b = res.bonus;
      setOverlay({ kind: "bonus", title: "COIN RESPIN", sub: `${b.initial.length} coins locked · ${COIN_RESPINS} respins` });
      audio.bonus();
      rain(70);
      await sleep(2100);
      setOverlay(null);
      const chips: Record<number, CoinChipView> = {};
      setBoard({});
      setBonusInfo({ respins: COIN_RESPINS, seeking: false });
      for (const c of b.initial) {
        running += c.amount;
        await placeChip(chips, c, turbo);
        countTo(Math.min(running, res.payout));
      }
      let left: number = COIN_RESPINS;
      for (const round of b.rounds) {
        if (!alive.current) break;
        setBonusInfo({ respins: left, seeking: true });
        await sleep(turbo ? 350 : 700);
        for (const c of round.newCoins) {
          running += c.amount;
          await placeChip(chips, c, turbo);
        }
        if (round.newCoins.length) { audio.win(2); countTo(Math.min(running, res.payout)); }
        left = round.respinsLeft;
        setBonusInfo({ respins: left, seeking: false });
        await sleep(round.newCoins.length ? 450 : 200);
      }
      if (b.full) {
        running += b.grand;
        setOverlay({ kind: "grand", title: "GRAND BONUS", sub: "Every cell filled!", amount: b.grand });
        setShake(true);
        rain(120);
        audio.win(3);
        await sleep(2400);
        setShake(false);
        setOverlay(null);
      }
      countTo(res.payout, 600);
      await sleep(900);
      setBoard(null);
      setBonusInfo(null);
      setPopCell(null);
    }

    countTo(res.payout, 500);
    const x = res.payout / bet;
    if (x >= 10 && alive.current) {
      setOverlay({ kind: "big", title: x >= 50 ? "EPIC WIN" : x >= 25 ? "MEGA WIN" : "BIG WIN", sub: `${x.toFixed(1)}× your bet`, amount: res.payout });
      setShake(true);
      rain(110);
      audio.win(3);
      await sleep(2600);
      setShake(false);
      setOverlay(null);
      if (x >= 25) { autoRef.current = 0; setAutoLeft(0); }
    }
    if (res.capped) toast({ title: "Max payout reached", description: "This round hit the table's payout limit.", tone: "info" });

    if (mode === "demo") setDemoBal((b) => b + res.payout);
    else if (finalReal !== null) setRealOverride(finalReal);
    refresh();
    busyRef.current = false;
    setBusy(false);
    return true;
  }, [shown, balance, bet, mode, turbo, reveal, countTo, burstAt, placeChip, audio, rain, refresh]);

  useEffect(() => {
    latest.current = doSpin;
  }, [doSpin]);

  const startSpin = async () => {
    const ok = await latest.current();
    while (ok && autoRef.current > 0 && alive.current) {
      autoRef.current -= 1;
      setAutoLeft(autoRef.current);
      await sleep(turbo ? 250 : 500);
      if (!alive.current) break;
      const next = await latest.current();
      if (!next) { autoRef.current = 0; setAutoLeft(0); break; }
    }
  };

  const cycleAuto = () => {
    const i = AUTO_STEPS.indexOf(autoLeft > 0 ? AUTO_STEPS.find((s) => s >= autoLeft) ?? 100 : 0);
    const next = AUTO_STEPS[(i + 1) % AUTO_STEPS.length];
    autoRef.current = next;
    setAutoLeft(next);
    if (next > 0 && !busyRef.current) void startSpin();
  };
  const stopAuto = () => { autoRef.current = 0; setAutoLeft(0); };
  const switchMode = (m: "demo" | "real") => {
    if (busy || m === mode) return;
    if (m === "real" && !window.confirm("Real wallet mode bets your actual XArena balance. Continue?")) return;
    stopAuto();
    setMode(m);
  };

  const lockedCount = board ? Object.keys(board).length : coinCount;

  return (
    <div className={cn("ga-root lc", shake && "ga-shake", bonusInfo && "ga-fs")}>
      <style>{SLOT_CSS + COINS_CSS}</style>
      <SymbolDefs />
      <div className="relative">
        <LotusHero fever={!!bonusInfo} />
        <div className="ga-brand">
          LAKSHMI COINS
          <small>GOLDEN LOTUS · RESPIN</small>
        </div>
      </div>

      <div className="ga-frame">
        {bonusInfo && <div className="ga-fsbadge">COIN RESPIN · {lockedCount}/15 LOCKED</div>}
        <div className="ga-titlebar">
          <span>LAKSHMI COINS</span>
          <span className="flex gap-1.5">
            <button type="button" className={cn("ga-chip", mode === "demo" && "on")} onClick={() => switchMode("demo")} disabled={busy}>DEMO</button>
            <button type="button" className={cn("ga-chip", mode === "real" && "on")} onClick={() => switchMode("real")} disabled={busy}>WALLET</button>
          </span>
        </div>
        {bonusInfo && (
          <div className="lc-respins">
            RESPINS {Array.from({ length: COIN_RESPINS }, (_, i) => <i key={i} className={i < bonusInfo.respins ? "on" : ""} />)}
          </div>
        )}

        <div className="ga-boardwrap">
          <div className="ga-board ga-shine" ref={boardRef}>
            {Array.from({ length: REELS }, (_, r) => (
              <div className="ga-reel" key={r}>
                {board ? (
                  <div>
                    {[0, 1, 2].map((row) => {
                      const chip = board[r * 3 + row];
                      return (
                        <div className="lc-cell" key={row}>
                          {chip ? (
                            <div className={cn("lc-chip", popCell === chip.cell && "pop", chip.label && "jp")} data-label={chip.label ?? undefined}>
                              <CoinSymbol id={7} />
                              <b>{fmtCoin(chip.amount)}</b>
                            </div>
                          ) : (
                            <div className={cn("lc-empty", bonusInfo?.seeking && "seek")} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : spinning[r] ? (
                  <div className="ga-strip">
                    {strips[r].map((s, i) => (
                      <div className="ga-cell" key={i}><CoinSymbol id={s} /></div>
                    ))}
                  </div>
                ) : (
                  <div key={settle[r]} className={settle[r] > 0 ? "ga-settle" : ""}>
                    {cols[r].map((s, row) => (
                      <div className={cn("ga-cell", winCells.has(`${r}-${row}`) && "win")} key={row}>
                        <CoinSymbol id={s} />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <canvas ref={canvasRef} className="ga-canvas" />
          </div>
          <div className="ga-side">
            <div className="ga-sidelabel">COINS</div>
            <div className="ga-ladder">
              {Array.from({ length: COIN_TRIGGER }, (_, i) => COIN_TRIGGER - i).map((m) => (
                <div key={m} className={cn("ga-rung", lockedCount >= m && "on")}>{m === COIN_TRIGGER ? `${m}+` : m}</div>
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
            <button type="button" className={cn("ga-spinbtn", busy && "spinning")} disabled={busy} onClick={() => !busy && void startSpin()} aria-label="Spin">
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
          <p><b>How it works.</b> 243 ways: matching symbols on adjacent reels from reel 1, wins multiply by the number of matching cells on each reel. Lotus Wild replaces every symbol except Cash Coin (reels 2-4 only). Land {COIN_TRIGGER}+ Cash Coins to lock them and start {COIN_RESPINS} respins; every new coin resets respins. Fill all 15 cells for the Grand Bonus. MINI and MINOR coins carry bigger cash prizes.</p>
          <table>
            <thead><tr><th /><th>Symbol</th><th>3</th><th>4</th><th>5</th></tr></thead>
            <tbody>
              {[5, 4, 3, 2, 1, 0].map((id) => (
                <tr key={id}>
                  <td><CoinSymbol id={id} /></td>
                  <td style={{ textAlign: "left" }}>{COIN_LABEL[id]}</td>
                  {WAYS_PAY[id].map((u, i) => <td key={i}>{(u / UNITS_PER_BET).toFixed(2)}×</td>)}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="opacity-70">Prizes are per matching way, as a multiple of your total bet. Return to player ≈ {rtp}%. Results are decided by the server and provably fair (see Fairness below). Max payout per round {formatPaiseExact(cfg.maxPayout)}. Demo credits are virtual; wallet mode uses real balance. 18+ only, play responsibly.</p>
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
