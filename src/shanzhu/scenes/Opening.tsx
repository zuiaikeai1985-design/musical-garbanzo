import React from "react";
import {
  AbsoluteFill,
  interpolate,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";
import { BrandLogo } from "../components/Bead";
import { serifFamily, titleFamily } from "../fonts";
import { clamp, fadeWindow } from "../motion";
import { copy, palette, SCENE } from "../theme";

/** Act 1 — Logo 起：一切从这一念开始 */
export const LogoOpen: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = fadeWindow(frame, SCENE.logo, 12, 20);
  const open = interpolate(frame, [8, 70], [0.2, 1], clamp);
  const scale = interpolate(frame, [0, 80], [0.82, 1], clamp);
  const brandIn = interpolate(frame, [50, 90], [0, 1], clamp);
  const enIn = interpolate(frame, [80, 120], [0, 1], clamp);
  const pulse = 1 + Math.sin(frame / (fps * 1.4)) * 0.015;

  return (
    <AbsoluteFill style={{ opacity }}>
      <div
        style={{
          position: "absolute",
          left: "50%",
          top: "38%",
          width: 520,
          height: 520,
          transform: "translate(-50%, -50%)",
          background: `radial-gradient(circle, ${palette.gold}44 0%, transparent 65%)`,
          opacity: open,
        }}
      />
      <AbsoluteFill
        style={{
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ transform: `scale(${scale * pulse})` }}>
          <BrandLogo size={280} open={open} />
        </div>
        <div
          style={{
            marginTop: 28,
            textAlign: "center",
            opacity: brandIn,
          }}
        >
          <div
            style={{
              fontFamily: titleFamily,
              fontSize: 72,
              color: palette.cream,
              letterSpacing: 28,
            }}
          >
            {copy.brand}
          </div>
          <div
            style={{
              marginTop: 16,
              fontFamily: serifFamily,
              fontSize: 26,
              color: palette.gold,
              letterSpacing: 6,
              fontStyle: "italic",
              opacity: enIn,
            }}
          >
            {copy.english}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
