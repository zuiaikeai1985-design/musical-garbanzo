import { useLanguage } from "../hooks/useLanguage";
import type { SuperweaponView } from "../hooks/useGameSnapshot";
import { TICKS_PER_SECOND } from "../../engine/constants";
import { STRUCTURES } from "../../engine/rules";

function formatCountdown(secondsLeft: number): string {
  const m = Math.floor(secondsLeft / 60);
  const s = secondsLeft % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Missile Silo readiness panel.
 *
 * Mirrors the original's superweapon clock: a charge bar counting down to READY, then a button
 * that arms targeting mode.
 */
export function Superweapon({
  view,
  onTarget,
  targeting,
}: {
  view: SuperweaponView;
  onTarget: () => void;
  targeting: boolean;
}) {
  const { t } = useLanguage();
  const totalSeconds = STRUCTURES.nukesilo.superweaponCharge / TICKS_PER_SECOND;
  const remaining = Math.max(0, Math.ceil(totalSeconds * (1 - view.charge)));

  return (
    <button
      className={
        "superweapon" +
        (view.ready ? " is-ready" : "") +
        (targeting ? " is-targeting" : "")
      }
      onClick={onTarget}
      disabled={!view.ready}
      data-testid="superweapon"
      data-state={targeting ? "targeting" : view.ready ? "ready" : "charging"}
    >
      <span className="superweapon-label">{t.struct_nukesilo}</span>
      <span className="superweapon-bar">
        <span className="superweapon-fill" style={{ width: `${view.charge * 100}%` }} />
      </span>
      <span className="superweapon-time">
        {view.ready ? t.hudReady : formatCountdown(remaining)}
      </span>
    </button>
  );
}
