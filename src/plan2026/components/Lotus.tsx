import React from "react";
import { palette } from "../theme";

type Props = {
  size: number;
  /** 0–1，花瓣展开程度 */
  bloom: number;
  /** 0–1，整体亮度 */
  glow: number;
};

const petalPath = (rx: number, ry: number) =>
  `M 0 0 C ${-rx} ${-ry * 0.45}, ${-rx * 0.62} ${-ry}, 0 ${-ry} C ${rx * 0.62} ${-ry}, ${rx} ${-ry * 0.45}, 0 0 Z`;

/** 金光莲花：外八瓣 + 内五瓣 + 莲心珠光 */
export const Lotus: React.FC<Props> = ({ size, bloom, glow }) => {
  const outer = Array.from({ length: 8 }, (_, i) => i);
  const inner = Array.from({ length: 5 }, (_, i) => i);
  const rx = size * 0.16;
  const ry = size * 0.42;

  return (
    <svg
      width={size * 2}
      height={size * 2}
      viewBox={`${-size} ${-size} ${size * 2} ${size * 2}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <radialGradient id="lotus-heart" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={palette.flameHot} stopOpacity={glow} />
          <stop
            offset="45%"
            stopColor={palette.flame}
            stopOpacity={glow * 0.55}
          />
          <stop offset="100%" stopColor={palette.flame} stopOpacity={0} />
        </radialGradient>
        <linearGradient id="lotus-petal" x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor={palette.goldDeep} />
          <stop offset="70%" stopColor={palette.gold} />
          <stop offset="100%" stopColor={palette.goldBright} />
        </linearGradient>
      </defs>

      {/* 莲心光 */}
      <circle r={size * 0.9} fill="url(#lotus-heart)" />

      {/* 外层八瓣 */}
      {outer.map((i) => {
        const angle = (i / 8) * 360;
        const openScale = 0.25 + 0.75 * bloom;
        return (
          <g
            key={`o-${i}`}
            transform={`rotate(${angle}) scale(${openScale})`}
            opacity={glow * (0.5 + 0.5 * bloom)}
          >
            <path
              d={petalPath(rx, ry)}
              fill="url(#lotus-petal)"
              fillOpacity={0.28}
              stroke="url(#lotus-petal)"
              strokeWidth={size * 0.012}
            />
          </g>
        );
      })}

      {/* 内层五瓣 */}
      {inner.map((i) => {
        const angle = (i / 5) * 360 + 36;
        const openScale = (0.3 + 0.7 * bloom) * 0.58;
        return (
          <g
            key={`i-${i}`}
            transform={`rotate(${angle}) scale(${openScale})`}
            opacity={glow * (0.6 + 0.4 * bloom)}
          >
            <path
              d={petalPath(rx * 1.1, ry * 1.05)}
              fill="url(#lotus-petal)"
              fillOpacity={0.4}
              stroke={palette.goldBright}
              strokeOpacity={0.9}
              strokeWidth={size * 0.014}
            />
          </g>
        );
      })}

      {/* 莲心珠 */}
      <circle
        r={size * 0.075 * (0.8 + 0.2 * bloom)}
        fill={palette.flameHot}
        opacity={glow}
      />
    </svg>
  );
};
