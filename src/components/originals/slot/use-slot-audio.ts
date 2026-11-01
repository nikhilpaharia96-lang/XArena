"use client";

import { useCallback, useRef } from "react";

type Tone = { f: number; t: number; d: number; type?: OscillatorType; g?: number };

/** Tiny WebAudio synth: no audio files needed. Silent until the first user gesture and when muted. */
export function useSlotAudio(enabled: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const play = useCallback(
    (tones: Tone[]) => {
      if (!enabled || typeof window === "undefined") return;
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        const ctx = (ctxRef.current ??= new AC());
        if (ctx.state === "suspended") void ctx.resume();
        const now = ctx.currentTime;
        for (const tn of tones) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = tn.type ?? "triangle";
          osc.frequency.value = tn.f;
          const peak = tn.g ?? 0.08;
          gain.gain.setValueAtTime(0.0001, now + tn.t);
          gain.gain.exponentialRampToValueAtTime(peak, now + tn.t + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + tn.t + tn.d);
          osc.connect(gain).connect(ctx.destination);
          osc.start(now + tn.t);
          osc.stop(now + tn.t + tn.d + 0.05);
        }
      } catch {
        /* audio is optional */
      }
    },
    [enabled]
  );

  return {
    spin: useCallback(() => play([{ f: 180, t: 0, d: 0.18, type: "sawtooth", g: 0.04 }, { f: 260, t: 0.08, d: 0.18, type: "sawtooth", g: 0.04 }]), [play]),
    stop: useCallback(() => play([{ f: 140, t: 0, d: 0.1, type: "square", g: 0.05 }]), [play]),
    win: useCallback((level: number) => play(Array.from({ length: 3 + level * 2 }, (_, i) => ({ f: 523 * Math.pow(1.122, i * 2), t: i * 0.09, d: 0.2 }))), [play]),
    bonus: useCallback(() => play([523, 659, 784, 1047, 1319].map((f, i) => ({ f, t: i * 0.12, d: 0.35, g: 0.09 }))), [play]),
  };
}
