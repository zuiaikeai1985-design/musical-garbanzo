import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { BrandLogo } from "../components/Bead";
import { BrotherSilhouettes } from "../components/Motifs";
import { serifFamily, titleFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

/** Act 4 — 回归 Logo：人潮收束回这一念 */
export const LogoReturn: React.FC = () => {
  const frame = useCurrentFrame();
  const opacity = fadeWindow(frame, SCENE.returnLogo, 14, 28);
  const crowdFade = interpolate(frame, [0, 80], [0.55, 0], clamp);
  const crowdScale = interpolate(frame, [0, 90], [1, 0.35], clamp);
  const logoIn = interpolate(frame, [40, 100], [0, 1], clamp);
  const logoScale = interpolate(frame, [40, 120], [0.55, 1], clamp);
  const titleIn = interpolate(frame, [90, 140], [0, 1], clamp);
  const sloganIn = interpolate(frame, [130, 180], [0, 1], clamp);
  const footIn = interpolate(frame, [200, 260], [0, 1], clamp);
  const lineIn = interpolate(frame, [100, 150], [0, 1], clamp);

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          bottom: 220,
          transform: `translateX(-50%) scale(${crowdScale})`,
          opacity: crowdFade,
        }}
      >
        <BrotherSilhouettes count={9} />
      </div>
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            opacity: logoIn,
            transform: `scale(${logoScale})`,
            marginBottom: 12,
          }}
        >
          <BrandLogo size={240} open={1} />
        </div>
        <div
          style={{
            textAlign: "center",
            opacity: titleIn,
          }}
        >
          <div
            style={{
              fontFamily: titleFamily,
              fontSize: 78,
              color: palette.cream,
              letterSpacing: 28,
            }}
          >
            {copy.brand}
          </div>
          <div
            style={{
              marginTop: 14,
              fontFamily: serifFamily,
              fontSize: 26,
              color: palette.gold,
              letterSpacing: 6,
              fontStyle: "italic",
            }}
          >
            {copy.english}
          </div>
          <div
            style={{
              margin: "22px auto 0",
              width: 140,
              height: 1,
              background: palette.gold,
              opacity: lineIn,
            }}
          />
          <div
            style={{
              marginTop: 20,
              fontFamily: serifFamily,
              fontSize: 28,
              color: palette.cream,
              letterSpacing: 8,
              opacity: sloganIn,
            }}
          >
            {copy.slogan}
          </div>
          <div
            style={{
              marginTop: 18,
              fontFamily: serifFamily,
              fontWeight: 300,
              fontSize: 22,
              color: palette.gold,
              letterSpacing: 4,
              opacity: sloganIn,
            }}
          >
            {copy.returnLine}
          </div>
          <div
            style={{
              marginTop: 36,
              fontFamily: serifFamily,
              fontSize: 18,
              color: palette.gold,
              letterSpacing: 6,
              opacity: footIn,
            }}
          >
            {copy.lockup}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
