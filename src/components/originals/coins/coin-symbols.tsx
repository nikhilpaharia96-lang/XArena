"use client";

import { memo } from "react";

/** Original vector art for "Lakshmi Coins". Uses the gradients defined by <SymbolDefs/> (slot/symbols.tsx). */

const Diya = () => (
  <svg viewBox="0 0 100 100">
    <path d="M50 8 C62 24 64 36 50 46 C36 36 38 24 50 8Z" fill="#ffd54a" stroke="#e8890c" strokeWidth="2" />
    <path d="M50 22 C56 30 56 36 50 41 C44 36 44 30 50 22Z" fill="#fff6c0" />
    <path d="M12 54 C14 78 34 88 50 88 C66 88 86 78 88 54 Z" fill="#d9692a" stroke="#7a2e0c" strokeWidth="2.5" />
    <path d="M12 54 C30 62 70 62 88 54 C70 48 30 48 12 54Z" fill="#f28a3a" stroke="#7a2e0c" strokeWidth="2" />
    <path d="M28 70 C40 78 60 78 72 70" fill="none" stroke="#ffd54a" strokeWidth="2.5" strokeLinecap="round" />
    <circle cx="50" cy="52" r="4" fill="#3a1500" />
  </svg>
);

const Bangle = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="38" cy="54" r="28" fill="none" stroke="#c81e3c" strokeWidth="11" />
    <circle cx="38" cy="54" r="28" fill="none" stroke="url(#ga-gold)" strokeWidth="3" strokeDasharray="6 5" />
    <circle cx="62" cy="46" r="28" fill="none" stroke="#1f9d6a" strokeWidth="11" />
    <circle cx="62" cy="46" r="28" fill="none" stroke="url(#ga-gold)" strokeWidth="3" strokeDasharray="6 5" />
    <path d="M22 36 C28 26 40 22 50 24" fill="none" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" opacity="0.6" />
  </svg>
);

const Coconut = () => (
  <svg viewBox="0 0 100 100">
    <path d="M50 18 C30 6 14 14 10 26 C26 22 40 24 50 30Z" fill="#2f9e5a" stroke="#14653a" strokeWidth="1.6" />
    <path d="M50 18 C70 6 86 14 90 26 C74 22 60 24 50 30Z" fill="#35b366" stroke="#14653a" strokeWidth="1.6" />
    <circle cx="50" cy="58" r="32" fill="#8a5a2b" stroke="#4a2a0c" strokeWidth="2.5" />
    <circle cx="50" cy="58" r="32" fill="url(#ga-shell)" opacity="0.18" />
    <circle cx="41" cy="52" r="3.6" fill="#2a1406" />
    <circle cx="59" cy="52" r="3.6" fill="#2a1406" />
    <circle cx="50" cy="66" r="3.6" fill="#2a1406" />
    <path d="M30 40 C36 32 44 28 52 28" fill="none" stroke="#e0b078" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
  </svg>
);

const Kalash = () => (
  <svg viewBox="0 0 100 100">
    <path d="M30 18 C34 4 66 4 70 18 C66 24 34 24 30 18Z" fill="#2f9e5a" stroke="#14653a" strokeWidth="1.6" />
    <circle cx="50" cy="14" r="9" fill="#a8672a" stroke="#4a2a0c" strokeWidth="1.8" />
    <path d="M34 26 L66 26 L62 34 L38 34Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="1.8" />
    <path d="M38 34 C14 40 12 74 36 88 L64 88 C88 74 86 40 62 34Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2.2" />
    <ellipse cx="50" cy="60" rx="14" ry="12" fill="#c81e3c" stroke="#8a5412" strokeWidth="1.6" />
    <circle cx="50" cy="60" r="5" fill="url(#ga-gold)" />
    <path d="M26 50 C26 62 30 72 36 78" fill="none" stroke="#fff6c8" strokeWidth="3" strokeLinecap="round" opacity="0.7" />
  </svg>
);

