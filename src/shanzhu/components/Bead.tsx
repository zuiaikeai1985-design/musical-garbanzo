import React from "react";
import { palette } from "../theme";

/** Brand logo: lotus petals + meditating figure + bead heart */
export const BrandLogo: React.FC<{
  size?: number;
  showBead?: boolean;
  open?: number;
}> = ({ size = 220, showBead = true, open = 1 }) => {
  const s = size;
  return (
    <svg width={s} height={s} viewBox="0 0 200 200">
      {/* outer lotus strokes */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((deg, i) => {
        const rad = ((deg - 90) * Math.PI) / 180;
        const len = 58 + open * 18;
        const x2 = 100 + Math.cos(rad) * len;
        const y2 = 100 + Math.sin(rad) * len;
        return (
          <path
            key={i}
            d={`M100 100 Q ${100 + Math.cos(rad) * 28} ${100 + Math.sin(rad) * 28 - 10} ${x2} ${y2}`}
            fill="none"
            stroke={palette.gold}
            strokeWidth="2.2"
            opacity={0.55 + open * 0.35}
          />
        );
      })}
      {/* lotus cup */}
      <path
        d="M100 48 C118 68 142 78 142 104 C142 132 122 150 100 162 C78 150 58 132 58 104 C58 78 82 68 100 48 Z"
        fill="none"
        stroke={palette.gold}
        strokeWidth="2.6"
      />
      {/* meditating figure */}
      <path
        d="M100 78 C112 88 118 100 118 112 C118 128 110 138 100 144 C90 138 82 128 82 112 C82 100 88 88 100 78 Z"
        fill="none"
        stroke={palette.goldBright}
        strokeWidth="2"
      />
      <circle cx="100" cy="96" r="4.5" fill={palette.goldBright} />
      {showBead ? (
        <circle
          cx="100"
          cy="118"
          r="7"
          fill={palette.goldBright}
          opacity="0.95"
          style={{
            filter: `drop-shadow(0 0 10px ${palette.gold})`,
          }}
        />
      ) : null}
    </svg>
  );
};

export const Bead: React.FC<{
  size: number;
  glow?: number;
}> = ({ size, glow = 0.6 }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, #fff8e0 0%, ${palette.goldBright} 36%, ${palette.gold} 62%, #2a1a08 100%)`,
        boxShadow: `
          0 0 ${size * 0.5}px ${palette.gold},
          0 0 ${size * 1.1}px rgba(224, 180, 90, ${glow}),
          inset -6px -8px ${size * 0.2}px rgba(0,0,0,0.35)
        `,
      }}
    />
  );
};
