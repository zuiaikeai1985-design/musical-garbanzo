import { BUILDUP_TICKS, REPAIR_COST_PER_HP, REPAIR_HP_PER_PULSE, REPAIR_PULSE_TICKS } from "../constants";
import { structureDef, unitDef } from "../rules";
import { buildTimeOf, canBuildStructure, canBuildUnit, costOf, queueFor } from "../queries";
import {
  QueueKind,
  QueueStatus,
  type ProductionQueue,
  type Side,
  type Structure,
  type StructureKindId,
  type UnitKindId,
} from "../types";
import { tileToWorldX, tileToWorldY } from "../util/vec";
import type { World } from "../world";
import { giveOrder } from "./orders";
import { productionFactor } from "./power";

const SIDES: readonly Side[] = ["soviet", "allied"];
/** Don't spam the "insufficient funds" warning while a queue is stalled. */
const FUNDS_WARN_INTERVAL = 150;

/**
 * Production queues.
 *
 * Cost is paid as a drip proportional to progress (as in the original) rather than up-front:
 * that is what makes cancelling a half-built item refund only what you actually spent, and it
 * lets a queue stall gracefully when the treasury runs dry instead of refusing the order.
 */
export function productionSystem(world: World): void {
  for (const side of SIDES) {
    const player = world.players[side];
    refreshPrimaries(world, side);
    const factor = productionFactor(world, side);

    for (const kind of [QueueKind.Structure, QueueKind.Infantry, QueueKind.Vehicle] as const) {
      advanceQueue(world, side, player.queues[kind], factor);
    }
  }

  advanceBuildups(world);
  runRepairs(world);
}

// ── Queue plumbing ──────────────────────────────────────────────────────────

export function enqueue(
  world: World,
  side: Side,
  what: UnitKindId | StructureKindId,
): boolean {
  const queueKind = queueFor(what);
  const queue = world.players[side].queues[queueKind];
  const isStructure = queueKind === QueueKind.Structure;

  const allowed = isStructure
    ? canBuildStructure(world, side, what as StructureKindId)
    : canBuildUnit(world, side, what as UnitKindId);
  if (!allowed) {
    if (side === world.humanSide) world.emitSound("uiError", 0, 0, side);
    return false;
  }
  if (queue.items.length >= 9) return false;

  queue.items.push({ what, isStructure, progress: 0, paid: 0 });
  if (queue.status === QueueStatus.Empty) queue.status = QueueStatus.Building;
  if (side === world.humanSide) world.emitSound("buildStart", 0, 0, side);
  return true;
}

/**
 * Cancels one instance of `what`, refunding what was actually paid.
 * Removes the last matching item so repeatedly clicking cancel peels the queue back.
 */
export function cancelFromQueue(
  world: World,
  side: Side,
  what: UnitKindId | StructureKindId,
): boolean {
  const queue = world.players[side].queues[queueFor(what)];
  for (let i = queue.items.length - 1; i >= 0; i--) {
    if (queue.items[i].what !== what) continue;
    const [removed] = queue.items.splice(i, 1);
    world.addCredits(side, removed.paid);
    if (queue.items.length === 0) queue.status = QueueStatus.Empty;
    else if (queue.status === QueueStatus.Ready) queue.status = QueueStatus.Building;
    if (side === world.humanSide) world.emitSound("uiClick", 0, 0, side);
    return true;
  }
  return false;
}

export function toggleHold(world: World, side: Side, kind: QueueKind): void {
  const queue = world.players[side].queues[kind];
  if (queue.items.length === 0) return;
  queue.status = queue.status === QueueStatus.OnHold ? QueueStatus.Building : QueueStatus.OnHold;
}

