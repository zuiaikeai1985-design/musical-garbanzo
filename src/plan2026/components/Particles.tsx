import React from "react";
import { AbsoluteFill, random, useCurrentFrame } from "remotion";
import { HEIGHT, palette, WIDTH } from "../theme";

type Props = {
  count?: number;
  opacity?: number;
  seed?: string;
};

/** 缓慢上浮的暖金光尘 */
export const Particles: React.FC<Props> = ({
  count = 26,
  opacity = 1,
  seed = "dust",
}) => {
  const frame = useCurrentFrame();

  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const x0 = random(`${seed}-x-${i}`) * WIDTH;
        const y0 = random(`${seed}-y-${i}`) * HEIGHT;
        const speed = 0.15 + random(`${seed}-v-${i}`) * 0.35;
        const drift = Math.sin((frame + i * 40) / 65) * 14;
        const y = ((y0 - frame * speed) % (HEIGHT + 80)) + 40;
        const size = 1.6 + random(`${seed}-s-${i}`) * 3.2;
        const tw = 0.4 + 0.6 * Math.abs(Math.sin((frame + i * 23) / 38));
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: x0 + drift,
              top: y < 0 ? y + HEIGHT + 80 : y,
              width: size,
              height: size,
              borderRadius: "50%",
              background: palette.flameHot,
              boxShadow: `0 0 ${size * 3.5}px ${palette.flame}`,
              opacity: tw * opacity * 0.8,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};
