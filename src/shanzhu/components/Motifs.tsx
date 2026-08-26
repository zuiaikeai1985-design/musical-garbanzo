import React from "react";
import { palette } from "../theme";

export const BrotherSilhouettes: React.FC<{
  count?: number;
  scale?: number;
}> = ({ count = 3, scale = 1 }) => {
  const figures = Array.from({ length: count }).map((_, i) => {
    const x = i * 64 - ((count - 1) * 64) / 2;
    const h = 130 + (i % 3) * 12;
    return { x, h, staff: i === Math.floor(count / 2) };
  });

  return (
    <svg
      width={Math.max(280, count * 72) * scale}
      height={220 * scale}
      viewBox={`${-count * 40} -20 ${count * 80} 240`}
      style={{ overflow: "visible" }}
    >
      {figures.map((f, i) => (
        <g key={i} transform={`translate(${f.x}, 0)`}>
          <circle cx="0" cy="16" r="12" fill="#02080c" />
          <path
            d={`M0 28 C-24 42 -30 82 -26 ${f.h} L26 ${f.h} C30 82 24 42 0 28 Z`}
            fill="#02080c"
          />
          {f.staff ? (
            <line
              x1="20"
              y1="36"
              x2="34"
              y2={f.h + 8}
              stroke={palette.gold}
              strokeWidth="2"
              opacity="0.7"
            />
          ) : null}
        </g>
      ))}
    </svg>
  );
};

export const LightPath: React.FC<{ progress: number }> = ({ progress }) => {
  const dash = 1800;
  const offset = dash * (1 - progress);

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1920 1080"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: "absolute", inset: 0 }}
    >
      <defs>
        <linearGradient id="pathGlow" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor={palette.gold} stopOpacity="0.1" />
          <stop offset="50%" stopColor={palette.goldBright} stopOpacity="0.95" />
          <stop offset="100%" stopColor={palette.gold} stopOpacity="0.25" />
        </linearGradient>
      </defs>
      <path
        d="M80 820 C320 760 420 700 560 650 C760 570 860 540 1040 500 C1240 450 1420 420 1840 360"
        fill="none"
        stroke="url(#pathGlow)"
        strokeWidth="10"
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={offset}
      />
      <path
        d="M80 820 C320 760 420 700 560 650 C760 570 860 540 1040 500 C1240 450 1420 420 1840 360"
        fill="none"
        stroke={palette.goldBright}
        strokeWidth="2"
        strokeLinecap="round"
        strokeDasharray={dash}
        strokeDashoffset={offset}
        opacity="0.9"
      />
    </svg>
  );
};

export const TempleLights: React.FC<{ lit: number }> = ({ lit }) => {
  const nodes = [
    { x: 300, y: 430, h: 110 },
    { x: 520, y: 360, h: 150 },
    { x: 760, y: 300, h: 190 },
    { x: 1000, y: 340, h: 140 },
    { x: 1240, y: 280, h: 170 },
    { x: 1480, y: 350, h: 130 },
    { x: 1680, y: 400, h: 100 },
  ];

  return (
    <svg
      width="100%"
      height="100%"
      viewBox="0 0 1920 1080"
      style={{ position: "absolute", inset: 0 }}
    >
      {nodes.map((n, i) => {
        const on = i < lit;
        return (
          <g key={i} opacity={on ? 1 : 0.12}>
            <rect
              x={n.x - 16}
              y={n.y}
              width="32"
              height={n.h}
              fill={palette.gold}
              opacity={0.35}
            />
            <polygon
              points={`${n.x},${n.y - 24} ${n.x - 30},${n.y + 6} ${n.x + 30},${n.y + 6}`}
              fill={palette.goldBright}
              opacity={0.7}
            />
            <circle
              cx={n.x}
              cy={n.y + n.h * 0.35}
              r="7"
              fill={palette.goldBright}
            />
          </g>
        );
      })}
      {nodes.slice(0, Math.max(lit - 1, 0)).map((n, i) => {
        const next = nodes[i + 1];
        if (!next) return null;
        return (
          <line
            key={`l-${i}`}
            x1={n.x}
            y1={n.y + 16}
            x2={next.x}
            y2={next.y + 16}
            stroke={palette.gold}
            strokeWidth="1.5"
            opacity="0.5"
          />
        );
      })}
    </svg>
  );
};
