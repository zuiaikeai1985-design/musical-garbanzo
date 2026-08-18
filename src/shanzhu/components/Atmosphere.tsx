import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { clamp } from "../motion";
import { palette } from "../theme";

export const InkGround: React.FC<{ accent: string }> = ({ accent }) => {
  return (
    <AbsoluteFill
      style={{
        backgroundColor: palette.ink,
        backgroundImage: `
          radial-gradient(ellipse 80% 60% at 50% 40%, ${accent}26 0%, transparent 55%),
          radial-gradient(ellipse 50% 40% at 20% 80%, ${palette.goldDeep}22 0%, transparent 50%),
          radial-gradient(ellipse 40% 50% at 85% 20%, ${palette.inkSoft} 0%, transparent 60%)
        `,
      }}
    />
  );
};

export const Vignette: React.FC = () => {
  return (
    <AbsoluteFill
      style={{
        background:
          "radial-gradient(ellipse at center, transparent 42%, rgba(0,0,0,0.55) 100%)",
        pointerEvents: "none",
      }}
    />
  );
};

export const FilmGrain: React.FC = () => {
  const frame = useCurrentFrame();
  const shift = (frame % 8) * 3;

  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.16 }}>
      <svg width="100%" height="100%">
        <filter id="shanzhu-grain">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.85"
            numOctaves="3"
            seed={shift}
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#shanzhu-grain)" />
      </svg>
    </AbsoluteFill>
  );
};

export const GoldDust: React.FC<{ count?: number }> = ({ count = 36 }) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }).map((_, i) => {
        const seed = i * 97;
        const x = (seed * 13) % 1920;
        const yBase = (seed * 29) % 1080;
        const drift = interpolate(frame % 180, [0, 180], [0, 40], clamp);
        const opacity = 0.15 + ((i * 7) % 20) / 100;
        const size = 1.5 + (i % 4);

        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: (yBase + drift + i * 3) % 1080,
              width: size,
              height: size,
              borderRadius: "50%",
              background: i % 3 === 0 ? palette.goldBright : palette.gold,
              opacity,
              boxShadow: `0 0 8px ${palette.gold}`,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