function advanceQueue(world: World, side: Side, queue: ProductionQueue, factor: number): void {
  if (queue.items.length === 0) {
    queue.status = QueueStatus.Empty;
    return;
  }
  if (queue.status === QueueStatus.OnHold || queue.status === QueueStatus.Ready) return;

  queue.status = QueueStatus.Building;
  const item = queue.items[0];
  const total = buildTimeOf(item.what);
  const cost = costOf(item.what);

  // A vehicle/infantry queue with no surviving factory cannot progress.
  if (!item.isStructure && !producerFor(world, side, item.what as UnitKindId)) {
    world.addCredits(side, item.paid);
    queue.items.shift();
    if (queue.items.length === 0) queue.status = QueueStatus.Empty;
    return;
  }

  const nextProgress = Math.min(total, item.progress + factor);
  const targetPaid = (cost * nextProgress) / total;
  const due = targetPaid - item.paid;

  const player = world.players[side];
  if (due > player.credits) {
    if (world.tick % FUNDS_WARN_INTERVAL === 0) {
      world.emitEva("insufficientFunds", side);
    }
    return;
  }

  player.credits -= due;
  item.paid = targetPaid;
  item.progress = nextProgress;

  if (item.progress < total) return;

  if (item.isStructure) {
    // Structures wait for the player (or AI) to choose a spot.
    queue.status = QueueStatus.Ready;
    world.emitEva("constructionComplete", side);
    if (side === world.humanSide) world.emitSound("buildComplete", 0, 0, side);
  } else {
    if (spawnFromFactory(world, side, item.what as UnitKindId)) {
      queue.items.shift();
      world.emitEva("unitReady", side);
      if (side === world.humanSide) world.emitSound("buildComplete", 0, 0, side);
      if (queue.items.length === 0) queue.status = QueueStatus.Empty;
    }
    // If the exit is blocked, hold the finished unit until it clears.
  }
}

/** Is there a completed, operational structure that produces this unit? */
function producerFor(world: World, side: Side, kind: UnitKindId): Structure | null {
  const producedBy = unitDef(kind).producedBy;
  if (!producedBy) return null;
  const preferred = world.players[side].primary[queueFor(kind)];
  const candidates = world.structures.filter(
    (s) => s.side === side && s.kind === producedBy && !s.dead && s.buildProgress >= 1,
  );
  if (candidates.length === 0) return null;
  return candidates.find((s) => s.id === preferred) ?? candidates[0];
}

function spawnFromFactory(world: World, side: Side, kind: UnitKindId): boolean {
  const factory = producerFor(world, side, kind);
  if (!factory) return false;

  const def = structureDef(factory.kind);
  const exit = def.exit ?? { tx: Math.floor(def.w / 2), ty: def.h };
  const spot = findFreeSpot(world, factory.tx + exit.tx, factory.ty + exit.ty);
  if (!spot) return false;

  const unit = world.spawnUnit(kind, side, tileToWorldX(spot.tx), tileToWorldY(spot.ty), Math.PI / 2);
  world.players[side].stats.unitsBuilt++;

  // Head for the rally point unless it is where we already are.
  const dx = factory.rallyX - unit.x;
  const dy = factory.rallyY - unit.y;
  if (Math.hypot(dx, dy) > 12) {
    giveOrder(world, unit, { type: "move", x: factory.rallyX, y: factory.rallyY });
  }
  return true;
}

function findFreeSpot(world: World, tx: number, ty: number): { tx: number; ty: number } | null {
  const grid = world.grid;
  for (let r = 0; r <= 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (grid.inBounds(x, y) && grid.passable(x, y)) return { tx: x, ty: y };
      }
    }
  }
  return null;
}

/** Keeps each queue pointed at a living factory. */
function refreshPrimaries(world: World, side: Side): void {
  const player = world.players[side];
  for (const kind of [QueueKind.Infantry, QueueKind.Vehicle, QueueKind.Structure] as const) {
    const current = player.primary[kind];
    const existing = current ? world.structure(current) : undefined;
    if (existing && !existing.dead && existing.buildProgress >= 1) continue;
    const replacement = world.structures.find(
      (s) =>
        s.side === side &&
        !s.dead &&
        s.buildProgress >= 1 &&
        structureDef(s.kind).producesQueue === kind,
    );
    if (replacement) player.primary[kind] = replacement.id;
    else delete player.primary[kind];
  }
}

// ── Placement ───────────────────────────────────────────────────────────────

/** Places a structure whose queue item is `Ready`. Returns the new structure or null. */
export function placeReadyStructure(
  world: World,
  side: Side,
  what: StructureKindId,
  tx: number,
  ty: number,
): Structure | null {
  const queue = world.players[side].queues[QueueKind.Structure];
  const index = queue.items.findIndex(
    (item) => item.what === what && item.progress >= buildTimeOf(item.what),
  );
  if (index === -1) return null;
  if (!isPlacementLegal(world, side, what, tx, ty)) {
    if (side === world.humanSide) {
      world.emitSound("uiError", 0, 0, side);
      world.emitEva("cannotDeployHere", side);
    }
    return null;
  }

  const structure = world.spawnStructure(what, side, tx, ty, false);
  if (!structure) return null;

  queue.items.splice(index, 1);
  queue.status = queue.items.length === 0 ? QueueStatus.Empty : QueueStatus.Building;
  world.players[side].stats.structuresBuilt++;
  world.emitSound("placeBuilding", tileToWorldX(tx), tileToWorldY(ty), side);
  world.emitEva("newConstructionOptions", side);

  // A refinery arrives with a free harvester, exactly like the original.
  if (structureDef(what).isRefinery) {
    const harvKind: UnitKindId = side === "soviet" ? "harv" : "harva";
    const def = structureDef(what);
    const spot = findFreeSpot(world, tx + def.w, ty + def.h - 1);
    if (spot) {
      const harvester = world.spawnUnit(
        harvKind,
        side,
        tileToWorldX(spot.tx),
        tileToWorldY(spot.ty),
      );
      harvester.homeRefinery = structure.id;
    }
  }

  return structure;
}

