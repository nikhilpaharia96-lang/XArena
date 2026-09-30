"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

function getRemaining(target: string) {
  const diff = Math.max(0, new Date(target).getTime() - Date.now());
  const totalSeconds = Math.floor(diff / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { hours, minutes, seconds, done: diff <= 0 };
}

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Premium "digit box" countdown (01 : 11 : 24 — HRS MIN SEC) used on the
 * tournament detail hero. Ticks every second and cleans up on unmount.
 * Calling code decides *whether* to render this (only in the "upcoming"
 * state) — this component only renders the digits themselves.
 */
export function CountdownBlocks({ target, onExpire, className }: { target: string; onExpire?: () => void; className?: string }) {
  const [remaining, setRemaining] = useState(() => getRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => {
      setRemaining((prev) => {
        const next = getRemaining(target);
        if (next.done && !prev.done) onExpire?.();
        return next;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target]);

  const units = [
    { label: "HRS", value: remaining.hours },
    { label: "MIN", value: remaining.minutes },
    { label: "SEC", value: remaining.seconds },
  ];

  return (
    <div className={cn("flex items-center gap-1.5", className)} role="timer" aria-live="off">
      {units.map((u, i) => (
        <div key={u.label} className="flex items-center gap-1.5">
          <div className="flex flex-col items-center">
            <span className="font-mono font-black text-xl sm:text-2xl text-white tabular-nums leading-none">{pad(u.value)}</span>
            <span className="text-[9px] font-semibold text-white/40 tracking-wide mt-1">{u.label}</span>
          </div>
          {i < units.length - 1 && <span className="text-lg font-bold text-white/25 -mt-3">:</span>}
        </div>
      ))}
    </div>
  );
}
