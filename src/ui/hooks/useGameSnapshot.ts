import { useEffect, useState } from "react";
import type { Game } from "../../engine/game";
import { buildOptions, buildTimeOf, type BuildOption } from "../../engine/queries";
import { hasRadar } from "../../engine/systems/power";
import { structureDef, unitDef } from "../../engine/rules";
import {
  QueueKind,
  QueueStatus,
  type EntityId,
  type EvaKey,
  type GameStatus,
  type StructureKindId,
  type UnitKindId,
} from "../../engine/types";

export interface QueueItemView {
  what: UnitKindId | StructureKindId;
  isStructure: boolean;
  /** 0..1 */
  progress: number;
  ready: boolean;
}

export interface QueueView {
  status: QueueStatus;
  items: QueueItemView[];
}

export interface SelectionView {
  count: number;
  /** Unit kinds present, with counts, for the selection readout. */
  units: { kind: UnitKindId; count: number }[];
  /** Single selected structure, when exactly one is selected. */
  structure: {
    id: EntityId;
    kind: StructureKindId;
    hp: number;
    maxHp: number;
    repairing: boolean;
  } | null;
}

export interface HudSnapshot {
  tick: number;
  status: GameStatus;
  credits: number;
  capacity: number;
  powerProduced: number;
  powerConsumed: number;
  powerFactor: number;
  radar: boolean;
  options: BuildOption[];
  queues: Record<QueueKind, QueueView>;
  selection: SelectionView;
  eva: { id: number; key: EvaKey; tick: number }[];
  stats: {
    unitsBuilt: number;
    unitsLost: number;
    structuresBuilt: number;
    structuresLost: number;
    enemiesDestroyed: number;
    oreHarvested: number;
  };
}

export function snapshot(game: Game): HudSnapshot {
  const world = game.world;
  const side = world.humanSide;
  const player = world.players[side];

  const queueView = (kind: QueueKind): QueueView => {
    const q = player.queues[kind];
    return {
      status: q.status,
      items: q.items.map((item) => {
        const total = buildTimeOf(item.what);
        return {
          what: item.what,
          isStructure: item.isStructure,
          progress: total > 0 ? Math.min(1, item.progress / total) : 0,
          ready: item.progress >= total,
        };
      }),
    };
  };

  const unitCounts = new Map<UnitKindId, number>();
  let selectedStructure: SelectionView["structure"] = null;
  for (const id of world.selection) {
    const u = world.unit(id);
    if (u) {
      unitCounts.set(u.kind, (unitCounts.get(u.kind) ?? 0) + 1);
      continue;
    }
    const s = world.structure(id);
    if (s && world.selection.size === 1) {
      selectedStructure = {
        id: s.id,
        kind: s.kind,
        hp: Math.ceil(s.hp),
        maxHp: structureDef(s.kind).hp,
        repairing: s.repairing,
      };
    }
  }

  return {
    tick: world.tick,
    status: world.status,
    credits: Math.floor(player.credits),
    capacity: world.storageCapacity(side),
    powerProduced: player.powerProduced,
    powerConsumed: player.powerConsumed,
    powerFactor: player.powerFactor,
    radar: hasRadar(world, side),
    options: buildOptions(world, side),
    queues: {
      [QueueKind.Structure]: queueView(QueueKind.Structure),
      [QueueKind.Infantry]: queueView(QueueKind.Infantry),
      [QueueKind.Vehicle]: queueView(QueueKind.Vehicle),
    },
    selection: {
      count: world.selection.size,
      units: [...unitCounts.entries()]
        .map(([kind, count]) => ({ kind, count }))
        .sort((a, b) => unitDef(a.kind).order - unitDef(b.kind).order),
      structure: selectedStructure,
    },
    eva: world.evaLog.slice(-6).map((e) => ({ id: e.id, key: e.key, tick: e.tick })),
    stats: { ...player.stats },
  };
}

/**
 * Polls the simulation for HUD state at a fixed, modest rate.
 *
 * The game loop runs at 60fps but React does not need to; re-rendering the sidebar ten times a
 * second is imperceptible and keeps React entirely out of the frame budget.
 */
export function useGameSnapshot(game: Game | null, hz = 10): HudSnapshot | null {
  const [view, setView] = useState<HudSnapshot | null>(null);

  useEffect(() => {
    if (!game) return;
    setView(snapshot(game));
    const id = setInterval(() => setView(snapshot(game)), 1000 / hz);
    return () => clearInterval(id);
  }, [game, hz]);

  return view;
}
