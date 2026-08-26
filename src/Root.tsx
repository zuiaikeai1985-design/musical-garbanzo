import { Composition } from "remotion";
import { Main } from "./Main";
import { ChuanDeng2026 } from "./plan2026/ChuanDeng2026";
import { calculatePlan2026Metadata } from "./plan2026/calculate-metadata";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./plan2026/theme";

import { calculateMetadata } from "./calculate-metadata/calculate-metadata";
import { schema } from "./calculate-metadata/schema";

export const RemotionRoot = () => {
  return (
    <>
      <Composition
        id="ChuanDeng2026"
        component={ChuanDeng2026}
        durationInFrames={DURATION_IN_FRAMES}
        fps={FPS}
        width={WIDTH}
        height={HEIGHT}
        calculateMetadata={calculatePlan2026Metadata}
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