const Elephant = () => (
  <svg viewBox="0 0 100 100">
    <path d="M14 36 C2 40 2 66 18 74 C26 70 28 52 24 40Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2" />
    <path d="M86 36 C98 40 98 66 82 74 C74 70 72 52 76 40Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2" />
    <path d="M26 30 C26 12 74 12 74 30 C78 54 66 66 62 78 C60 90 54 94 52 88 C50 80 52 72 50 70 C48 72 50 80 48 88 C46 94 40 90 38 78 C34 66 22 54 26 30Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2.2" />
    <path d="M30 22 L50 12 L70 22 L66 28 L50 22 L34 28Z" fill="#c81e3c" stroke="#8a5412" strokeWidth="1.6" />
    <circle cx="50" cy="20" r="3" fill="#3ff0c8" stroke="#8a5412" />
    <circle cx="39" cy="44" r="3.4" fill="#3a1500" />
    <circle cx="61" cy="44" r="3.4" fill="#3a1500" />
    <path d="M40 62 C34 70 32 80 34 88" fill="none" stroke="#fffbe0" strokeWidth="4.5" strokeLinecap="round" />
    <path d="M60 62 C66 70 68 80 66 88" fill="none" stroke="#fffbe0" strokeWidth="4.5" strokeLinecap="round" />
  </svg>
);

const Crown = () => (
  <svg viewBox="0 0 100 100">
    <path d="M12 74 L8 30 L30 50 L50 18 L70 50 L92 30 L88 74Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2.4" strokeLinejoin="round" />
    <rect x="12" y="70" width="76" height="14" rx="4" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2.2" />
    <circle cx="50" cy="40" r="6.5" fill="#e63b3b" stroke="#8a5412" />
    <circle cx="28" cy="56" r="4.5" fill="#3ff0c8" stroke="#8a5412" />
    <circle cx="72" cy="56" r="4.5" fill="#7a5cff" stroke="#8a5412" />
    {[24, 40, 56, 72].map((x) => <circle key={x} cx={x + 2} cy="77" r="3" fill="#fff6c8" stroke="#8a5412" strokeWidth="0.8" />)}
    <circle cx="8" cy="30" r="4" fill="#fff6c8" stroke="#8a5412" />
    <circle cx="50" cy="18" r="4" fill="#fff6c8" stroke="#8a5412" />
    <circle cx="92" cy="30" r="4" fill="#fff6c8" stroke="#8a5412" />
  </svg>
);

const Wild = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="46" r="40" fill="url(#ga-sun)" opacity="0.35" />
    {[-72, -36, 0, 36, 72].map((a) => (
      <path key={a} d="M50 64 C36 50 38 24 50 8 C62 24 64 50 50 64Z" fill="url(#ga-pink)" stroke="#a02a68" strokeWidth="1.4" transform={`rotate(${a} 50 64)`} />
    ))}
    <circle cx="50" cy="52" r="7" fill="url(#ga-gold)" stroke="#8a5412" />
    <rect x="14" y="70" width="72" height="20" rx="4" fill="#a8231f" stroke="#ffd54a" strokeWidth="2" />
    <text x="50" y="85" textAnchor="middle" fontSize="15" fontWeight="900" fill="#fff2b0" fontFamily="Georgia, serif">WILD</text>
  </svg>
);

const CoinArt = () => (
  <svg viewBox="0 0 100 100">
    <circle cx="50" cy="50" r="40" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="3" />
    <circle cx="50" cy="50" r="31" fill="none" stroke="#b8741a" strokeWidth="2.4" strokeDasharray="3 3" />
    <text x="50" y="64" textAnchor="middle" fontSize="40" fontWeight="900" fill="#8a4a08" fontFamily="Georgia, serif">₹</text>
    <path d="M24 34 C30 22 42 16 54 16" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" opacity="0.65" />
  </svg>
);

const ART = [Diya, Bangle, Coconut, Kalash, Elephant, Crown, Wild, CoinArt];
export const COIN_LABEL = ["Diya", "Bangle", "Coconut", "Kalash", "Elephant", "Royal Crown", "Lotus Wild", "Cash Coin"];

export const CoinSymbol = memo(function CoinSymbol({ id }: { id: number }) {
  const Art = ART[id] ?? Diya;
  return <Art />;
});
