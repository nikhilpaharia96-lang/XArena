"use client";

import { memo } from "react";

/**
 * Original vector art for "Garuda Ascent". One shared <SymbolDefs/> holds the
 * gradients; every symbol is a 100x100 SVG that references them by id.
 */

export function SymbolDefs() {
  return (
    <svg width="0" height="0" style={{ position: "absolute" }} aria-hidden>
      <defs>
        <linearGradient id="ga-gold" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff2b0" />
          <stop offset="0.45" stopColor="#f7c53a" />
          <stop offset="1" stopColor="#b8741a" />
        </linearGradient>
        <linearGradient id="ga-pink" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffd1e8" />
          <stop offset="1" stopColor="#e0509a" />
        </linearGradient>
        <linearGradient id="ga-shell" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#fff8e8" />
          <stop offset="1" stopColor="#e2b98a" />
        </linearGradient>
        <radialGradient id="ga-blue" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#9fe0ff" />
          <stop offset="1" stopColor="#1d5fd0" />
        </radialGradient>
        <radialGradient id="ga-green" cx="0.5" cy="0.5" r="0.6">
          <stop offset="0" stopColor="#7cf0c4" />
          <stop offset="1" stopColor="#0b7a5c" />
        </radialGradient>
        <radialGradient id="ga-sun" cx="0.5" cy="0.5" r="0.55">
          <stop offset="0" stopColor="#fffbe0" />
          <stop offset="0.6" stopColor="#ffc93c" />
          <stop offset="1" stopColor="#e07a10" />
        </radialGradient>
        <linearGradient id="ga-temple" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ff9a6b" />
          <stop offset="1" stopColor="#a8231f" />
        </linearGradient>
      </defs>
    </svg>
  );
}

const Lotus = () => (
  <svg viewBox="0 0 100 100">
    <ellipse cx="50" cy="76" rx="34" ry="9" fill="#1f8f5a" />
    <ellipse cx="50" cy="74" rx="26" ry="6" fill="#34b377" />
    {[-64, -32, 0, 32, 64].map((a) => (
      <path key={a} d="M50 70 C38 52 40 28 50 14 C60 28 62 52 50 70Z" fill="url(#ga-pink)" stroke="#a02a68" strokeWidth="1.2" transform={`rotate(${a} 50 70)`} />
    ))}
    <circle cx="50" cy="58" r="5" fill="url(#ga-gold)" />
  </svg>
);

const Conch = () => (
  <svg viewBox="0 0 100 100">
    <path d="M18 62 C14 36 40 16 66 24 C86 30 88 54 72 70 C58 84 30 84 18 62Z" fill="url(#ga-shell)" stroke="#a9763f" strokeWidth="2" />
    <path d="M66 24 C78 14 90 18 94 26 C84 28 78 34 74 42" fill="#f6dcb4" stroke="#a9763f" strokeWidth="2" />
    <path d="M58 40 C48 34 36 42 38 54 C40 64 54 66 58 58 C60 52 54 48 50 52" fill="none" stroke="#b9854a" strokeWidth="2.4" strokeLinecap="round" />
    <path d="M24 62 C34 74 52 78 66 70" fill="none" stroke="#e6b27a" strokeWidth="2" />
  </svg>
);

const Bell = () => (
  <svg viewBox="0 0 100 100">
    <rect x="44" y="8" width="12" height="10" rx="3" fill="url(#ga-gold)" stroke="#8a5412" />
    <path d="M24 74 C26 50 30 24 50 20 C70 24 74 50 76 74 Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2" />
    <rect x="20" y="72" width="60" height="9" rx="4.5" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2" />
    <path d="M36 62 C37 46 40 34 46 28" fill="none" stroke="#fff6c8" strokeWidth="3" strokeLinecap="round" opacity="0.8" />
    <circle cx="50" cy="86" r="6" fill="url(#ga-gold)" stroke="#8a5412" />
  </svg>
);

