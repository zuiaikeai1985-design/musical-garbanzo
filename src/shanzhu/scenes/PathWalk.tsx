import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BrotherSilhouettes, LightPath, TempleLights } from "../components/Motifs";
import { serifFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

/** Act 3 — 遇到更多人：队伍拉长，百寺点亮 */
export const MorePeople: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, SCENE.many, 16, 20);
  const progress = interpolate(frame, [0, SCENE.many - 40], [0.08, 1], clamp);
  const count = Math.min(
    11,
    Math.floor(interpolate(frame, [0, 160], [5, 11], clamp)),
  );
  const lit = Math.floor(
    interpolate(frame, [80, SCENE.many - 50], [0, 7], clamp),
  );
  const groupX = interpolate(frame, [0, SCENE.many], [-60, 180], clamp);
  const lineIn = interpolate(frame, [50, 100], [0, 1], clamp);
  const subIn = interpolate(frame, [120, 170], [0, 1], clamp);
  const templesIn = interpolate(frame, [100, 160], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <LightPath progress={progress} />
      <div style={{ opacity: templesIn }}>
        <TempleLights lit={lit} />
      </div>
      <div
        style={{
          position: "absolute",
          left: `calc(26% + ${groupX}px)`,
          bottom: 190,
          transform: "scale(0.92)",
        }}
      >
        <BrotherSilhouettes count={count} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 96,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: serifFamily,
            fontWeight: 300,
            fontSize: 36,
            color: palette.cream,
            letterSpacing: 8,
            opacity: lineIn,
          }}
        >
          {copy.manyLine}
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: serifFamily,
            fontSize: 22,
            color: palette.gold,
            letterSpacing: 8,
            opacity: subIn,
          }}
        >
          {copy.manySub}
        </div>
      </div>
    </AbsoluteFill>
  );
};
