import { waitForShanzhuFonts } from "./fonts";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./theme";

export const calculateShanzhuMetadata = async () => {
  await waitForShanzhuFonts();
  return {
    durationInFrames: DURATION_IN_FRAMES,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
  };
};
