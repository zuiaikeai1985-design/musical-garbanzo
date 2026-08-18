import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { LogoMark } from "../components/Bead";
import { serifFamily, titleFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

export const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, SCENE.finale, 14, 28);
  const markIn = interpolate(frame, [10, 50], [0, 1], clamp);
  const lineIn = interpolate(frame, [40, 80], [0, 1], clamp);
  const footIn = interpolate(frame, [90, 140], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        opacity,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ opacity: markIn, marginBottom: 20 }}>
        <LogoMark size={140} />
      </div>
      <div
        style={{
          fontFamily: titleFamily,
          fontSize: 86,
          color: palette.cream,
          letterSpacing: 28,
          opacity: markIn,
        }}
      >
        {copy.brand}
      </div>
      <div
        style={{
          marginTop: 18,
          fontFamily: serifFamily,
          fontSize: 28,
          color: palette.gold,
          letterSpacing: 6,
          fontStyle: "italic",
          opacity: lineIn,
        }}
      >
        {copy.english}
      </div>
      <div
        style={{
          margin: "28px auto 0",
          width: 140,
          height: 1,
          background: palette.gold,
          opacity: lineIn,
        }}
      />
      <div
        style={{
          marginTop: 24,
          fontFamily: serifFamily,
          fontSize: 24,
          color: palette.cream,
          letterSpacing: 8,
          opacity: lineIn,
        }}
      >
        {copy.slogan}
      </div>
      <div
        style={{
          marginTop: 40,
          fontFamily: serifFamily,
          fontSize: 20,
          color: palette.gold,
          letterSpacing: 6,
          opacity: footIn,
        }}
      >
        {copy.lockup}
      </div>
    </AbsoluteFill>
  );
};
