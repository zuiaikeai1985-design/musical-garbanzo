import React from "react";
import { palette } from "../theme";

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

export const Lotus: React.FC<{
  size?: number;
  open?: number;
}> = ({ size = 420, open = 1 }) => {
  const petals = 8;
  return (
    <div style={{ width: size, height: size, position: "relative" }}>
      {Array.from({ length: petals }).map((_, i) => {
        const angle = (i / petals) * 360;
        const spread = 28 + open * 38;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: "50%",
              top: "50%",
              width: size * 0.18,
              height: size * 0.42,
              marginLeft: -(size * 0.09),
              marginTop: -(size * 0.36),
              borderRadius: "50% 50% 45% 45%",
              background: `linear-gradient(180deg, ${palette.goldBright} 0%, ${palette.lotus} 55%, ${palette.goldDeep} 100%)`,
              opacity: 0.55 + open * 0.35,
              transform: `rotate(${angle}deg) translateY(${-spread}px)`,
              transformOrigin: "50% 100%",
              boxShadow: `0 0 24px ${palette.gold}55`,
            }}
          />
        );
      })}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "52%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <Bead size={size * 0.16} glow={0.75} />
      </div>
    </div>
  );
};

export const LogoMark: React.FC<{ size?: number }> = ({ size = 120 }) => {
  return (
    <svg width={size} height={size} viewBox="0 0 120 120">
      <path
        d="M60 18 C72 34 92 42 92 62 C92 82 76 96 60 104 C44 96 28 82 28 62 C28 42 48 34 60 18 Z"
        fill="none"
        stroke={palette.gold}
        strokeWidth="2.5"
      />
      <path
        d="M60 40 C68 48 74 56 74 66 C74 78 68 86 60 90 C52 86 46 78 46 66 C46 56 52 48 60 40 Z"
        fill="none"
        stroke={palette.goldBright}
        strokeWidth="2"
      />
      <circle cx="60" cy="58" r="5" fill={palette.goldBright} />
    </svg>
  );
};