const Chakra = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" fill="url(#ga-blue)" stroke="url(#ga-gold)" strokeWidth="6" />
    {Array.from({ length: 12 }, (_, i) => (
      <line key={i} x1="50" y1="50" x2="50" y2="14" stroke="#ffe27a" strokeWidth="3" strokeLinecap="round" transform={`rotate(${i * 30} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="22" fill="none" stroke="#ffe27a" strokeWidth="3" />
    <circle cx="50" cy="50" r="9" fill="url(#ga-gold)" stroke="#8a5412" />
  </svg>
);

const Feather = () => (
  <svg viewBox="0 0 100 100">
    <path d="M50 94 C52 70 48 50 50 30" fill="none" stroke="#1d6b4f" strokeWidth="3" strokeLinecap="round" />
    <path d="M50 90 C20 70 18 30 50 8 C82 30 80 70 50 90Z" fill="url(#ga-green)" stroke="#0b5a44" strokeWidth="2" />
    <ellipse cx="50" cy="38" rx="17" ry="22" fill="#1d5fd0" stroke="#f7c53a" strokeWidth="2.5" />
    <ellipse cx="50" cy="38" rx="10" ry="14" fill="#0e9a8c" />
    <ellipse cx="50" cy="37" rx="5" ry="8" fill="#10264f" />
    <ellipse cx="48" cy="33" rx="1.8" ry="3" fill="#bfe6ff" />
  </svg>
);

const Garuda = () => (
  <svg viewBox="0 0 100 100">
    <path d="M6 58 C8 34 22 20 38 18 L34 36 C24 40 16 48 6 58Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="1.6" />
    <path d="M94 58 C92 34 78 20 62 18 L66 36 C76 40 84 48 94 58Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="1.6" />
    <path d="M30 78 C26 52 34 30 50 26 C66 30 74 52 70 78 C62 88 38 88 30 78Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2" />
    <path d="M38 22 L42 8 L50 16 L58 8 L62 22Z" fill="#e63b3b" stroke="#8a5412" strokeWidth="1.6" />
    <path d="M46 52 L50 74 L54 52Z" fill="#ff9a1f" stroke="#8a5412" strokeWidth="1.4" />
    <path d="M36 44 L46 48 L44 52 L34 49Z" fill="#fffbe0" />
    <path d="M64 44 L54 48 L56 52 L66 49Z" fill="#fffbe0" />
    <circle cx="41" cy="48" r="3" fill="#ff2a2a" />
    <circle cx="59" cy="48" r="3" fill="#ff2a2a" />
    <circle cx="50" cy="34" r="3" fill="#3ff0c8" stroke="#8a5412" />
  </svg>
);

const Wild = () => (
  <svg viewBox="0 0 100 100">
    {Array.from({ length: 16 }, (_, i) => (
      <path key={i} d="M50 4 L55 22 L45 22Z" fill="#ffd54a" transform={`rotate(${i * 22.5} 50 50)`} />
    ))}
    <circle cx="50" cy="50" r="28" fill="url(#ga-sun)" stroke="#8a5412" strokeWidth="2.5" />
    <circle cx="50" cy="50" r="19" fill="none" stroke="#b8741a" strokeWidth="2" />
    <rect x="14" y="68" width="72" height="20" rx="4" fill="#a8231f" stroke="#ffd54a" strokeWidth="2" />
    <text x="50" y="83" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff2b0" fontFamily="Georgia, serif">WILD</text>
  </svg>
);

const Scatter = () => (
  <svg viewBox="0 0 100 100">
    <rect x="8" y="8" width="84" height="84" rx="14" fill="#3a0f2e" />
    <path d="M26 82 L30 62 L70 62 L74 82Z" fill="url(#ga-temple)" stroke="#ffd54a" strokeWidth="1.6" />
    <path d="M32 62 L36 46 L64 46 L68 62Z" fill="url(#ga-temple)" stroke="#ffd54a" strokeWidth="1.6" />
    <path d="M38 46 L42 32 L58 32 L62 46Z" fill="url(#ga-temple)" stroke="#ffd54a" strokeWidth="1.6" />
    <path d="M44 32 L50 14 L56 32Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="1.4" />
    <rect x="45" y="68" width="10" height="14" rx="5" fill="#ffd54a" />
    <text x="50" y="96" textAnchor="middle" fontSize="11" fontWeight="900" fill="#ffd54a" fontFamily="Georgia, serif">BONUS</text>
  </svg>
);

const ART = [Lotus, Conch, Bell, Chakra, Feather, Garuda, Wild, Scatter];
export const SYMBOL_LABEL = ["Lotus", "Conch", "Bell", "Chakra", "Peacock Feather", "Golden Garuda", "Wild Sun", "Temple Bonus"];

export const SymbolArt = memo(function SymbolArt({ id }: { id: number }) {
  const Art = ART[id] ?? Lotus;
  return <Art />;
});
