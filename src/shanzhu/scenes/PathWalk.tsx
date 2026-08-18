import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BrotherSilhouettes, LightPath } from "../components/Motifs";
import { serifFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

export const PathWalk: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, SCENE.path, 16, 18);
  const progress = interpolate(frame, [0, SCENE.path - 20], [0.05, 1], clamp);
  const textIn = interpolate(frame, [60, 110], [0, 1], clamp);
  const groupX = interpolate(frame, [0, SCENE.path], [-80, 220], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <LightPath progress={progress} />
      <div
        style={{
          position: "absolute",
          left: `calc(28% + ${groupX}px)`,
          bottom: 200,
          transform: "scale(0.85)",
        }}
      >
        <BrotherSilhouettes count={5} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 100,
          textAlign: "center",
          fontFamily: serifFamily,
          fontWeight: 300,
          fontSize: 36,
          color: palette.cream,
          letterSpacing: 8,
          opacity: textIn,
        }}
      >
        {copy.walk}
      </div>
    </AbsoluteFill>
  );
};
