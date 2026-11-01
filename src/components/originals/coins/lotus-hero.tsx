"use client";

import { memo } from "react";

const PETALS = [-78, -52, -26, 0, 26, 52, 78];
const SPARKS = Array.from({ length: 24 }, (_, i) => ({ left: (i * 41) % 100, size: 2 + ((i * 3) % 4), delay: (i * 0.37) % 6, dur: 5 + ((i * 5) % 5) }));
const STRINGS = [14, 30, 70, 86];

/** Top scene: glowing golden lotus, flickering diyas, hanging coin strings, falling sparks. */
export const LotusHero = memo(function LotusHero({ fever }: { fever: boolean }) {
  return (
    <div className={`ga-hero ${fever ? "ga-fever" : ""}`}>
      <div className="ga-rays" />
      <svg viewBox="0 0 400 260" className="ga-hero-svg" aria-label="Golden lotus with coins">
        <circle cx="200" cy="150" r="96" fill="url(#ga-sun)" opacity="0.5" className="ga-halo" />
        {STRINGS.map((x, i) => (
          <g key={x}>
            <line x1={x * 4} y1="0" x2={x * 4} y2={40 + (i % 2) * 22} stroke="#e9b24a" strokeWidth="1.6" />
            {[0, 1, 2].map((k) => (
              <circle key={k} cx={x * 4} cy={14 + k * 14 + (i % 2) * 8} r="6" fill="url(#ga-gold)" stroke="#8a5412" className="lc-swing" style={{ animationDelay: `${i * 0.4 + k * 0.15}s` }} />
            ))}
          </g>
        ))}
        <g className="lc-bloom" style={{ transformOrigin: "200px 220px" }}>
          {PETALS.map((a, i) => (
            <path key={a} d="M200 222 C168 190 170 120 200 70 C230 120 232 190 200 222Z" fill={i % 2 ? "url(#ga-gold)" : "url(#ga-pink)"} stroke="#8a2a52" strokeWidth="1.6" transform={`rotate(${a} 200 222) scale(${1 - Math.abs(a) / 300})`} opacity={0.97} />
          ))}
          <circle cx="200" cy="168" r="22" fill="url(#ga-sun)" stroke="#8a5412" strokeWidth="2" />
          <text x="200" y="180" textAnchor="middle" fontSize="30" fontWeight="900" fill="#8a4a08" fontFamily="Georgia, serif">₹</text>
        </g>
        {[60, 340].map((x) => (
          <g key={x}>
            <path d={`M${x - 26} 238 C${x - 24} 256 ${x - 10} 260 ${x} 260 C${x + 10} 260 ${x + 24} 256 ${x + 26} 238Z`} fill="#d9692a" stroke="#7a2e0c" strokeWidth="2" />
            <path className="lc-flame" d={`M${x} 196 C${x + 12} 212 ${x + 13} 222 ${x} 232 C${x - 13} 222 ${x - 12} 212 ${x} 196Z`} fill="#ffd54a" stroke="#e8890c" strokeWidth="1.6" style={{ transformOrigin: `${x}px 232px` }} />
          </g>
        ))}
      </svg>
      {SPARKS.map((p, i) => (
        <span key={i} className="ga-spark" style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }} />
      ))}
    </div>
  );
});
