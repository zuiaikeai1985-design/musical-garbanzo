import { TILE } from "../constants";
import { unitDef } from "../rules";
import { UnitClass, type TilePoint, type Unit } from "../types";
import { clamp, dist, turnToward, worldToTileX, worldToTileY } from "../util/vec";
import type { World } from "../world";

/** How close (in world px) a unit must get to a waypoint before advancing to the next one. */
const WAYPOINT_EPS = TILE * 0.35;
/** Vehicles refuse to drive while more than this far off their heading. */
const VEHICLE_ALIGN = 0.7;
/** Ticks of being unable to make progress before we re-path. */
const STUCK_LIMIT = 20;

export type PathResult = "ok" | "budget" | "nopath";

/**
 * Asks for a path from the unit's current tile to (tx,ty).
 *
 * `"budget"` means the per-tick A* allowance ran out and the caller should simply retry next tick;
 * `"nopath"` means no route exists at all and the order should be abandoned.
 */
export function requestPath(
  world: World,
  u: Unit,
  tx: number,
  ty: number,
  opts: { goalRadius?: number; ignoreStructureId?: number } = {},
): PathResult {
  if (world.pathBudget <= 0) return "budget";
  world.pathBudget--;

  const sx = worldToTileX(u.x);
  const sy = worldToTileY(u.y);
  const path = world.pathfinder.find(world.grid, sx, sy, tx, ty, {
    goalRadius: opts.goalRadius ?? 0,
    allowPartial: true,
    ignoreStructureId: opts.ignoreStructureId ?? 0,
  });
  if (!path) {
    u.path = [];
    u.pathIndex = 0;
    return "nopath";
  }
  u.path = path;
  u.pathIndex = 0;
  u.blockedTicks = 0;
  return "ok";
}

export function clearPath(u: Unit): void {
  u.path = [];
  u.pathIndex = 0;
  u.blockedTicks = 0;
  u.pathPending = false;
  u.destTx = -1;
  u.destTy = -1;
}

/** Point the unit at a tile; the orders system will request the path on the next tick. */
export function setDestination(u: Unit, tx: number, ty: number): void {
  u.destTx = tx;
  u.destTy = ty;
  u.pathPending = true;
  u.path = [];
  u.pathIndex = 0;
  u.blockedTicks = 0;
}

export function pathDestination(u: Unit): TilePoint | null {
  if (u.path.length === 0) return null;
  return u.path[u.path.length - 1];
}

export function hasArrived(u: Unit): boolean {
  return !u.pathPending && u.pathIndex >= u.path.length;
}

/**
 * Advances every unit along its path and resolves unit-vs-unit overlap.
 *
 * Movement is deliberately split from order handling: other systems decide *where* a unit should
 * go (and call `requestPath`), this system only drives it there.
 */
export function movementSystem(world: World): void {
  const grid = world.grid;

  for (const u of world.units) {
    if (u.dead) continue;
    const def = unitDef(u.kind);
    if (u.pathIndex >= u.path.length) {
      // Nothing to follow; still allow turret/idle logic elsewhere.
      continue;
    }

    const wp = u.path[u.pathIndex];
    const targetX = wp.tx * TILE + TILE / 2;
    const targetY = wp.ty * TILE + TILE / 2;
    const dx = targetX - u.x;
    const dy = targetY - u.y;
    const d = Math.hypot(dx, dy);

    if (d <= WAYPOINT_EPS) {
      u.pathIndex++;
      u.blockedTicks = 0;
      continue;
    }

    const desired = Math.atan2(dy, dx);
    u.facing = turnToward(u.facing, desired, def.turnRate);

    // Vehicles have to be roughly pointed the right way before they roll.
    const misalign = Math.abs(angleGap(u.facing, desired));
    const canDrive = def.cls === UnitClass.Infantry || misalign < VEHICLE_ALIGN;
    if (!canDrive) continue;

    // Slow down through tight turns so units do not orbit their waypoints.
    const speed = def.speed * (def.cls === UnitClass.Infantry ? 1 : clamp(1 - misalign * 0.6, 0.3, 1));
    const step = Math.min(speed, d);
    const nx = u.x + Math.cos(u.facing) * step;
    const ny = u.y + Math.sin(u.facing) * step;

    if (canOccupy(world, u, nx, ny)) {
      u.x = nx;
      u.y = ny;
      u.blockedTicks = 0;
    } else {
      u.blockedTicks++;
      // Try sliding along one axis before declaring ourselves stuck.
      if (canOccupy(world, u, nx, u.y)) {
        u.x = nx;
      } else if (canOccupy(world, u, u.x, ny)) {
        u.y = ny;
      }
      if (u.blockedTicks > STUCK_LIMIT) {
        u.blockedTicks = 0;
        if (u.destTx >= 0 && u.repathCooldown <= 0) {
          u.repathCooldown = 20;
          u.pathPending = true;
          u.path = [];
          u.pathIndex = 0;
        } else if (u.repathCooldown <= 0) {
          clearPath(u);
        }
      }
    }
  }

  separateUnits(world);

  // Refresh tile occupancy for the next tick's path costs.
  grid.clearUnitCounts();
  for (const u of world.units) {
    if (u.dead) continue;
    grid.addUnitCount(worldToTileX(u.x), worldToTileY(u.y));
    if (u.repathCooldown > 0) u.repathCooldown--;
  }
}

