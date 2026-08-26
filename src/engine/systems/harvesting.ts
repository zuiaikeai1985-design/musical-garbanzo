import {
  GEM_VALUE,
  HARVEST_TICKS_PER_SCOOP,
  MAX_ORE_DENSITY,
  ORE_VALUE,
  TILE,
  UNLOAD_TICKS_PER_SCOOP,
} from "../constants";
import { structureDef, unitDef } from "../rules";
import { HarvestState, OreKind, type Structure, type Unit } from "../types";
import { dist, tileToWorldX, tileToWorldY, worldToTileX, worldToTileY } from "../util/vec";
import type { World } from "../world";
import { clearPath, hasArrived, setDestination } from "./movement";

/** How far a harvester will wander looking for a fresh patch, in tiles. */
const ORE_SEARCH_RADIUS = 34;
/** Distance (world px) at which a harvester counts as parked on its ore tile / dock. */
const ARRIVE_EPS = TILE * 0.7;
/** Play the money-counter blip every N scoops unloaded. */
const TICK_SOUND_EVERY = 2;

/**
 * The ore economy: harvesters seek ore, mine it tile by tile, drive it home and unload it into a
 * refinery, which converts it to credits.
 *
 * Written as an explicit state machine on the unit rather than as orders, because harvesting is a
 * loop the unit re-enters forever — expressing that as a chain of orders would need a scheduler
 * anyway, and this keeps the behaviour inspectable in the headless tests.
 */
export function harvestingSystem(world: World): void {
  for (const u of world.units) {
    if (u.dead) continue;
    const def = unitDef(u.kind);
    if (def.cargoCapacity <= 0) continue;

    // Player orders take priority and re-enter the loop at the right state.
    if (u.order.type === "harvest") {
      u.oreTx = u.order.tx;
      u.oreTy = u.order.ty;
      u.harvestState = u.cargo >= def.cargoCapacity ? HarvestState.Returning : HarvestState.Seeking;
      u.order = { type: "guard" };
    } else if (u.order.type === "deliver") {
      u.homeRefinery = u.order.refineryId;
      u.harvestState = HarvestState.Returning;
      u.order = { type: "guard" };
      clearPath(u);
    } else if (u.order.type === "move" || u.order.type === "attackMove") {
      // A manual move order suspends harvesting until the unit arrives.
      continue;
    }

    switch (u.harvestState) {
      case HarvestState.Seeking:
        seek(world, u);
        break;
      case HarvestState.Harvesting:
        harvest(world, u, def.cargoCapacity);
        break;
      case HarvestState.Returning:
        returnHome(world, u);
        break;
      case HarvestState.Unloading:
        unload(world, u);
        break;
    }
  }

  oreRegrowth(world);
}

// ── States ──────────────────────────────────────────────────────────────────

function seek(world: World, u: Unit): void {
  const grid = world.grid;

  // Validate the claimed tile; find a new one if it has run dry.
  if (u.oreTx < 0 || grid.getOre(u.oreTx, u.oreTy) <= 0) {
    const patch = findOre(world, u);
    if (!patch) {
      // Nothing left to mine: park, but keep whatever is already aboard heading home.
      if (u.cargo > 0) u.harvestState = HarvestState.Returning;
      return;
    }
    u.oreTx = patch.tx;
    u.oreTy = patch.ty;
    setDestination(u, patch.tx, patch.ty);
  }

  const target = { x: tileToWorldX(u.oreTx), y: tileToWorldY(u.oreTy) };
  if (dist(u.x, u.y, target.x, target.y) <= ARRIVE_EPS) {
    clearPath(u);
    u.harvestState = HarvestState.Harvesting;
    u.actionTimer = HARVEST_TICKS_PER_SCOOP;
    return;
  }

  // Keep walking; re-issue the path if the unit somehow lost it.
  if (hasArrived(u) && !u.pathPending) {
    setDestination(u, u.oreTx, u.oreTy);
  }
}

