import React from "react";
import { palette } from "../theme";

export const Bead: React.FC<{
  size: number;
  color?: string;
  glow?: number;
}> = ({ size, color = palette.gold, glow = 0.55 }) => {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: `radial-gradient(circle at 32% 28%, #fff6d8 0%, ${color} 42%, #1b1308 100%)`,
        boxShadow: `
          0 0 ${size * 0.45}px ${color},
          0 0 ${size * 0.9}px rgba(212, 180, 90, ${glow}),
          inset -8px -10px ${size * 0.25}px rgba(0,0,0,0.35)
        `,
      }}
    />
  );
};
