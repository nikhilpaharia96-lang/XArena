"use client";
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { RefreshCw } from "lucide-react";

const THRESHOLD = 70;

/** Pull down from the top of the page to refetch everything on screen (touch devices only). */
export function PullToRefresh() {
  const qc = useQueryClient();
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  const pullRef = useRef(0);

  useEffect(() => {
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const onStart = (e: TouchEvent) => {
      startY.current = window.scrollY <= 0 && !document.querySelector("[role=dialog]") ? e.touches[0].clientY : null;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current === null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) { pullRef.current = 0; setPull(0); return; }
      pullRef.current = Math.min(dy * 0.5, 100);
      setPull(pullRef.current);
    };
    const onEnd = async () => {
      const reached = pullRef.current >= THRESHOLD * 0.8;
      startY.current = null; pullRef.current = 0; setPull(0);
      if (!reached) return;
      setBusy(true);
      try { navigator.vibrate?.(10); await qc.invalidateQueries(); } finally { setTimeout(() => setBusy(false), 400); }
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
    };
  }, [qc]);

  const visible = busy || pull > 8;
  if (!visible) return null;
  return (
    <div aria-hidden className="pointer-events-none fixed left-1/2 z-40 -translate-x-1/2" style={{ top: `calc(env(safe-area-inset-top) + ${busy ? 64 : 48 + pull * 0.6}px)` }}>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--topbar-bg)] border border-white/15 shadow-lg">
        <RefreshCw className={`h-4 w-4 text-signal ${busy ? "animate-spin" : ""}`} style={busy ? undefined : { transform: `rotate(${pull * 3}deg)` }} />
      </span>
    </div>
  );
}