function harvest(world: World, u: Unit, capacity: number): void {
  if (u.actionTimer > 0) {
    u.actionTimer--;
    return;
  }

  const kind = world.grid.takeOre(u.oreTx, u.oreTy);
  if (kind === OreKind.None) {
    // This tile is exhausted; try an immediate neighbour before walking away.
    const next = findAdjacentOre(world, u.oreTx, u.oreTy);
    if (next) {
      u.oreTx = next.tx;
      u.oreTy = next.ty;
      u.actionTimer = HARVEST_TICKS_PER_SCOOP;
    } else {
      u.oreTx = -1;
      u.harvestState = u.cargo > 0 ? HarvestState.Returning : HarvestState.Seeking;
    }
    return;
  }

  world.markTilesDirty(u.oreTx, u.oreTy);
  u.cargo++;
  u.cargoKind = u.cargoKind === OreKind.Gem ? OreKind.Gem : kind;
  u.actionTimer = HARVEST_TICKS_PER_SCOOP;
  world.emitSound("harvest", u.x, u.y, u.side);

  if (u.cargo >= capacity) {
    u.harvestState = HarvestState.Returning;
  }
}

function returnHome(world: World, u: Unit): void {
  let refinery = world.structure(u.homeRefinery);
  if (!refinery || refinery.dead || refinery.side !== u.side) {
    refinery = findRefinery(world, u) ?? undefined;
    u.homeRefinery = refinery?.id ?? 0;
  }
  if (!refinery) {
    // Nowhere to deliver; sit on the cargo until a refinery exists again.
    clearPath(u);
    return;
  }

  const dock = dockPoint(world, refinery);
  if (dist(u.x, u.y, dock.x, dock.y) <= ARRIVE_EPS) {
    clearPath(u);
    u.x = dock.x;
    u.y = dock.y;
    u.harvestState = HarvestState.Unloading;
    u.actionTimer = UNLOAD_TICKS_PER_SCOOP;
    refinery.dockedUnit = u.id;
    return;
  }

  const destTx = worldToTileX(dock.x);
  const destTy = worldToTileY(dock.y);
  if ((u.destTx !== destTx || u.destTy !== destTy) && !u.pathPending) {
    setDestination(u, destTx, destTy);
  } else if (hasArrived(u) && !u.pathPending) {
    setDestination(u, destTx, destTy);
  }
}

function unload(world: World, u: Unit): void {
  const refinery = world.structure(u.homeRefinery);
  if (!refinery || refinery.dead) {
    u.harvestState = HarvestState.Returning;
    return;
  }

  if (u.actionTimer > 0) {
    u.actionTimer--;
    return;
  }

  if (u.cargo <= 0) {
    refinery.dockedUnit = 0;
    u.cargoKind = OreKind.None;
    u.harvestState = HarvestState.Seeking;
    return;
  }

  const value = u.cargoKind === OreKind.Gem ? GEM_VALUE : ORE_VALUE;
  const banked = world.addCredits(u.side, value);
  world.players[u.side].stats.oreHarvested += value;
  u.cargo--;
  u.actionTimer = UNLOAD_TICKS_PER_SCOOP;

  if (banked < value) {
    // Storage is full — the overflow is simply lost, as in the original.
    world.emitEva("silosNeeded", u.side, u.x, u.y);
  } else if (u.cargo % TICK_SOUND_EVERY === 0) {
    world.emitSound("creditTick", u.x, u.y, u.side);
  }
}

// ── Queries ─────────────────────────────────────────────────────────────────

/** World-space spot a harvester parks on to unload. */
export function dockPoint(world: World, refinery: Structure): { x: number; y: number } {
  const def = structureDef(refinery.kind);
  const exit = def.exit ?? { tx: def.w, ty: Math.floor(def.h / 2) };
  const tx = refinery.tx + exit.tx;
  const ty = refinery.ty + exit.ty;
  if (world.grid.inBounds(tx, ty) && world.grid.passable(tx, ty)) {
    return { x: tileToWorldX(tx), y: tileToWorldY(ty) };
  }
  // Fall back to just south of the building if the designated dock is blocked.
  return {
    x: tileToWorldX(refinery.tx + Math.floor(def.w / 2)),
    y: tileToWorldY(refinery.ty + def.h),
  };
}

export function findRefinery(world: World, u: Unit): Structure | null {
  let best: Structure | null = null;
  let bestDist = Infinity;
  for (const s of world.structures) {
    if (s.side !== u.side || s.dead || s.buildProgress < 1) continue;
    if (!structureDef(s.kind).isRefinery) continue;
    const c = world.structureCenter(s);
    const d = dist(u.x, u.y, c.x, c.y);
    // Prefer a free refinery, but a busy one is better than none.
    const penalty = s.dockedUnit !== 0 && s.dockedUnit !== u.id ? TILE * 12 : 0;
    if (d + penalty < bestDist) {
      bestDist = d + penalty;
      best = s;
    }
  }
  return best;
}

