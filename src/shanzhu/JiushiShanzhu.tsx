import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import {
  FilmGrain,
  GoldDust,
  MistGround,
  MountainSilhouette,
  Vignette,
} from "./components/Atmosphere";
import { FewPeople } from "./scenes/Depart";
import { LogoReturn } from "./scenes/Finale";
import { LogoOpen } from "./scenes/Opening";
import { MorePeople } from "./scenes/PathWalk";
import { palette, SCENE, START } from "./theme";

export const JiushiShanzhu: React.FC = () => {
  return (
    <AbsoluteFill style={{ backgroundColor: palette.void }}>
      <MistGround />
      <MountainSilhouette />
      <GoldDust />
      <Sequence from={START.logo} durationInFrames={SCENE.logo} name="1-Logo">
        <LogoOpen />
      </Sequence>
      <Sequence from={START.few} durationInFrames={SCENE.few} name="2-Few">
        <FewPeople />
      </Sequence>
      <Sequence from={START.many} durationInFrames={SCENE.many} name="3-Many">
        <MorePeople />
      </Sequence>
      <Sequence
        from={START.returnLogo}
        durationInFrames={SCENE.returnLogo}
        name="4-ReturnLogo"
      >
        <LogoReturn />
      </Sequence>
      <Vignette />
      <FilmGrain />
    </AbsoluteFill>
  );
};