/** Footprint is clear, on buildable ground, and inside the side's build radius. */
export function isPlacementLegal(
  world: World,
  side: Side,
  what: StructureKindId,
  tx: number,
  ty: number,
): boolean {
  const def = structureDef(what);
  if (!world.footprintFree(tx, ty, def.w, def.h)) return false;
  return withinBuildRadius(world, side, tx, ty, def.w, def.h);
}

/** Distance from any friendly structure, measured between footprints. */
export function withinBuildRadius(
  world: World,
  side: Side,
  tx: number,
  ty: number,
  w: number,
  h: number,
  radius = 6,
): boolean {
  for (const s of world.structures) {
    if (s.side !== side || s.dead) continue;
    const sd = structureDef(s.kind);
    const dx = Math.max(s.tx - (tx + w), tx - (s.tx + sd.w), 0);
    const dy = Math.max(s.ty - (ty + h), ty - (s.ty + sd.h), 0);
    if (Math.hypot(dx, dy) <= radius) return true;
  }
  return false;
}

// ── Build-up animation, selling and repair ──────────────────────────────────

function advanceBuildups(world: World): void {
  for (const s of world.structures) {
    if (s.dead || s.buildProgress >= 1) continue;
    s.buildProgress = Math.min(1, s.buildProgress + 1 / BUILDUP_TICKS);
  }
}

export function sellStructure(world: World, id: number): void {
  const s = world.structure(id);
  if (!s || s.dead) return;
  const def = structureDef(s.kind);
  // Selling the last Construction Yard would soft-lock the player; the original allows it, but
  // here it is the difference between "risky" and "unrecoverable", so it is blocked.
  if (def.producesQueue === QueueKind.Structure) {
    const others = world.structures.filter(
      (o) => o.side === s.side && !o.dead && o.id !== s.id && structureDef(o.kind).producesQueue === QueueKind.Structure,
    );
    if (others.length === 0) {
      world.emitSound("uiError", 0, 0, s.side);
      return;
    }
  }
  world.addCredits(s.side, Math.floor(def.cost * 0.5));
  destroyStructure(world, s, false);
  world.emitSound("sell", 0, 0, s.side);
}

export function toggleRepair(world: World, id: number): void {
  const s = world.structure(id);
  if (!s || s.dead) return;
  const def = structureDef(s.kind);
  if (s.hp >= def.hp) return;
  s.repairing = !s.repairing;
  if (s.repairing) {
    world.emitSound("repair", 0, 0, s.side);
    world.emitEva("repairing", s.side);
  }
}

function runRepairs(world: World): void {
  if (world.tick % REPAIR_PULSE_TICKS !== 0) return;
  for (const s of world.structures) {
    if (s.dead || !s.repairing) continue;
    const def = structureDef(s.kind);
    if (s.hp >= def.hp) {
      s.repairing = false;
      continue;
    }
    const heal = def.hp * REPAIR_HP_PER_PULSE;
    const cost = heal * REPAIR_COST_PER_HP;
    const player = world.players[s.side];
    if (player.credits < cost) {
      s.repairing = false;
      world.emitEva("insufficientFunds", s.side);
      continue;
    }
    player.credits -= cost;
    s.hp = Math.min(def.hp, s.hp + heal);
  }
}

/** Removes a structure from the world, freeing its tiles. */
export function destroyStructure(world: World, s: Structure, killed = true): void {
  if (s.dead) return;
  const def = structureDef(s.kind);
  s.dead = true;
  world.grid.vacate(s.tx, s.ty, def.w, def.h);
  world.markTilesDirty(s.tx, s.ty, def.w, def.h);
  if (killed) {
    world.players[s.side].stats.structuresLost++;
    const centre = world.structureCenter(s);
    world.events.push({
      type: "structureDestroyed",
      id: s.id,
      kind: s.kind,
      side: s.side,
      x: centre.x,
      y: centre.y,
    });
  }
}
