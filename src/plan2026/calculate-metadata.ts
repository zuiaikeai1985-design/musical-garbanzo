import { waitForPlanFonts } from "./fonts";
import { DURATION_IN_FRAMES, FPS, HEIGHT, WIDTH } from "./theme";

export const calculatePlan2026Metadata = async () => {
  await waitForPlanFonts();
  return {
    durationInFrames: DURATION_IN_FRAMES,
    fps: FPS,
    width: WIDTH,
    height: HEIGHT,
  };
};
