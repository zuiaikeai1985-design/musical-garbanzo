import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  FilmGrain,
  GoldDust,
  MistGround,
  MountainSilhouette,
  Vignette,
} from "./components/Atmosphere";
import { Cradle } from "./scenes/Cradle";
import { Depart } from "./scenes/Depart";
import { Finale } from "./scenes/Finale";
import { LotusAwaken } from "./scenes/Opening";
import { PathWalk } from "./scenes/PathWalk";
import { Temples } from "./scenes/Temples";
import { palette, SCENE, START } from "./theme";

export const JiushiShanzhu: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: palette.void }}>
      <MistGround />
      <MountainSilhouette />
      <GoldDust />
      <Sequence from={START.lotus} durationInFrames={SCENE.lotus} name="Lotus">
        <LotusAwaken />
      </Sequence>
      <Sequence from={START.depart} durationInFrames={SCENE.depart} name="Depart">
        <Depart />
      </Sequence>
      <Sequence from={START.path} durationInFrames={SCENE.path} name="Path">
        <PathWalk />
      </Sequence>
      <Sequence
        from={START.temples}
        durationInFrames={SCENE.temples}
        name="Temples"
      >
        <Temples />
      </Sequence>
      <Sequence from={START.cradle} durationInFrames={SCENE.cradle} name="Cradle">
        <Cradle />
      </Sequence>
      <Sequence from={START.finale} durationInFrames={SCENE.finale} name="Finale">
        <Finale />
      </Sequence>
      <Vignette />
      <FilmGrain />
    </AbsoluteFill>
  );
};
