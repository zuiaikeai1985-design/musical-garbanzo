import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BeadTrail } from "../components/BeadTrail";
import { Motif } from "../components/Motifs";
import { brushFamily, serifFamily, titleFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import {
  elementColor,
  Lifetime as LifetimeType,
  palette,
  SCENE,
} from "../theme";

export const Lifetime: React.FC<{ life: LifetimeType }> = ({ life }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const color = elementColor[life.element];
  const opacity = fadeWindow(frame, SCENE.lifetime, 14, 16);
  const ken = interpolate(frame, [0, SCENE.lifetime], [1, 1.06], clamp);
  const numeralX = interpolate(frame, [6, 40], [-40, 0], clamp);
  const textY = interpolate(frame, [16, 48], [20, 0], clamp);
  const textIn = interpolate(frame, [18, 46], [0, 1], clamp);
  const lineIn = interpolate(frame, [36, 70], [0, 1], clamp);
  const motifIn = interpolate(frame, [10, 42], [0, 1], clamp);
  const breathe = 1 + Math.sin(frame / (fps * 1.4)) * 0.02;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          right: 80,
          top: 40,
          fontFamily: brushFamily,
          fontSize: 320,
          color: color,
          opacity: 0.12,
          transform: `translateX(${numeralX}px)`,
          lineHeight: 1,
        }}
      >
        {life.numeral}
      </div>
      <div
        style={{
          position: "absolute",
          left: 120,
          top: 210,
          opacity: motifIn,
          transform: `scale(${ken * breathe})`,
          transformOrigin: "center",
        }}
      >
        <Motif id={life.motif} color={color} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 620,
          top: 250,
          width: 1080,
          opacity: textIn,
          transform: `translateY(${textY}px)`,
        }}
      >
        <div
          style={{
            fontFamily: serifFamily,
            fontSize: 24,
            color: palette.gold,
            letterSpacing: 10,
          }}
        >
          {life.era}
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: titleFamily,
            fontSize: 96,
            color: palette.paper,
            letterSpacing: 20,
          }}
        >
          {life.title}
        </div>
        <div
          style={{
            marginTop: 28,
            width: 120,
            height: 1,
            background: palette.gold,
            opacity: 0.7,
          }}
        />
        <div
          style={{
            marginTop: 32,
            fontFamily: serifFamily,
            fontWeight: 300,
            fontSize: 30,
            lineHeight: 1.8,
            color: palette.paper,
            maxWidth: 860,
            opacity: lineIn,
          }}
        >
          {life.line}
        </div>
      </div>
      <BeadTrail active={life.id - 1} />
    </AbsoluteFill>
  );
};
