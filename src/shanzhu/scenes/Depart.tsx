import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
} from "remotion";
import { BrotherSilhouettes } from "../components/Motifs";
import { serifFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

export const Depart: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, SCENE.depart, 14, 16);
  const walk = interpolate(frame, [0, SCENE.depart], [40, -20], clamp);
  const textIn = interpolate(frame, [40, 90], [0, 1], clamp);
  const glow = interpolate(frame, [0, 100], [0.2, 0.7], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          right: "18%",
          top: "28%",
          width: 420,
          height: 420,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${palette.goldBright}55 0%, transparent 68%)`,
          opacity: glow,
          filter: "blur(8px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 180,
          transform: `translateX(calc(-50% + ${walk}px))`,
        }}
      >
        <BrotherSilhouettes count={3} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 96,
          textAlign: "center",
          fontFamily: serifFamily,
          fontWeight: 300,
          fontSize: 34,
          color: palette.cream,
          letterSpacing: 6,
          opacity: textIn,
        }}
      >
        {copy.ask}
      </div>
    </AbsoluteFill>
  );
};
