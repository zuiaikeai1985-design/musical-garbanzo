import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BrandLogo } from "../components/Bead";
import { BrotherSilhouettes } from "../components/Motifs";
import { serifFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

/** Act 2 — 遇到一群人：Logo 之光化作金刚兄弟 */
export const FewPeople: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, SCENE.few, 16, 18);
  const logoFade = interpolate(frame, [0, 70], [1, 0.12], clamp);
  const logoScale = interpolate(frame, [0, 90], [1, 0.45], clamp);
  const peopleIn = interpolate(frame, [40, 100], [0, 1], clamp);
  const walk = interpolate(frame, [50, SCENE.few], [30, -10], clamp);
  const textIn = interpolate(frame, [80, 130], [0, 1], clamp);
  const subIn = interpolate(frame, [120, 170], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "22%",
          transform: `translate(-50%, -50%) scale(${logoScale})`,
          opacity: logoFade,
        }}
      >
        <BrandLogo size={200} open={1} />
      </div>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "18%",
          width: 280,
          height: 280,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${palette.goldBright}55 0%, transparent 70%)`,
          opacity: peopleIn * 0.8,
          filter: "blur(6px)",
        }}
      />
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 200,
          transform: `translateX(calc(-50% + ${walk}px))`,
          opacity: peopleIn,
        }}
      >
        <BrotherSilhouettes count={3} />
      </div>
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: 110,
          textAlign: "center",
        }}
      >
        <div
          style={{
            fontFamily: serifFamily,
            fontWeight: 300,
            fontSize: 36,
            color: palette.cream,
            letterSpacing: 8,
            opacity: textIn,
          }}
        >
          {copy.fewLine}
        </div>
        <div
          style={{
            marginTop: 14,
            fontFamily: serifFamily,
            fontSize: 22,
            color: palette.gold,
            letterSpacing: 8,
            opacity: subIn,
          }}
        >
          {copy.fewSub}
        </div>
      </div>
    </AbsoluteFill>
  );
};