/**
 * Spiral outward from the harvester for the nearest unclaimed ore tile.
 *
 * Only runs when a harvester needs a new patch (a few times a minute per unit), so the linear
 * scan is cheap; claiming stops every harvester from converging on the same tile.
 */
function findOre(world: World, u: Unit): { tx: number; ty: number } | null {
  const grid = world.grid;
  const originX = worldToTileX(u.x);
  const originY = worldToTileY(u.y);

  const claimed = new Set<number>();
  for (const other of world.units) {
    if (other === u || other.dead || other.oreTx < 0) continue;
    if (unitDef(other.kind).cargoCapacity <= 0) continue;
    claimed.add(grid.index(other.oreTx, other.oreTy));
  }

  for (let r = 0; r <= ORE_SEARCH_RADIUS; r++) {
    let bestTile: { tx: number; ty: number } | null = null;
    let bestDensity = 0;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = originX + dx;
        const ty = originY + dy;
        if (!grid.inBounds(tx, ty)) continue;
        const density = grid.getOre(tx, ty);
        if (density <= 0) continue;
        if (claimed.has(grid.index(tx, ty))) continue;
        if (!grid.passable(tx, ty)) continue;
        // Within a ring, prefer the richest tile.
        if (density > bestDensity) {
          bestDensity = density;
          bestTile = { tx, ty };
        }
      }
    }
    if (bestTile) return bestTile;
  }
  return null;
}

function findAdjacentOre(world: World, tx: number, ty: number): { tx: number; ty: number } | null {
  const grid = world.grid;
  let best: { tx: number; ty: number } | null = null;
  let bestDensity = 0;
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      if (dx === 0 && dy === 0) continue;
      const nx = tx + dx;
      const ny = ty + dy;
      const density = grid.getOre(nx, ny);
      if (density > bestDensity && grid.passable(nx, ny)) {
        bestDensity = density;
        best = { tx: nx, ty: ny };
      }
    }
  }
  return best;
}

// ── Ore regrowth ────────────────────────────────────────────────────────────

/** Ticks between regrowth passes. */
const REGROW_INTERVAL = 30;
/** Fraction of the existing ore tiles considered on each pass. */
const REGROW_SAMPLE_FRACTION = 0.25;
const REGROW_MIN_SAMPLES = 24;

/**
 * Ore slowly thickens and spreads, exactly like the original.
 *
 * Without it a long match starves: both economies die once the starting fields are mined out and
 * the game degenerates into a stalemate between two broke armies.
 *
 * Sampling walks the grid's ore index rather than random map tiles — ore covers well under 20% of
 * the map, so random sampling would waste almost every draw and spread far too slowly.
 */
function oreRegrowth(world: World): void {
  if (world.tick % REGROW_INTERVAL !== 0) return;
  const grid = world.grid;
  const tiles = grid.oreTileIndices();
  if (tiles.length === 0) return;

  const samples = Math.max(REGROW_MIN_SAMPLES, Math.floor(tiles.length * REGROW_SAMPLE_FRACTION));
  for (let i = 0; i < samples; i++) {
    const index = tiles[world.rng.int(0, tiles.length - 1)];
    const density = grid.ore[index];
    if (density <= 0) continue;
    const tx = index % grid.width;
    const ty = (index / grid.width) | 0;

    if (density < MAX_ORE_DENSITY && world.rng.chance(0.3)) {
      grid.addOre(tx, ty, 1);
      world.markTilesDirty(tx, ty);
    }

    // Mature tiles seed their neighbours.
    if (grid.ore[index] >= MAX_ORE_DENSITY - 4 && world.rng.chance(0.22)) {
      const nx = tx + world.rng.int(-1, 1);
      const ny = ty + world.rng.int(-1, 1);
      if (!grid.inBounds(nx, ny)) continue;
      if (grid.getOre(nx, ny) > 0) continue;
      if (!grid.terrainPassable(nx, ny)) continue;
      if (grid.structureIdAt(nx, ny) !== 0) continue;
      grid.setOre(nx, ny, grid.oreKind[index] as OreKind, 1);
      world.markTilesDirty(nx, ny);
    }
  }
}
