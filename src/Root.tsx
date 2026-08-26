import { Composition } from "remotion";
import { Main } from "./Main";
import { calculateShanzhuMetadata } from "./shanzhu/calculate-metadata";
import { JiushiShanzhu } from "./shanzhu/JiushiShanzhu";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./shanzhu/theme";

import { calculateMetadata } from "./calculate-metadata/calculate-metadata";
import { schema } from "./calculate-metadata/schema";

export const RemotionRoot = () => {
  return (
    <>
    <Composition
      id="JiushiShanzhu"
      component={JiushiShanzhu}
      durationInFrames={DURATION_IN_FRAMES}
      fps={FPS}
      width={WIDTH}
      height={HEIGHT}
      calculateMetadata={calculateShanzhuMetadata}
    />
    <Composition
      id="Main"
      component={Main}
      defaultProps={{
        steps: null,
        themeColors: null,
        theme: "github-dark" as const,
        codeWidth: null,
        width: {
          type: "auto",
        },
      }}
      fps={30}
      height={1080}
      calculateMetadata={calculateMetadata}
      schema={schema}
    />
    </>
  );
};
