"use client";

import { Input } from "@/components/ui/input";
import { formatPaiseExact } from "@/lib/format";
import { cn } from "@/lib/cn";

/** Rupee input -> integer paise. Returns NaN-free paise (0 when empty/invalid). */
export function rupeesToPaise(text: string): number {
  const n = Number(text);
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function BetInput({
  value,
  onChange,
  min,
  max,
  balance,
  disabled,
}: {
  value: string;
  onChange: (v: string) => void;
  min: number;
  max: number;
  balance?: number;
  disabled?: boolean;
}) {
  const paise = rupeesToPaise(value);
  const bad = paise > 0 && (paise < min || paise > max);
  const set = (p: number) => onChange(String(Math.max(0, p) / 100));
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-white/60">Bet amount (₹)</label>
        <span className="text-[11px] text-white/40">
          Min {formatPaiseExact(min)} · Max {formatPaiseExact(max)}
        </span>
      </div>
      <Input
        inputMode="decimal"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value.replace(/[^0-9.]/g, ""))}
        error={bad ? `Bet must be between ${formatPaiseExact(min)} and ${formatPaiseExact(max)}` : undefined}
      />
      <div className="flex gap-2 mt-2">
        {[
          ["½", () => set(Math.floor(paise / 2))],
          ["2×", () => set(Math.min(max, paise * 2))],
          ["Min", () => set(min)],
          ["Max", () => set(Math.min(max, balance ?? max))],
        ].map(([label, fn]) => (
          <button
            key={label as string}
            type="button"
            disabled={disabled}
            onClick={fn as () => void}
            className={cn("flex-1 h-8 rounded-lg bg-surface-2 border border-white/10 text-xs font-bold text-white/70 hover:text-white disabled:opacity-40")}
          >
            {label as string}
          </button>
        ))}
      </div>
    </div>
  );
}