function angleGap(a: number, b: number): number {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Terrain/structure test at a prospective position. */
function canOccupy(world: World, u: Unit, x: number, y: number): boolean {
  const grid = world.grid;
  const r = unitDef(u.kind).radius * 0.7;
  // Sample the unit's bounding box corners so it cannot clip through a wall diagonally.
  const points = [
    [x - r, y - r],
    [x + r, y - r],
    [x - r, y + r],
    [x + r, y + r],
  ];
  for (const [px, py] of points) {
    const tx = worldToTileX(px);
    const ty = worldToTileY(py);
    if (!grid.inBounds(tx, ty)) return false;
    if (!grid.terrainPassable(tx, ty)) return false;
    const occupant = grid.structureIdAt(tx, ty);
    if (occupant !== 0) return false;
  }
  return true;
}

/**
 * Soft body separation: overlapping units nudge each other apart. This is what stops a 12-tank
 * move order from collapsing all twelve units onto a single pixel.
 */
function separateUnits(world: World): void {
  const hash = world.unitHash;
  hash.clear();
  for (const u of world.units) {
    if (u.dead) continue;
    hash.insert(u.id, u.x, u.y);
  }

  for (const a of world.units) {
    if (a.dead) continue;
    const ra = unitDef(a.kind).radius;
    let pushX = 0;
    let pushY = 0;

    hash.query(a.x, a.y, ra * 2 + 16, (id) => {
      if (id === a.id) return;
      const b = world.unitById.get(id);
      if (!b || b.dead) return;
      const rb = unitDef(b.kind).radius;
      const minDist = ra + rb;
      const dx = a.x - b.x;
      const dy = a.y - b.y;
      const d2 = dx * dx + dy * dy;
      if (d2 >= minDist * minDist) return;
      const d = Math.sqrt(d2);
      if (d < 0.0001) {
        // Perfectly stacked: break the tie deterministically by id.
        const angle = (a.id % 360) * (Math.PI / 180);
        pushX += Math.cos(angle) * 0.5;
        pushY += Math.sin(angle) * 0.5;
        return;
      }
      const overlap = (minDist - d) * 0.5;
      pushX += (dx / d) * overlap;
      pushY += (dy / d) * overlap;
    });

    if (pushX !== 0 || pushY !== 0) {
      const mag = Math.hypot(pushX, pushY);
      const maxPush = 1.2;
      if (mag > maxPush) {
        pushX = (pushX / mag) * maxPush;
        pushY = (pushY / mag) * maxPush;
      }
      const nx = a.x + pushX;
      const ny = a.y + pushY;
      if (canOccupy(world, a, nx, ny)) {
        a.x = nx;
        a.y = ny;
      }
    }
  }
}

/** Distance between two entities' centres, used all over the combat code. */
export function entityDistance(world: World, aId: number, bId: number): number {
  const a = world.entity(aId);
  const b = world.entity(bId);
  if (!a || !b) return Infinity;
  const pa = world.entityCenter(a);
  const pb = world.entityCenter(b);
  return dist(pa.x, pa.y, pb.x, pb.y);
}
