"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { formatPaiseExact } from "@/lib/format";
import type { OriginalGame, Round } from "@/hooks/use-originals";

export const DEMO_START = 1_000_000; // 10,000.00 virtual credits

/**
 * Demo / real switch for a game. What is offered is the admin's decision (cfg.playMode):
 * DEMO = virtual credits only, REAL = wallet only, BOTH = player chooses (starts in demo).
 */
export function useDemoWallet(cfg: OriginalGame, realBalance: number) {
  const [mode, setMode] = useState<"demo" | "real">(cfg.playMode === "REAL" ? "real" : "demo");
  const [demoBal, setDemoBal] = useState(DEMO_START);
  const demo = mode === "demo";
  return {
    mode,
    demo,
    demoBal,
    setDemoBal,
    shown: demo ? demoBal : realBalance,
    canSwitch: cfg.playMode === "BOTH",
    pick(m: "demo" | "real") {
      if (m === mode) return;
      if (m === "real" && !window.confirm("Wallet mode bets your actual XArena balance. Continue?")) return;
      setMode(m);
    },
  };
}

export function ModeBar({ w, disabled }: { w: ReturnType<typeof useDemoWallet>; disabled?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-surface-2 border border-white/10 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-wide text-white/40">{w.demo ? "Demo credits · no cash value" : "Wallet balance"}</p>
        <p className={cn("font-black tabular-nums", w.demo ? "text-violet" : "text-white")}>{formatPaiseExact(w.shown)}</p>
      </div>
      {w.canSwitch ? (
        <div className="flex gap-1.5 shrink-0">
          {(["demo", "real"] as const).map((m) => (
            <button
              key={m}
              type="button"
              disabled={disabled}
              onClick={() => w.pick(m)}
              className={cn("h-8 px-3 rounded-lg text-[11px] font-bold border disabled:opacity-40", w.mode === m ? "gradient-brand text-white border-transparent" : "bg-surface text-white/60 border-white/10")}
            >
              {m === "demo" ? "DEMO" : "WALLET"}
            </button>
          ))}
        </div>
      ) : (
        <span className="shrink-0 rounded-full border border-white/10 bg-surface px-2.5 py-1 text-[11px] font-bold tracking-wide text-white/70">{w.demo ? "DEMO ONLY" : "REAL MONEY"}</span>
      )}
    </div>
  );
}

export function Outcome({ won, bet, payout, text }: { won: boolean; bet: number; payout: number; text?: string }) {
  return (
    <div className={cn("rounded-xl border px-3 py-2.5 text-center text-sm font-bold", won ? "bg-signal/15 border-signal/40 text-signal" : "bg-surface-2 border-white/10 text-white/70")}>
      {won ? `${text ?? "You won"} ${formatPaiseExact(payout)}` : `${text ?? "No win"} · −${formatPaiseExact(bet)}`}
    </div>
  );
}

export function roundOutcome<T>(r: Round) {
  return { payout: r.payout, result: r.result as unknown as T };
}
