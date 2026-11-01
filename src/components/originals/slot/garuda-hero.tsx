"use client";

import { memo } from "react";

const LEFT = [172, 184, 196, 208, 220, 232, 244];
const RIGHT = [8, -4, -16, -28, -40, -52, -64];
const FEATHER = "M0 0 C40 -18 120 -16 160 0 C120 12 40 14 0 0Z";

function Wing({ angles, side }: { angles: number[]; side: "l" | "r" }) {
  return (
    <g className={side === "l" ? "ga-wing-l" : "ga-wing-r"} style={{ transformOrigin: side === "l" ? "168px 150px" : "232px 150px" }}>
      {angles.map((a, i) => (
        <path
          key={a}
          d={FEATHER}
          fill="url(#ga-gold)"
          stroke="#8a5412"
          strokeWidth="1.4"
          transform={`translate(${side === "l" ? 168 : 232} 150) rotate(${a}) scale(${(1.1 - i * 0.045).toFixed(3)} 1)`}
          opacity={0.96}
        />
      ))}
    </g>
  );
}

const SPARKS = Array.from({ length: 22 }, (_, i) => ({
  left: (i * 37) % 100,
  size: 2 + ((i * 5) % 4),
  delay: (i * 0.43) % 6,
  dur: 5 + ((i * 7) % 5),
}));

/** The animated top scene: sunset sky, temple silhouettes, light rays, wing-flapping Garuda with glowing eyes. */
export const GarudaHero = memo(function GarudaHero({ fever, pulse }: { fever: boolean; pulse: number }) {
  return (
    <div className={`ga-hero ${fever ? "ga-fever" : ""}`} data-pulse={pulse}>
      <div className="ga-rays" />
      <svg viewBox="0 0 400 260" className="ga-hero-svg" aria-label="Golden Garuda">
        <circle cx="200" cy="120" r="92" fill="url(#ga-sun)" opacity="0.5" className="ga-halo" />
        {/* temples */}
        <g fill="#2a1038" opacity="0.92">
          {[
            [10, 70],
            [330, 70],
          ].map(([x]) => (
            <g key={x} transform={`translate(${x} 0)`}>
              <path d="M10 260 L16 200 L56 200 L62 260Z" />
              <path d="M18 200 L24 168 L48 168 L54 200Z" />
              <path d="M26 168 L30 146 L42 146 L46 168Z" />
              <path d="M32 146 L36 126 L40 146Z" />
            </g>
          ))}
        </g>
        <Wing angles={LEFT} side="l" />
        <Wing angles={RIGHT} side="r" />
        {/* body */}
        <path d="M168 258 C160 208 172 168 200 160 C228 168 240 208 232 258Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2" />
        <path d="M184 196 L216 196 M186 214 L214 214 M190 232 L210 232" stroke="#b8741a" strokeWidth="2" strokeLinecap="round" />
        <path d="M176 172 C188 192 212 192 224 172" fill="none" stroke="#fff2b0" strokeWidth="3" />
        {[184, 200, 216].map((x, i) => (
          <circle key={x} cx={x} cy={188 + (i === 1 ? 6 : 0)} r="4.5" fill={["#e63b3b", "#3ff0c8", "#7a5cff"][i]} stroke="#8a5412" />
        ))}
        {/* head */}
        <path d="M182 150 C180 120 188 100 200 96 C212 100 220 120 218 150 C210 160 190 160 182 150Z" fill="url(#ga-gold)" stroke="#8a5412" strokeWidth="2" />
        <path d="M184 98 L190 74 L200 88 L210 74 L216 98Z" fill="#e63b3b" stroke="#8a5412" strokeWidth="1.8" />
        <path d="M196 62 L200 44 L204 62Z" fill="url(#ga-gold)" stroke="#8a5412" />
        <path d="M193 128 L200 148 L207 128Z" fill="#ff9a1f" stroke="#8a5412" strokeWidth="1.4" />
        <g className="ga-eyes">
          <circle cx="192" cy="116" r="4.2" fill="#ff2a2a" />
          <circle cx="208" cy="116" r="4.2" fill="#ff2a2a" />
        </g>
      </svg>
      {SPARKS.map((p, i) => (
        <span
          key={i}
          className="ga-spark"
          style={{ left: `${p.left}%`, width: p.size, height: p.size, animationDelay: `${p.delay}s`, animationDuration: `${p.dur}s` }}
        />
      ))}
    </div>
  );
});
