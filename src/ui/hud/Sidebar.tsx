import { useMemo, useState } from "react";
import { useLanguage } from "../hooks/useLanguage";
import { buildableName, evaText, structureName, unitName } from "../../i18n/names";
import { SidebarTab, type Side } from "../../engine/types";
import type { BuildOption } from "../../engine/queries";
import type { HudSnapshot } from "../hooks/useGameSnapshot";
import type { IconCache } from "../../render/sprites/icons";
import { BuildIcon } from "./BuildIcon";
import { Superweapon } from "./Superweapon";
import "./Sidebar.css";

const TABS: readonly SidebarTab[] = [
  SidebarTab.Structures,
  SidebarTab.Defense,
  SidebarTab.Infantry,
  SidebarTab.Vehicles,
];

export interface SidebarProps {
  hud: HudSnapshot;
  icons: IconCache;
  side: Side;
  minimapRef: React.Ref<HTMLCanvasElement>;
  onMinimapPointer: (e: React.PointerEvent<HTMLCanvasElement>) => void;
  onBuild: (option: BuildOption) => void;
  onCancel: (option: BuildOption) => void;
  onToggleSell: () => void;
  onToggleRepair: () => void;
  sellActive: boolean;
  repairActive: boolean;
  onAbort: () => void;
  activeTab: SidebarTab;
  onTab: (tab: SidebarTab) => void;
  onTargetNuke: () => void;
  nukeTargeting: boolean;
}

export function Sidebar({
  hud,
  icons,
  side,
  minimapRef,
  onMinimapPointer,
  onBuild,
  onCancel,
  onToggleSell,
  onToggleRepair,
  sellActive,
  repairActive,
  onAbort,
  activeTab,
  onTab,
  onTargetNuke,
  nukeTargeting,
}: SidebarProps) {
  const { t } = useLanguage();
  const [hovered, setHovered] = useState<string | null>(null);

  const tabLabel: Record<SidebarTab, string> = {
    [SidebarTab.Structures]: t.hudTabStructures,
    [SidebarTab.Defense]: t.hudTabDefense,
    [SidebarTab.Infantry]: t.hudTabInfantry,
    [SidebarTab.Vehicles]: t.hudTabVehicles,
  };

  const visible = useMemo(
    () => hud.options.filter((o) => o.tab === activeTab),
    [hud.options, activeTab],
  );

  /** Queue entry currently in progress for a given buildable, plus how many are stacked behind. */
  const queueInfo = (option: BuildOption) => {
    const queue = hud.queues[option.queue];
    const matching = queue.items.filter((i) => i.what === option.id);
    if (matching.length === 0) return { entry: null, pending: 0 };
    const head = queue.items[0];
    const entry = head && head.what === option.id ? head : null;
    return { entry, pending: matching.length - (entry ? 1 : 0) };
  };

  const powerRatio =
    hud.powerConsumed <= 0 ? 1 : Math.min(1, hud.powerProduced / hud.powerConsumed);
  const powerClass = powerRatio >= 1 ? "is-good" : powerRatio >= 0.5 ? "is-warn" : "is-bad";

  return (
    <aside className="sidebar" data-testid="sidebar">
      <div className="sidebar-top">
        <div className={"radar-frame" + (hud.radar ? "" : " is-offline")}>
          <canvas
            ref={minimapRef}
            className="radar-canvas"
            width={216}
            height={180}
            onPointerDown={onMinimapPointer}
            onPointerMove={(e) => {
              if (e.buttons & 1) onMinimapPointer(e);
            }}
            data-testid="minimap"
          />
          {!hud.radar && <span className="radar-offline-label">{t.hudNoRadar}</span>}
        </div>

        <div className="credits-row">
          <span className="credits-label">{t.hudCredits}</span>
          <span className="credits-value" data-testid="credits">
            ${hud.credits}
          </span>
        </div>

        <div className="power-row">
          <span className="power-label">{t.hudPower}</span>
          <div className="power-bar" data-testid="power-bar">
            <div className={"power-fill " + powerClass} style={{ width: `${powerRatio * 100}%` }} />
            {hud.powerConsumed > 0 && (
              <div
                className="power-demand"
                style={{
                  left: `${Math.min(100, (hud.powerConsumed / Math.max(hud.powerProduced, hud.powerConsumed)) * 100)}%`,
                }}
              />
            )}
          </div>
          <span className="power-value">
            {hud.powerProduced}/{hud.powerConsumed}
          </span>
        </div>
        {powerRatio < 1 && <div className="power-warning">{t.hudPowerLow}</div>}
      </div>

      {hud.superweapon && (
        <Superweapon
          view={hud.superweapon}
          onTarget={onTargetNuke}
          targeting={nukeTargeting}
        />
      )}

      <div className="sidebar-tools">
        <button
          className={"tool-button" + (sellActive ? " is-active" : "")}
          onClick={onToggleSell}
          data-testid="tool-sell"
        >
          {t.hudSell}
        </button>
        <button
          className={"tool-button" + (repairActive ? " is-active" : "")}
          onClick={onToggleRepair}
          data-testid="tool-repair"
        >
          {t.hudRepair}
        </button>
      </div>

      <div className="sidebar-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab}
            role="tab"
            aria-selected={tab === activeTab}
            className={"sidebar-tab" + (tab === activeTab ? " is-active" : "")}
            onClick={() => onTab(tab)}
            data-testid={`tab-${tab}`}
          >
            {tabLabel[tab]}
          </button>
        ))}
      </div>

      <div className="build-grid" data-testid="build-grid">
        {visible.map((option) => {
          const { entry, pending } = queueInfo(option);
          return (
            <div
              key={option.id}
              onPointerEnter={() => setHovered(option.id)}
              onPointerLeave={() => setHovered((h) => (h === option.id ? null : h))}
            >
              <BuildIcon
                option={option}
                icons={icons}
                side={side}
                entry={entry}
                pending={pending}
                onBuild={onBuild}
                onCancel={onCancel}
              />
            </div>
          );
        })}
        {visible.length === 0 && <p className="build-empty">—</p>}
      </div>

      <div className="sidebar-readouts">
        {hovered && (
          <p className="hover-info">
            {buildableName(
              t,
              hovered as BuildOption["id"],
              hud.options.find((o) => o.id === hovered)?.isStructure ?? false,
            )}
          </p>
        )}

        {hud.selection.structure && (
          <p className="selection-info" data-testid="selection-info">
            {structureName(t, hud.selection.structure.kind)} {hud.selection.structure.hp}/
            {hud.selection.structure.maxHp}
          </p>
        )}
        {hud.selection.units.length > 0 && (
          <p className="selection-info" data-testid="selection-info">
            {hud.selection.units
              .map((u) => `${unitName(t, u.kind)}${u.count > 1 ? ` x${u.count}` : ""}`)
              .join(", ")}
          </p>
        )}
      </div>

      <ul className="eva-log" data-testid="eva-log">
        {hud.eva.map((entry) => (
          <li key={entry.id}>{evaText(t, entry.key)}</li>
        ))}
      </ul>

      <button className="sidebar-exit" onClick={onAbort} data-testid="exit">
        {t.abort}
      </button>
    </aside>
  );
}

/** Cycles to the next sidebar tab (bound to Tab). */
export function nextTab(current: SidebarTab): SidebarTab {
  const index = TABS.indexOf(current);
  return TABS[(index + 1) % TABS.length];
}
