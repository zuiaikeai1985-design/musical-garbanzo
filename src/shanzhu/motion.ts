import { interpolate } from "remotion";

export const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

export const fadeWindow = (
  frame: number,
  duration: number,
  fadeIn = 18,
  fadeOut = 18,
) => {
  return interpolate(
    frame,
    [0, fadeIn, duration - fadeOut, duration],
    [0, 1, 1, 0],
    clamp,
  );
};

