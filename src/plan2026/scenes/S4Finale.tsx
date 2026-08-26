import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { GoldBead } from "../components/GoldBead";
import { Lotus } from "../components/Lotus";
import { Particles } from "../components/Particles";
import { serifFamily, titleFamily } from "../fonts";
import { breath, clamp } from "../motion";
import { copy, lampPosition, NINE_LAMPS, palette } from "../theme";

const CENTER = { x: 960, y: 430 };

/** 第四拍：九灯归一——光点收束成珠，绽为莲花，落版 */
export const S4Finale: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeIn = interpolate(frame, [0, 12], [0, 1], clamp);

  // 阶段一：九点收束
  const gather = interpolate(frame, [8, 112], [0, 1], {
    ...clamp,
    easing: Easing.inOut(Easing.cubic),
  });
  const pointsFade = interpolate(frame, [104, 126], [1, 0], clamp);

  // 过渡句
  const lineIn = interpolate(frame, [16, 48], [0, 1], clamp);
  const lineOut = interpolate(frame, [96, 126], [1, 0], clamp);

  // 阶段二：金珠成形
  const beadIn = interpolate(frame, [104, 146], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const beadOut = interpolate(frame, [196, 238], [1, 0], clamp);
  const flash = interpolate(frame, [104, 132, 172], [0, 1, 0.55], clamp);

  // 阶段三：绽莲
  const bloom = interpolate(frame, [156, 250], [0, 1], {
    ...clamp,
    easing: Easing.out(Easing.cubic),
  });
  const lotusGlow =
    interpolate(frame, [156, 220], [0, 1], clamp) * breath(frame, 120, 0.1);

  // 阶段四：落版
  const t = (s: number, d = 34) => interpolate(frame, [s, s + d], [0, 1], clamp);
  const brandIn = t(232);
  const enIn = t(258);
  const sloganIn = t(284);
  const yearIn = t(316);
  const footIn = t(344);

  return (
    <AbsoluteFill style={{ background: palette.black, opacity: fadeIn }}>
      <Particles count={24} opacity={0.75} seed="s4" />

      {/* 过渡句：灯，是会走路的。 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 170,
          textAlign: "center",
          fontFamily: serifFamily,
          fontWeight: 300,
          fontSize: 34,
          letterSpacing: "0.46em",
          paddingLeft: "0.46em",
          color: palette.cream,
          opacity: lineIn * lineOut * 0.95,
        }}
      >
        {copy.finaleLine}
      </div>

      {/* 九个光点收束 */}
      {NINE_LAMPS.map((_, i) => {
        const p = lampPosition(i);
        const x = interpolate(gather, [0, 1], [p.x, CENTER.x]);
        const y = interpolate(gather, [0, 1], [p.y, CENTER.y]);
        const glow = 0.75 + 0.25 * Math.sin((frame + i * 12) / 16);
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x,
              top: y,
              width: 26,
              height: 26,
              transform: "translate(-50%, -50%)",
              borderRadius: "50%",
              background: palette.flameHot,
              boxShadow: `0 0 34px 10px ${palette.flame}AA`,
              opacity: pointsFade * glow,
            }}
          />
        );
      })}

      {/* 汇聚闪光 */}
      <div
        style={{
          position: "absolute",
          left: CENTER.x,
          top: CENTER.y,
          width: 1150,
          height: 1150,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${palette.flameHot}40 0%, ${palette.flame}1C 34%, transparent 64%)`,
          opacity: flash,
        }}
      />

      {/* 金珠 */}
      <div
        style={{
          position: "absolute",
          left: CENTER.x,
          top: CENTER.y,
          transform: `translate(-50%, -50%) scale(${0.5 + 0.5 * beadIn})`,
          opacity: beadIn * beadOut,
        }}
      >
        <GoldBead size={170} lit={1} seed="finale-bead" />
      </div>

      {/* 莲花 */}
      <div
        style={{
          position: "absolute",
          left: CENTER.x,
          top: CENTER.y,
          transform: "translate(-50%, -50%)",
        }}
      >
        <Lotus size={280} bloom={bloom} glow={lotusGlow} />
      </div>

      {/* 落版 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 688,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: titleFamily,
            fontSize: 84,
            letterSpacing: "0.42em",
            paddingLeft: "0.42em",
            color: palette.cream,
            opacity: brandIn,
            textShadow: `0 0 44px ${palette.flame}5C`,
          }}
        >
          {copy.brand}
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: serifFamily,
            fontWeight: 300,
            fontStyle: "italic",
            fontSize: 27,
            letterSpacing: "0.34em",
            color: palette.gold,
            opacity: enIn * 0.92,
          }}
        >
          {copy.english}
        </div>
        <div
          style={{
            marginTop: 34,
            fontFamily: serifFamily,
            fontWeight: 400,
            fontSize: 36,
            letterSpacing: "0.5em",
            paddingLeft: "0.5em",
            color: palette.goldBright,
            opacity: sloganIn,
          }}
        >
          {copy.slogan}
        </div>
        <div
          style={{
            marginTop: 40,
            fontFamily: serifFamily,
            fontWeight: 600,
            fontSize: 25,
            letterSpacing: "0.4em",
            paddingLeft: "0.4em",
            color: palette.flame,
            opacity: yearIn,
          }}
        >
          {copy.yearMark}
        </div>
        <div
          style={{
            marginTop: 26,
            fontFamily: serifFamily,
            fontWeight: 300,
            fontSize: 20,
            letterSpacing: "0.36em",
            paddingLeft: "0.36em",
            color: palette.dim,
            opacity: footIn * 0.9,
          }}
        >
          {copy.footnote}
        </div>
      </div>
    </AbsoluteFill>
  );
};
