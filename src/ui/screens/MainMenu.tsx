import { useEffect, useRef } from "react";
import { useLanguage } from "../hooks/useLanguage";
import type { Difficulty } from "../../engine/types";
import { drawTitleBanner } from "../../render/sprites/titleBanner";
import "./MainMenu.css";

const DIFFICULTIES: readonly Difficulty[] = ["easy", "normal", "hard"];

export function MainMenu({
  difficulty,
  onDifficulty,
  onStart,
}: {
  difficulty: Difficulty;
  onDifficulty: (d: Difficulty) => void;
  onStart: () => void;
}) {
  const { t, lang, toggleLang } = useLanguage();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let raf = 0;
    let start = performance.now();
    const loop = (now: number) => {
      drawTitleBanner(canvas, (now - start) / 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => {
      cancelAnimationFrame(raf);
      start = 0;
    };
  }, []);

  const difficultyLabel: Record<Difficulty, string> = {
    easy: t.difficultyEasy,
    normal: t.difficultyNormal,
    hard: t.difficultyHard,
  };

  return (
    <div className="menu-root">
      <div className="menu-bg" />

      <button className="lang-toggle" onClick={toggleLang} data-testid="lang-toggle">
        {t.languageToggle}
      </button>

      <div className="menu-panel">
        <canvas
          ref={canvasRef}
          className="menu-banner"
          width={320}
          height={96}
          data-testid="title-banner"
        />

        <h1 className="menu-title" data-testid="app-title">
          {t.appTitle}
        </h1>
        <p className="menu-subtitle">{t.appSubtitle}</p>

        <div className="menu-difficulty">
          <span className="menu-label">{t.menuDifficulty}</span>
          <div className="menu-difficulty-row">
            {DIFFICULTIES.map((d) => (
              <button
                key={d}
                className={"menu-chip" + (d === difficulty ? " is-active" : "")}
                onClick={() => onDifficulty(d)}
                data-testid={`difficulty-${d}`}
              >
                {difficultyLabel[d]}
              </button>
            ))}
          </div>
        </div>

        <button className="menu-button menu-button--primary" onClick={onStart} data-testid="start">
          {t.menuNewMission}
        </button>

        <p className="menu-foot" lang={lang === "zh" ? "zh-CN" : "en"}>
          {t.briefingMissionLabel} · {t.briefingMissionName}
        </p>
      </div>
    </div>
  );
}
