import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp } from "../motion";
import { palette } from "../theme";

export const MistGround: React.FC = () => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame % 360, [0, 360], [0, 40], clamp);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.void,
        backgroundImage: `
          radial-gradient(ellipse 90% 70% at 50% ${42 + drift * 0.05}%, ${palette.mist}cc 0%, transparent 58%),
          radial-gradient(ellipse 60% 40% at 15% 85%, ${palette.teal}88 0%, transparent 55%),
          radial-gradient(ellipse 50% 45% at 88% 20%, ${palette.goldDeep}33 0%, transparent 50%),
          linear-gradient(180deg, #030a10 0%, ${palette.void} 45%, #0a1c24 100%)
        `,
      }}
    />
  );
};

export const MountainSilhouette: React.FC<{ opacity?: number }> = ({
  opacity = 0.55,
}) => {
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        preserveAspectRatio="xMidYMid slice"
      >
        <path
          d="M0 780 L180 620 L320 700 L520 480 L720 640 L900 420 L1120 610 L1280 500 L1480 640 L1680 520 L1920 680 L1920 1080 L0 1080 Z"
          fill="#04141c"
        />
        <path
          d="M0 860 L220 740 L420 820 L640 680 L860 780 L1080 650 L1320 760 L1540 700 L1760 780 L1920 720 L1920 1080 L0 1080 Z"
          fill="#061820"
          opacity="0.9"
        />
      </svg>
    </AbsoluteFill>
  );
};

export const GoldDust: React.FC<{ count?: number }> = ({ count = 42 }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const seed = i * 97;
        const x = (seed * 13) % 1920;
        const yBase = (seed * 29) % 1080;
        const drift = interpolate(frame % 200, [0, 200], [0, 36], clamp);
        const opacity = 0.12 + ((i * 7) % 18) / 100;
        const size = 1.2 + (i % 4) * 0.6;

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: (yBase + drift + i * 2) % 1080,
              width: size,
              height: size,
              borderRadius: "50%",
              background: i % 3 === 0 ? palette.goldBright : palette.gold,
              opacity,
              boxShadow: `0 0 6px ${palette.gold}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

export const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      background:
        "radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.62) 100%)",
      pointerEvents: "none",
    }}
  />
);

export const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = (frame % 8) * 3;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.12 }}>
      <svg width="100%" height="100%">
        <filter id="shouai-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.8"
            numOctaves="3"
            seed={shift}
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#shouai-grain)" />
      </svg>
    </AbsoluteFill>
  );
};
