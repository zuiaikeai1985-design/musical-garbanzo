import React from "react";
import { random } from "remotion";
import { palette } from "../theme";

type Props = {
  size: number;
  /** 0–1 亮度 */
  lit: number;
  seed?: string;
};

/** 暗金锤揲珠：珠体渐变 + 细碎锤痕反光点 */
export const GoldBead: React.FC<Props> = ({ size, lit, seed = "bead" }) => {
  const marks = Array.from({ length: 14 }, (_, i) => {
    const a = random(`${seed}-a-${i}`) * Math.PI * 2;
    const r = Math.sqrt(random(`${seed}-r-${i}`)) * 0.38;
    return {
      x: 50 + Math.cos(a) * r * 100,
      y: 50 + Math.sin(a) * r * 100,
      s: 2 + random(`${seed}-s-${i}`) * 4.5,
      o: 0.25 + random(`${seed}-o-${i}`) * 0.75,
    };
  });

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <defs>
        <radialGradient id={`${seed}-body`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={palette.goldBright} />
          <stop offset="38%" stopColor={palette.gold} />
          <stop offset="78%" stopColor={palette.goldDeep} />
          <stop offset="100%" stopColor="#3A2A10" />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="46" fill={`url(#${seed}-body)`} opacity={0.25 + 0.75 * lit} />
      {marks.map((m, i) => (
        <circle
          key={i}
          cx={m.x}
          cy={m.y}
          r={m.s}
          fill={palette.flameHot}
          opacity={m.o * lit * 0.7}
        />
      ))}
      {/* 主高光 */}
      <circle cx="38" cy="30" r="9" fill={palette.flameHot} opacity={0.9 * lit} />
    </svg>
  );
};
