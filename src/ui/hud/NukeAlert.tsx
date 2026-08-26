import { useLanguage } from "../hooks/useLanguage";
import type { PendingNukeView } from "../hooks/useGameSnapshot";
import "./NukeAlert.css";

/**
 * Full-screen nuclear launch warning.
 *
 * A hostile launch pulses red across the whole viewport; the player's own launch shows the same
 * countdown in amber so the two are never confused in the heat of a battle.
 */
export function NukeAlert({ nuke }: { nuke: PendingNukeView }) {
  const { t } = useLanguage();
  return (
    <div
      className={"nuke-alert" + (nuke.hostile ? " is-hostile" : " is-friendly")}
      data-testid="nuke-alert"
    >
      <div className="nuke-alert-pulse" />
      <div className="nuke-alert-banner">
        <span className="nuke-alert-text">{t.eva_nuclearWeaponLaunched}</span>
        <span className="nuke-alert-countdown" data-testid="nuke-countdown">
          {nuke.secondsLeft}
        </span>
      </div>
    </div>
  );
}
