import { STRUCTURES, UNITS, structureDef, unitDef } from "./rules";
import {
  QueueKind,
  SidebarTab,
  type Side,
  type StructureKindId,
  type UnitKindId,
} from "./types";
import type { World } from "./world";

export interface BuildOption {
  readonly id: UnitKindId | StructureKindId;
  readonly isStructure: boolean;
  readonly queue: QueueKind;
  readonly tab: SidebarTab;
  readonly cost: number;
  readonly buildTime: number;
  /** Tech prerequisites are satisfied. */
  readonly unlocked: boolean;
  /** Unlocked *and* the player can currently pay for it. */
  readonly affordable: boolean;
  readonly order: number;
}

/** Are all of a thing's prerequisite structures built, finished and (where relevant) powered? */
export function requirementsMet(
  world: World,
  side: Side,
  requires: readonly StructureKindId[],
): boolean {
  for (const req of requires) {
    if (!world.hasOperational(side, req)) return false;
  }
  return true;
}

export function canBuildStructure(world: World, side: Side, kind: StructureKindId): boolean {
  const def = structureDef(kind);
  if (def.side !== side && def.side !== "both") return false;
  if (!world.hasOperational(side, side === "soviet" ? "conyard" : "conyard_a")) return false;
  return requirementsMet(world, side, def.requires);
}

export function canBuildUnit(world: World, side: Side, kind: UnitKindId): boolean {
  const def = unitDef(kind);
  if (def.side !== side && def.side !== "both") return false;
  if (!def.producedBy) return false;
  if (!world.hasOperational(side, def.producedBy)) return false;
  return requirementsMet(world, side, def.requires);
}

/** Which queue a buildable belongs to. */
export function queueFor(id: UnitKindId | StructureKindId): QueueKind {
  if (Object.prototype.hasOwnProperty.call(STRUCTURES, id)) return QueueKind.Structure;
  const def = UNITS[id as UnitKindId];
  return def.cls === "infantry" ? QueueKind.Infantry : QueueKind.Vehicle;
}

/** Sidebar tab a buildable appears under. */
export function tabFor(id: UnitKindId | StructureKindId): SidebarTab {
  if (Object.prototype.hasOwnProperty.call(STRUCTURES, id)) {
    return structureDef(id as StructureKindId).tab;
  }
  const def = UNITS[id as UnitKindId];
  return def.cls === "infantry" ? SidebarTab.Infantry : SidebarTab.Vehicles;
}

/**
 * Everything the side could ever build, annotated with whether it is currently unlocked and
 * affordable. The sidebar renders locked entries greyed out rather than hiding them, so the tech
 * tree is discoverable — same as the original.
 */
export function buildOptions(world: World, side: Side): BuildOption[] {
  const credits = world.players[side].credits;
  const options: BuildOption[] = [];

  for (const def of Object.values(STRUCTURES)) {
    if (def.side !== side && def.side !== "both") continue;
    if (def.producesQueue === QueueKind.Structure) continue; // the conyard itself is not buildable
    const unlocked = canBuildStructure(world, side, def.id);
    options.push({
      id: def.id,
      isStructure: true,
      queue: QueueKind.Structure,
      tab: def.tab,
      cost: def.cost,
      buildTime: def.buildTime,
      unlocked,
      affordable: unlocked && credits >= def.cost,
      order: def.order,
    });
  }

  for (const def of Object.values(UNITS)) {
    if (def.side !== side && def.side !== "both") continue;
    if (!def.producedBy) continue;
    const unlocked = canBuildUnit(world, side, def.id);
    options.push({
      id: def.id,
      isStructure: false,
      queue: def.cls === "infantry" ? QueueKind.Infantry : QueueKind.Vehicle,
      tab: def.cls === "infantry" ? SidebarTab.Infantry : SidebarTab.Vehicles,
      cost: def.cost,
      buildTime: def.buildTime,
      unlocked,
      affordable: unlocked && credits >= def.cost,
      order: def.order,
    });
  }

  return options.sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function costOf(id: UnitKindId | StructureKindId): number {
  return Object.prototype.hasOwnProperty.call(STRUCTURES, id)
    ? structureDef(id as StructureKindId).cost
    : unitDef(id as UnitKindId).cost;
}

export function buildTimeOf(id: UnitKindId | StructureKindId): number {
  return Object.prototype.hasOwnProperty.call(STRUCTURES, id)
    ? structureDef(id as StructureKindId).buildTime
    : unitDef(id as UnitKindId).buildTime;
}
