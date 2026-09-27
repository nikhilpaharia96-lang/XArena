"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/cn";

function getRemaining(target: string) {
  const diff = new Date(target).getTime() - Date.now();
  if (diff <= 0) return null;
  const totalSeconds = Math.floor(diff / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return { days, hours, minutes, seconds };
}

export function CountdownTimer({ target, className, label }: { target: string; className?: string; label?: string }) {
  const [remaining, setRemaining] = useState(() => getRemaining(target));

  useEffect(() => {
    const interval = setInterval(() => setRemaining(getRemaining(target)), 1000);
    return () => clearInterval(interval);
  }, [target]);

  if (!remaining) {
    return <span className={cn("text-xs font-mono font-semibold text-crimson", className)}>{label ?? "Started"}</span>;
  }

  const parts =
    remaining.days > 0
      ? [`${remaining.days}d`, `${remaining.hours}h`]
      : remaining.hours > 0
        ? [`${remaining.hours}h`, `${remaining.minutes}m`]
        : [`${remaining.minutes}m`, `${remaining.seconds}s`];

  return (
    <span className={cn("text-xs font-mono font-semibold tabular-nums text-white/80", className)}>
      {parts.join(" ")}
    </span>
  );
}
