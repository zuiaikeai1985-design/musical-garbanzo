import { useEffect, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { TICKS_PER_SECOND } from "../../engine/constants";
import type { PlayerStats } from "../../engine/types";
import "./ResultScreen.css";

export interface ResultScreenProps {
  victory: boolean;
  stats: PlayerStats;
  /** Mission length in simulation ticks. */
  ticks: number;
  onRestart: () => void;
  onMenu: () => void;
}

function formatTime(ticks: number): string {
  const total = Math.floor(ticks / TICKS_PER_SECOND);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`;
}

/** Weighted score, so a fast clean win beats a slow pyrrhic one. */
export function computeScore(stats: PlayerStats, ticks: number, victory: boolean): number {
  const minutes = Math.max(1, ticks / (TICKS_PER_SECOND * 60));
  const base =
    stats.enemiesDestroyed * 120 +
    stats.oreHarvested * 0.4 +
    stats.structuresBuilt * 60 -
    stats.unitsLost * 40 -
    stats.structuresLost * 90;
  const speedBonus = victory ? Math.max(0, 4000 - minutes * 100) : 0;
  return Math.max(0, Math.round(base + speedBonus));
}

/** Counts a number up over `durationMs`, like the original's tally screen. */
function useCountUp(target: number, durationMs = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // Ease out so the last digits settle rather than snapping.
      setValue(Math.round(target * (1 - Math.pow(1 - t, 3))));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return value;
}

function StatRow({ label, value }: { label: string; value: number }) {
  const shown = useCountUp(value);
  return (
    <div className="result-row">
      <span className="result-label">{label}</span>
      <span className="result-value">{shown}</span>
    </div>
  );
}

export function ResultScreen({ victory, stats, ticks, onRestart, onMenu }: ResultScreenProps) {
  const { t } = useLanguage();
  const score = computeScore(stats, ticks, victory);

  return (
    <div className={"result-root" + (victory ? " is-victory" : " is-defeat")} data-testid="result">
      <div className="result-panel">
        <h1 className="result-title" data-testid="result-title">
          {victory ? t.victoryTitle : t.defeatTitle}
        </h1>

        <div className="result-stats">
          <StatRow label={t.statUnitsBuilt} value={stats.unitsBuilt} />
          <StatRow label={t.statUnitsLost} value={stats.unitsLost} />
          <StatRow label={t.statStructuresBuilt} value={stats.structuresBuilt} />
          <StatRow label={t.statStructuresLost} value={stats.structuresLost} />
          <StatRow label={t.statEnemiesDestroyed} value={stats.enemiesDestroyed} />
          <StatRow label={t.statOreHarvested} value={Math.round(stats.oreHarvested)} />
          <div className="result-row">
            <span className="result-label">{t.statTime}</span>
            <span className="result-value">{formatTime(ticks)}</span>
          </div>
          <div className="result-row is-score">
            <span className="result-label">{t.statScore}</span>
            <span className="result-value" data-testid="result-score">
              {score}
            </span>
          </div>
        </div>

        <div className="result-actions">
          <button className="result-button" onClick={onRestart} data-testid="result-restart">
            {t.restart}
          </button>
          <button className="result-button" onClick={onMenu} data-testid="result-menu">
            {t.abort}
          </button>
        </div>
      </div>
    </div>
  );
}
