import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Bead } from "../components/Bead";
import { brushFamily, serifFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { elementColor, LIFETIMES, palette, SCENE } from "../theme";

export const Fate: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = fadeWindow(frame, SCENE.fate, 18, 20);
  const radius = interpolate(frame, [0, 70], [40, 250], clamp);
  const spin = interpolate(frame, [0, SCENE.fate], [0, 28], clamp);
  const yuanIn = interpolate(frame, [50, 100], [0, 1], clamp);
  const lineIn = interpolate(frame, [110, 160], [0, 1], clamp);
  const secondIn = interpolate(frame, [190, 230], [0, 1], clamp);
  const pulse = 1 + Math.sin(frame / (fps * 1.2)) * 0.03;

  return (
    <AbsoluteFill style={{ opacity }}>
      {LIFETIMES.map((life, index) => {
        const angle = ((index / LIFETIMES.length) * 360 + spin) * (Math.PI / 180);
        const x = Math.cos(angle) * radius;
        const y = Math.sin(angle) * radius * 0.72;
        return (
          <div
            key={life.id}
            style={{
              position: "absolute",
              left: "50%",
              top: "46%",
              transform: `translate(${x}px, ${y}px) translate(-50%, -50%)`,
            }}
          >
            <Bead size={34} color={elementColor[life.element]} glow={0.65} />
          </div>
        );
      })}
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "44%",
          transform: `translate(-50%, -50%) scale(${pulse})`,
          opacity: yuanIn,
          fontFamily: brushFamily,
          fontSize: 220,
          color: "transparent",
          WebkitTextStroke: `2px ${palette.gold}`,
          letterSpacing: 8,
        }}
      >
        缘
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 168,
          textAlign: "center",
          fontFamily: serifFamily,
          fontWeight: 300,
          fontSize: 32,
          color: palette.paper,
          letterSpacing: 6,
          opacity: lineIn,
        }}
      >
        缘不是偶然。是九世里，每一次回头。
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 112,
          textAlign: "center",
          fontFamily: serifFamily,
          fontSize: 22,
          color: palette.gold,
          letterSpacing: 8,
          opacity: secondIn,
        }}
      >
        百善孝为先 · 母爱福泽三代
      </div>
    </AbsoluteFill>
  );
};
