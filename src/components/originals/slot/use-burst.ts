"use client";

import { useCallback, useEffect, useRef } from "react";

interface P { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; color: string }
const COLORS = ["#fff2b0", "#f7c53a", "#ffb02e", "#ff7a2f", "#ffffff"];

/** Canvas gold-particle explosions. The animation loop only runs while particles are alive. */
export function useBurst() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const parts = useRef<P[]>([]);
  const raf = useRef(0);

  const loopRef = useRef<FrameRequestCallback>(() => undefined);
  useEffect(() => {
    loopRef.current = () => {
      const c = canvasRef.current;
      const ctx = c?.getContext("2d");
      if (!c || !ctx) { raf.current = 0; return; }
      const dpr = window.devicePixelRatio || 1;
      const w = c.clientWidth, h = c.clientHeight;
      if (c.width !== w * dpr || c.height !== h * dpr) { c.width = w * dpr; c.height = h * dpr; }
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      parts.current = parts.current.filter((p) => p.life < p.max);
      for (const p of parts.current) {
        p.life++; p.x += p.vx; p.y += p.vy; p.vy += 0.16; p.vx *= 0.99;
        ctx.globalAlpha = Math.max(0, 1 - p.life / p.max);
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
      ctx.globalAlpha = 1;
      raf.current = parts.current.length ? requestAnimationFrame(loopRef.current) : 0;
      if (!parts.current.length) ctx.clearRect(0, 0, w, h);
    };
  }, []);
  const kick = useCallback(() => {
    if (!raf.current) raf.current = requestAnimationFrame(loopRef.current);
  }, []);

  const burst = useCallback((x: number, y: number, count = 36, power = 1) => {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2, s = (2 + Math.random() * 5) * power;
      parts.current.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 0, max: 40 + Math.random() * 40, size: 1.5 + Math.random() * 3, color: COLORS[(Math.random() * COLORS.length) | 0] });
    }
    if (parts.current.length > 600) parts.current.splice(0, parts.current.length - 600);
    kick();
  }, [kick]);

  /** Coins falling from the top - big win celebration. */
  const rain = useCallback((count = 60) => {
    const c = canvasRef.current;
    const w = c?.clientWidth ?? 360;
    for (let i = 0; i < count; i++) {
      parts.current.push({ x: Math.random() * w, y: -10 - Math.random() * 80, vx: (Math.random() - 0.5) * 1.5, vy: 1 + Math.random() * 3, life: 0, max: 70 + Math.random() * 50, size: 2 + Math.random() * 3, color: COLORS[(Math.random() * 3) | 0] });
    }
    kick();
  }, [kick]);

  useEffect(() => () => { if (raf.current) cancelAnimationFrame(raf.current); }, []);
  return { canvasRef, burst, rain };
}
