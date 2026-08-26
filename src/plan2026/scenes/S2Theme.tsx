import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { Particles } from "../components/Particles";
import { brushFamily, serifFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

/** 第二拍：主题揭示——从「守爱」到「传灯」 */
export const S2Theme: React.FC = () => {
  const frame = useCurrentFrame();
  const sceneOpacity = fadeWindow(frame, SCENE.theme, 14, 22);

  // 2025 · 守爱：浮现后让位
  const lastIn = interpolate(frame, [8, 44], [0, 1], clamp);
  const lastOut = interpolate(frame, [72, 112], [1, 0], clamp);
  const lastRise = interpolate(frame, [72, 112], [0, -54], clamp);

  // 传灯：两个书法大字逐字亮起
  const charIn = (i: number) => {
    const s = 100 + i * 26;
    return {
      o: interpolate(frame, [s, s + 34], [0, 1], clamp),
      scale: interpolate(frame, [s, s + 34], [1.14, 1], clamp),
    };
  };

  const subIn = interpolate(frame, [186, 226], [0, 1], clamp);
  const enIn = interpolate(frame, [216, 252], [0, 1], clamp);

  const glowPulse =
    0.75 + 0.25 * Math.sin((Math.max(frame - 160, 0) / 80) * Math.PI * 2);

  return (
    <AbsoluteFill style={{ background: palette.black, opacity: sceneOpacity }}>
      <Particles count={22} opacity={0.8} seed="s2" />

      {/* 背景暖光 */}
      <div
        style={{
          position: "absolute",
          left: 960,
          top: 480,
          width: 1250,
          height: 1250,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${palette.flame}22 0%, transparent 62%)`,
        }}
      />

      {/* 去年主题 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 330,
          textAlign: "center",
          fontFamily: serifFamily,
          fontWeight: 300,
          fontSize: 34,
          letterSpacing: "0.5em",
          paddingLeft: "0.5em",
          color: palette.dim,
          opacity: lastIn * lastOut,
          transform: `translateY(${lastRise}px)`,
        }}
      >
        {copy.lastYear}
      </div>

      {/* 传灯 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 372,
          display: "flex",
          justifyContent: "center",
          gap: 66,
        }}
      >
        {copy.themeWord.split("").map((ch, i) => {
          const a = charIn(i);
          return (
            <div
              key={i}
              style={{
                fontFamily: brushFamily,
                fontSize: 300,
                lineHeight: 1,
                color: palette.goldBright,
                opacity: a.o,
                transform: `scale(${a.scale})`,
                textShadow: `0 0 80px ${palette.flame}${Math.round(
                  glowPulse * 153,
                )
                  .toString(16)
                  .padStart(2, "0")}, 0 0 28px ${palette.flameHot}77`,
              }}
            >
              {ch}
            </div>
          );
        })}
      </div>

      {/* 副题与英文 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 762,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: serifFamily,
            fontWeight: 400,
            fontSize: 42,
            letterSpacing: "0.34em",
            paddingLeft: "0.34em",
            color: palette.cream,
            opacity: subIn,
          }}
        >
          {copy.themeSub}
        </div>
        <div
          style={{
            marginTop: 30,
            fontFamily: serifFamily,
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: 26,
            letterSpacing: "0.3em",
            color: palette.gold,
            opacity: enIn * 0.85,
          }}
        >
          {copy.themeEn}
        </div>
      </div>
    </AbsoluteFill>
  );
};
