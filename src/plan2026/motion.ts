import { interpolate } from "remotion";

export const clamp = {
  extrapolateLeft: "clamp" as const,
  extrapolateRight: "clamp" as const,
};

/** 淡入—保持—淡出 */
export const fadeWindow = (
  frame: number,
  duration: number,
  fadeIn = 18,
  fadeOut = 18,
) =>
  interpolate(
    frame,
    [0, fadeIn, duration - fadeOut, duration],
    [0, 1, 1, 0],
    clamp,
  );

/** 莲心呼吸：缓慢的正弦明暗 */
export const breath = (frame: number, period = 90, depth = 0.12) =>
  1 - depth / 2 + (depth / 2) * Math.sin((frame / period) * Math.PI * 2);
