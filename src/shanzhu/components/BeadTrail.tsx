import React from "react";
import { Bead } from "./Bead";
import { elementColor, LIFETIMES, palette } from "../theme";

export const BeadTrail: React.FC<{ active: number }> = ({ active }) => {
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 72,
        display: "flex",
        justifyContent: "center",
        gap: 22,
      }}
    >
      {LIFETIMES.map((life, index) => {
        const on = index <= active;
        return (
          <div key={life.id} style={{ opacity: on ? 1 : 0.28 }}>
            <Bead
              size={on && index === active ? 22 : 16}
              color={on ? elementColor[life.element] : palette.goldDeep}
              glow={on ? 0.7 : 0.15}
            />
          </div>
        );
      })}
    </div>
  );
};
