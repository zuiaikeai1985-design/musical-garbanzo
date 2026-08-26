import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Lotus } from "../components/Lotus";
import { Particles } from "../components/Particles";
import { serifFamily, titleFamily } from "../fonts";
import { breath, clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

/** 第一拍：黑场，一粒光醒来，标版浮现 */
export const S1Awaken: React.FC = () => {
  const frame = useCurrentFrame();
  const sceneOpacity = fadeWindow(frame, SCENE.awaken, 12, 24);

  const spark = interpolate(frame, [10, 70], [0, 1], clamp);
  const bloomIn = interpolate(frame, [55, 160], [0, 0.52], clamp);
  const glow = spark * breath(frame);

  const brandIn = interpolate(frame, [130, 175], [0, 1], clamp);
  const brandRise = interpolate(frame, [130, 175], [26, 0], clamp);
  const enIn = interpolate(frame, [165, 205], [0, 1], clamp);
  const tagIn = interpolate(frame, [215, 255], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ background: palette.black, opacity: sceneOpacity }}>
      <Particles count={18} opacity={spark * 0.7} seed="s1" />

      {/* 中央光核 + 莲 */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 440,
          transform: "translate(-50%, -50%)",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: "50%",
            top: "50%",
            width: 900,
            height: 900,
            transform: "translate(-50%, -50%)",
            background: `radial-gradient(circle, ${palette.flame}33 0%, ${palette.ember}18 38%, transparent 68%)`,
            opacity: glow,
          }}
        />
        <Lotus size={300} bloom={bloomIn} glow={glow} />
      </div>

      {/* 品牌锁定 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 700,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: titleFamily,
            fontSize: 92,
            letterSpacing: "0.42em",
            paddingLeft: "0.42em",
            color: palette.cream,
            opacity: brandIn,
            transform: `translateY(${brandRise}px)`,
            textShadow: `0 0 46px ${palette.flame}66`,
          }}
        >
          {copy.brand}
        </div>
        <div
          style={{
            marginTop: 22,
            fontFamily: serifFamily,
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: 30,
            letterSpacing: "0.34em",
            color: palette.gold,
            opacity: enIn * 0.92,
          }}
        >
          {copy.english}
        </div>
        <div
          style={{
            marginTop: 46,
            fontFamily: serifFamily,
            fontWeight: 300,
            fontSize: 25,
            letterSpacing: "0.5em",
            paddingLeft: "0.5em",
            color: palette.dim,
            opacity: tagIn,
          }}
        >
          {copy.yearTag}
        </div>
      </div>
    </AbsoluteFill>
  );
};
