import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Bead } from "../components/Bead";
import { serifFamily, titleFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { palette, SCENE } from "../theme";

export const Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, SCENE.finale, 16, 28);
  const rise = interpolate(frame, [8, 50], [24, 0], clamp);
  const markIn = interpolate(frame, [20, 60], [0, 1], clamp);
  const lineIn = interpolate(frame, [50, 90], [0, 1], clamp);
  const footIn = interpolate(frame, [90, 130], [0, 1], clamp);

  return (
    <AbsoluteFill
      style={{
        opacity,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ opacity: markIn, marginBottom: 36 }}>
        <Bead size={72} />
      </div>
      <div
        style={{
          transform: `translateY(${rise}px)`,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: titleFamily,
            fontSize: 92,
            color: palette.paper,
            letterSpacing: 24,
            opacity: markIn,
          }}
        >
          九世善珠
        </div>
        <div
          style={{
            margin: "28px auto 0",
            width: 160,
            height: 1,
            background: palette.gold,
            opacity: lineIn,
          }}
        />
        <div
          style={{
            marginTop: 28,
            fontFamily: serifFamily,
            fontSize: 30,
            color: palette.gold,
            letterSpacing: 12,
            opacity: lineIn,
          }}
        >
          百善孝为先
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: serifFamily,
            fontWeight: 300,
            fontSize: 26,
            color: palette.paper,
            letterSpacing: 8,
            opacity: lineIn,
          }}
        >
          一生一枚 · 守护母亲
        </div>
        <div
          style={{
            marginTop: 48,
            fontFamily: serifFamily,
            fontSize: 18,
            color: palette.gold,
            letterSpacing: 6,
            opacity: footIn,
          }}
        >
          99感恩母亲日 · 每月九日祈福
        </div>
      </div>
    </AbsoluteFill>
  );
};
