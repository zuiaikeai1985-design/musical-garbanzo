import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TempleLights } from "../components/Motifs";
import { serifFamily, titleFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

export const Temples: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, SCENE.temples, 16, 18);
  const lit = Math.floor(
    interpolate(frame, [10, SCENE.temples - 30], [1, 7], clamp),
  );
  const titleIn = interpolate(frame, [40, 90], [0, 1], clamp);
  const subIn = interpolate(frame, [80, 130], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <TempleLights lit={lit} />
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 150,
          textAlign: "center",
          opacity: titleIn,
        }}
      >
        <div
          style={{
            fontFamily: titleFamily,
            fontSize: 72,
            color: palette.cream,
            letterSpacing: 24,
          }}
        >
          {copy.pilgrimage}
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: serifFamily,
            fontSize: 26,
            color: palette.gold,
            letterSpacing: 10,
            opacity: subIn,
          }}
        >
          {copy.shousui}
        </div>
      </div>
    </AbsoluteFill>
  );
};
