import React from "react";
import { palette } from "../theme";

export const BrotherSilhouettes: React.FC<{
  count?: number;
  scale?: number;
}> = ({ count = 3, scale = 1 }) => {
  const figures = Array.from({ length: count }).map((_, i) => {
    const x = i * 70 - ((count - 1) * 70) / 2;
    const h = 140 + (i % 2) * 16;
    return { x, h, staff: i === Math.floor(count / 2) };
  });

  return (
    <svg
      width={520 * scale}
      height={220 * scale}
      viewBox="-220 -20 440 240"
      style={{ overflow: "visible" }}
    >
      {figures.map((f, i) => (
        <g key={i} transform={`translate(${f.x}, 0)`}>
          <circle cx="0" cy="18" r="14" fill="#02080c" />
          <path
            d={`M0 32 C-28 48 -34 90 -30 ${f.h} L30 ${f.h} C34 90 28 48 0 32 Z`}
            fill="#02080c"
          />
          {f.staff ? (
            <line
              x1="22"
              y1="40"
              x2="38"
              y2={f.h + 10}
              stroke={palette.gold}
              strokeWidth="2"
              opacity="0.65"
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
          <stop offset="100%" stopColor={palette.gold} stopOpacity="0.2" />
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
        filter="drop-shadow(0 0 12px rgba(240,197,106,0.65))"
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
    { x: 320, y: 420, h: 120 },
    { x: 560, y: 360, h: 160 },
    { x: 820, y: 300, h: 200 },
    { x: 1080, y: 340, h: 150 },
    { x: 1320, y: 280, h: 180 },
    { x: 1580, y: 360, h: 140 },
    { x: 960, y: 480, h: 90 },
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
          <g key={i} opacity={on ? 1 : 0.15}>
            <rect
              x={n.x - 18}
              y={n.y}
              width="36"
              height={n.h}
              fill={palette.gold}
              opacity={0.35}
            />
            <polygon
              points={`${n.x},${n.y - 28} ${n.x - 34},${n.y + 8} ${n.x + 34},${n.y + 8}`}
              fill={palette.goldBright}
              opacity={0.7}
            />
            <circle
              cx={n.x}
              cy={n.y + n.h * 0.35}
              r="8"
              fill={palette.goldBright}
              opacity={on ? 1 : 0.2}
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
            y1={n.y + 20}
            x2={next.x}
            y2={next.y + 20}
            stroke={palette.gold}
            strokeWidth="1.5"
            opacity="0.55"
          />
        );
      })}
    </svg>
  );
};

export const HandsCradle: React.FC = () => {
  return (
    <svg width={520} height={360} viewBox="0 0 520 360">
      <path
        d="M70 220 C110 150 180 130 240 180 C260 120 340 110 390 170 C430 210 450 260 420 300 C360 340 250 350 180 330 C120 310 70 270 70 220 Z"
        fill="none"
        stroke={palette.gold}
        strokeWidth="3"
      />
      <path
        d="M120 250 C160 210 210 200 250 230 C280 200 340 205 370 245"
        fill="none"
        stroke={palette.goldBright}
        strokeWidth="2"
        opacity="0.7"
      />
    </svg>
  );
};
