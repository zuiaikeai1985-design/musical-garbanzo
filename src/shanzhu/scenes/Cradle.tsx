import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Bead } from "../components/Bead";
import { HandsCradle } from "../components/Motifs";
import { serifFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

export const Cradle: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, SCENE.cradle, 14, 16);
  const rise = interpolate(frame, [8, 50], [24, 0], clamp);
  const textIn = interpolate(frame, [40, 90], [0, 1], clamp);
  const glow = interpolate(frame, [0, 80], [0.3, 0.85], clamp);

  return (
    <AbsoluteFill
      style={{
        opacity,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          position: "relative",
          transform: `translateY(${rise}px)`,
          width: 520,
          height: 360,
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "38%",
            transform: "translate(-50%, -50%)",
            opacity: glow,
          }}
        >
          <Bead size={72} glow={glow} />
        </div>
        <HandsCradle />
      </div>
      <div
        style={{
          marginTop: 8,
          fontFamily: serifFamily,
          fontWeight: 300,
          fontSize: 34,
          color: palette.cream,
          letterSpacing: 8,
          opacity: textIn,
        }}
      >
        {copy.cradle}
      </div>
    </AbsoluteFill>
  );
};
