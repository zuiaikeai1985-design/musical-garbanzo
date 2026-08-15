import { useState } from "react";
import { MainMenu } from "./ui/screens/MainMenu";
import { GameScreen } from "./ui/screens/GameScreen";
import { SpriteViewer } from "./ui/screens/SpriteViewer";
import type { Difficulty } from "./engine/types";

export type Screen = "menu" | "game";

/** `?sprites` opens the developer sprite sheet instead of the game. */
const SPRITE_MODE =
  typeof location !== "undefined" && new URLSearchParams(location.search).has("sprites");

export function App() {
  const [screen, setScreen] = useState<Screen>("menu");
  const [difficulty, setDifficulty] = useState<Difficulty>("normal");
  /**
   * Bumping this remounts <GameScreen>, which is the cleanest way to restart a mission: the
   * whole simulation, renderer and input layer are rebuilt from scratch with no stale state.
   */
  const [runId, setRunId] = useState(0);

  if (SPRITE_MODE) return <SpriteViewer />;

  return (
    <>
      {screen === "menu" ? (
        <MainMenu
          difficulty={difficulty}
          onDifficulty={setDifficulty}
          onStart={() => {
            setRunId((n) => n + 1);
            setScreen("game");
          }}
        />
      ) : (
        <GameScreen
          key={runId}
          difficulty={difficulty}
          onExit={() => setScreen("menu")}
          onRestart={() => setRunId((n) => n + 1)}
        />
      )}
      <div className="crt-overlay" />
    </>
  );
}
