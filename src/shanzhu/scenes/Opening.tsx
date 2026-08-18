import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Bead } from "../components/Bead";
import { brushFamily, serifFamily, titleFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { palette, SCENE } from "../theme";

export const Opening: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = fadeWindow(frame, SCENE.opening, 16, 22);
  const beadY = interpolate(frame, [12, 78], [-220, 0], clamp);
  const beadScale = interpolate(frame, [12, 90], [0.55, 1], clamp);
  const titleOpacity = interpolate(frame, [72, 110], [0, 1], clamp);
  const titleY = interpolate(frame, [72, 120], [24, 0], clamp);
  const subOpacity = interpolate(frame, [118, 156], [0, 1], clamp);
  const voOpacity = interpolate(frame, [150, 188], [0, 1], clamp);
  const glow = interpolate(frame, [0, 80], [0.15, 0.7], clamp);
  const pulse = 1 + Math.sin(frame / fps) * 0.015;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "38%",
          width: 720,
          height: 720,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${palette.gold}33 0%, transparent 62%)`,
          opacity: glow,
        }}
      />
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 140,
          writingMode: "vertical-rl",
          fontFamily: brushFamily,
          fontSize: 42,
          letterSpacing: 18,
          color: palette.gold,
          opacity: titleOpacity * 0.8,
        }}
      >
        一念为善
      </div>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingTop: 20,
        }}
      >
        <div
          style={{
            transform: `translateY(${beadY}px) scale(${beadScale * pulse})`,
          }}
        >
          <Bead size={168} glow={glow} />
        </div>
        <div
          style={{
            marginTop: 48,
            opacity: titleOpacity,
            transform: `translateY(${titleY}px)`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: titleFamily,
              fontSize: 108,
              color: palette.paper,
              letterSpacing: 28,
            }}
          >
            九世一念
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: serifFamily,
              fontSize: 28,
              color: palette.gold,
              letterSpacing: 14,
              opacity: subOpacity,
            }}
          >
            一珠为念 · 九世为善
          </div>
          <div
            style={{
              marginTop: 28,
              fontFamily: serifFamily,
              fontWeight: 300,
              fontSize: 24,
              color: palette.paper,
              letterSpacing: 6,
              opacity: voOpacity,
            }}
          >
            一颗善珠，穿越九世，始终落回母亲掌心
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
