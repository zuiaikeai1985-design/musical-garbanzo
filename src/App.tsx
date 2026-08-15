import { useState } from "react";
import { MainMenu } from "./ui/screens/MainMenu";
import { GameScreen } from "./ui/screens/GameScreen";
import type { Difficulty } from "./engine/types";

export type Screen = "menu" | "game";

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");

  return (
    <>
      {screen === "menu" ? (
        <MainMenu
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          onStart={() => setScreen("game")}
        />
      ) : (
        <GameScreen difficulty={difficulty} onExit={() => setScreen("menu")} />
      )}
      <div className="crt-overlay" />
    </>
  );
}
