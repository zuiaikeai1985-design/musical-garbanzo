import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { Lotus } from "../components/Bead";
import { brushFamily, serifFamily, titleFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

export const LotusAwaken: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = fadeWindow(frame, SCENE.lotus, 14, 18);
  const open = interpolate(frame, [10, 90], [0.15, 1], clamp);
  const titleIn = interpolate(frame, [70, 110], [0, 1], clamp);
  const titleY = interpolate(frame, [70, 120], [20, 0], clamp);
  const verticalIn = interpolate(frame, [40, 80], [0, 1], clamp);
  const pulse = 1 + Math.sin(frame / (fps * 1.3)) * 0.02;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: 96,
          top: 160,
          writingMode: "vertical-rl",
          fontFamily: brushFamily,
          fontSize: 40,
          letterSpacing: 16,
          color: palette.gold,
          opacity: verticalIn * 0.9,
        }}
      >
        {copy.vertical}
      </div>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
          paddingBottom: 40,
        }}
      >
        <div style={{ transform: `scale(${pulse})` }}>
          <Lotus size={460} open={open} />
        </div>
        <div
          style={{
            marginTop: 28,
            opacity: titleIn,
            transform: `translateY(${titleY}px)`,
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontFamily: titleFamily,
              fontSize: 108,
              color: palette.cream,
              letterSpacing: 36,
            }}
          >
            {copy.filmTitle}
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: serifFamily,
              fontSize: 26,
              color: palette.gold,
              letterSpacing: 8,
              fontStyle: "italic",
            }}
          >
            {copy.english}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
