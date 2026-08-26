import { useLanguage } from "../hooks/useLanguage";
import { buildableName } from "../../i18n/names";
import type { BuildOption } from "../../engine/queries";
import type { QueueItemView } from "../hooks/useGameSnapshot";
import type { IconCache } from "../../render/sprites/icons";
import type { Side } from "../../engine/types";

export interface BuildIconProps {
  option: BuildOption;
  icons: IconCache;
  side: Side;
  /** The queue entry for this item, if one exists. */
  entry: QueueItemView | null;
  /** How many of this item are queued behind the one in progress. */
  pending: number;
  onBuild: (option: BuildOption) => void;
  onCancel: (option: BuildOption) => void;
}

/**
 * A sidebar cameo with the Red Alert "clock wipe" progress overlay.
 *
 * The wipe is drawn with a conic gradient masked to the tile, which matches the original's
 * sweeping pie-slice far better than a linear bar and costs nothing to animate.
 */
export function BuildIcon({
  option,
  icons,
  side,
  entry,
  pending,
  onBuild,
  onCancel,
}: BuildIconProps) {
  const { t } = useLanguage();
  const name = buildableName(t, option.id, option.isStructure);
  const progress = entry?.progress ?? 0;
  const ready = entry?.ready ?? false;
  const building = !!entry && !ready;

  const classes = ["build-icon"];
  if (!option.unlocked) classes.push("is-locked");
  else if (!option.affordable && !entry) classes.push("is-poor");
  if (ready) classes.push("is-ready");
  if (building) classes.push("is-building");

  return (
    <button
      className={classes.join(" ")}
      data-testid={`build-${option.id}`}
      data-state={ready ? "ready" : building ? "building" : option.unlocked ? "idle" : "locked"}
      disabled={!option.unlocked}
      title={`${name} — $${option.cost}`}
      onClick={(e) => {
        e.preventDefault();
        onBuild(option);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onCancel(option);
      }}
    >
      <img className="build-icon-art" src={icons.dataUrl(option.id, side)} alt={name} />

      {building && (
        <span
          className="build-icon-clock"
          style={{
            background: `conic-gradient(rgba(6,6,10,0.72) ${(1 - progress) * 360}deg, rgba(0,0,0,0) 0deg)`,
          }}
        />
      )}

      {ready && (
        <span className="build-icon-flash">
          {option.isStructure ? t.hudPlace : t.hudReady}
        </span>
      )}

      {pending > 0 && <span className="build-icon-count">{pending}</span>}

      <span className="build-icon-name">{name}</span>
      <span className="build-icon-cost">${option.cost}</span>
    </button>
  );
}
