import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { S1Awaken } from "./scenes/S1Awaken";
import { S2Theme } from "./scenes/S2Theme";
import { S3NineLamps } from "./scenes/S3NineLamps";
import { S4Finale } from "./scenes/S4Finale";
import { palette, SCENE, START } from "./theme";

/**
 * 《传灯》——九世善珠 2026 年度策划概念动板
 * 标版醒来 → 守爱→传灯 → 九灯次第点亮 → 九灯归一落版
 */
export const ChuanDeng2026: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: palette.black }}>
      <Sequence from={START.awaken} durationInFrames={SCENE.awaken} name="1-标版醒来">
        <S1Awaken />
      </Sequence>
      <Sequence from={START.theme} durationInFrames={SCENE.theme} name="2-守爱到传灯">
        <S2Theme />
      </Sequence>
      <Sequence from={START.lamps} durationInFrames={SCENE.lamps} name="3-九灯点亮">
        <S3NineLamps />
      </Sequence>
      <Sequence from={START.finale} durationInFrames={SCENE.finale} name="4-九灯归一">
        <S4Finale />
      </Sequence>
    </AbsoluteFill>
  );
};
