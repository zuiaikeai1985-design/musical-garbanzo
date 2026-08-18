import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { FilmGrain, GoldDust, InkGround, Vignette } from "./components/Atmosphere";
import { Finale } from "./scenes/Finale";
import { Fate } from "./scenes/Fate";
import { Lifetime } from "./scenes/Lifetime";
import { Opening } from "./scenes/Opening";
import {
  FATE_START,
  FINALE_START,
  LIFETIMES,
  lifetimeStart,
  palette,
  SCENE,
} from "./theme";

export const JiushiShanzhu: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: palette.ink }}>
      <InkGround accent={palette.gold} />
      <GoldDust />
      <Sequence durationInFrames={SCENE.opening} name="Opening">
        <Opening />
      </Sequence>
      {LIFETIMES.map((life, index) => (
        <Sequence
          key={life.id}
          from={lifetimeStart(index)}
          durationInFrames={SCENE.lifetime}
          name={`Lifetime-${life.id}-${life.title}`}
        >
          <Lifetime life={life} />
        </Sequence>
      ))}
      <Sequence from={FATE_START} durationInFrames={SCENE.fate} name="Fate">
        <Fate />
      </Sequence>
      <Sequence from={FINALE_START} durationInFrames={SCENE.finale} name="Finale">
        <Finale />
      </Sequence>
      <Vignette />
      <FilmGrain />
    </AbsoluteFill>
  );
};
