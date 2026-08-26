import React from "react";
import { AbsoluteFill, Easing, interpolate, useCurrentFrame } from "remotion";
import { GoldBead } from "../components/GoldBead";
import { Particles } from "../components/Particles";
import { brushFamily, serifFamily, titleFamily } from "../fonts";
import { breath, clamp, fadeWindow } from "../motion";
import { copy, lampPosition, NINE_LAMPS, palette, SCENE } from "../theme";

const LAMP_START = 46;
const LAMP_GAP = 70;

/** 第三拍：九盏灯沿珠链弧线次第点亮 */
export const S3NineLamps: React.FC = () => {
  const frame = useCurrentFrame();
  const sceneOpacity = fadeWindow(frame, SCENE.lamps, 14, 20);

  const titleIn = interpolate(frame, [6, 40], [0, 1], clamp);
  const chainIn = interpolate(frame, [20, 70], [0, 0.2], clamp);
  const outroIn = interpolate(frame, [660, 700], [0, 1], clamp);

  const points = NINE_LAMPS.map((_, i) => lampPosition(i));
  const chainPath = points
    .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`)
    .join(" ");

  return (
    <AbsoluteFill style={{ background: palette.black, opacity: sceneOpacity }}>
      <Particles count={20} opacity={0.7} seed="s3" />

      {/* 章节标题 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 108,
          textAlign: "center",
          opacity: titleIn,
        }}
      >
        <div
          style={{
            fontFamily: titleFamily,
            fontSize: 74,
            letterSpacing: "0.5em",
            paddingLeft: "0.5em",
            color: palette.goldBright,
            textShadow: `0 0 40px ${palette.flame}55`,
          }}
        >
          {copy.lampsTitle}
        </div>
        <div
          style={{
            marginTop: 18,
            fontFamily: serifFamily,
            fontWeight: 300,
            fontSize: 26,
            letterSpacing: "0.44em",
            paddingLeft: "0.44em",
            color: palette.dim,
          }}
        >
          {copy.lampsSub}
        </div>
      </div>

      {/* 暗金珠绳 */}
      <svg
        width="100%"
        height="100%"
        viewBox="0 0 1920 1080"
        style={{ position: "absolute", inset: 0 }}
      >
        <path
          d={chainPath}
          fill="none"
          stroke={palette.gold}
          strokeWidth={2}
          strokeDasharray="1 10"
          strokeLinecap="round"
          opacity={chainIn}
        />
      </svg>

      {/* 九盏灯 */}
      {NINE_LAMPS.map((lamp, i) => {
        const start = LAMP_START + i * LAMP_GAP;
        const lit = interpolate(frame, [start, start + 36], [0, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        });
        const pool = interpolate(frame, [start, start + 44], [0.3, 1], {
          ...clamp,
          easing: Easing.out(Easing.cubic),
        });
        const textIn = interpolate(frame, [start + 16, start + 48], [0, 1], clamp);
        const textRise = interpolate(
          frame,
          [start + 16, start + 48],
          [16, 0],
          clamp,
        );
        const live = lit * breath(frame - start, 110, 0.14);
        const { x, y } = lampPosition(i);

        return (
          <div key={lamp.name}>
            {/* 光池 */}
            <div
              style={{
                position: "absolute",
                left: x,
                top: y,
                width: 260,
                height: 260,
                transform: `translate(-50%, -50%) scale(${pool})`,
                background: `radial-gradient(circle, ${palette.flame}59 0%, ${palette.flame}1E 42%, transparent 70%)`,
                opacity: live,
              }}
            />
            {/* 珠 */}
            <div
              style={{
                position: "absolute",
                left: x,
                top: y,
                transform: `translate(-50%, -50%)`,
              }}
            >
              <GoldBead size={52} lit={live} seed={`lamp-${i}`} />
            </div>
            {/* 灯名 */}
            <div
              style={{
                position: "absolute",
                left: x,
                top: y - 128,
                transform: `translate(-50%, ${textRise}px)`,
                fontFamily: brushFamily,
                fontSize: 64,
                whiteSpace: "nowrap",
                color: palette.goldBright,
                opacity: textIn,
                textShadow: `0 0 30px ${palette.flame}66`,
              }}
            >
              {lamp.name}
            </div>
            {/* 节点 · 日期 */}
            <div
              style={{
                position: "absolute",
                left: x,
                top: y + 66,
                transform: `translate(-50%, ${textRise}px)`,
                textAlign: "center",
                fontFamily: serifFamily,
                fontWeight: 300,
                whiteSpace: "nowrap",
                opacity: textIn,
              }}
            >
              <div
                style={{
                  fontSize: 30,
                  letterSpacing: "0.28em",
                  paddingLeft: "0.28em",
                  color: palette.cream,
                }}
              >
                {lamp.node}
              </div>
              <div
                style={{
                  marginTop: 8,
                  fontSize: 22,
                  letterSpacing: "0.2em",
                  color: palette.dim,
                }}
              >
                {lamp.date}
              </div>
            </div>
          </div>
        );
      })}

      {/* 收束句 */}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 952,
          textAlign: "center",
          fontFamily: serifFamily,
          fontWeight: 300,
          fontSize: 26,
          letterSpacing: "0.5em",
          paddingLeft: "0.5em",
          color: palette.gold,
          opacity: outroIn * 0.9,
        }}
      >
        九盏灯，次第点亮二〇二六
      </div>
    </AbsoluteFill>
  );
};
