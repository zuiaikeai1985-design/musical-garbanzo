import { structureDef, unitDef } from "../rules";
import type { Side } from "../types";
import { worldToTileX, worldToTileY } from "../util/vec";
import { Visibility, type World } from "../world";

/** Recompute cadence. Five ticks is six times a second — imperceptible, and a sixth of the cost. */
const SHROUD_INTERVAL = 5;

/**
 * Fog of war for the human player.
 *
 * Three states per tile: never seen (solid black), seen but not currently observed (dimmed, with
 * buildings remembered), and actively observed. Enemy units are only drawn in the third state,
 * which is what makes scouting and radar worth anything.
 */
export function shroudSystem(world: World): void {
  if (world.tick % SHROUD_INTERVAL !== 0) return;

  const vis = world.visibility;
  const side: Side = world.humanSide;

  // Everything currently observed decays to "remembered"; the sweep below re-lights what is
  // still in someone's line of sight.
  for (let i = 0; i < vis.length; i++) {
    if (vis[i] === Visibility.Visible) vis[i] = Visibility.Fogged;
  }

  for (const u of world.units) {
    if (u.side !== side || u.dead) continue;
    reveal(world, worldToTileX(u.x), worldToTileY(u.y), unitDef(u.kind).sight);
  }

  for (const s of world.structures) {
    if (s.side !== side || s.dead) continue;
    const def = structureDef(s.kind);
    reveal(
      world,
      s.tx + Math.floor(def.w / 2),
      s.ty + Math.floor(def.h / 2),
      def.sight + Math.max(def.w, def.h) / 2,
    );
  }

  // A projectile in flight briefly lights up where it is going, so artillery duels are readable.
  for (const p of world.projectiles) {
    if (p.side !== side || p.dead) continue;
    reveal(world, worldToTileX(p.x), worldToTileY(p.y), 2);
  }
}

function reveal(world: World, cx: number, cy: number, radius: number): void {
  const grid = world.grid;
  const vis = world.visibility;
  const r = Math.ceil(radius);
  const r2 = radius * radius;
  const minY = Math.max(0, cy - r);
  const maxY = Math.min(grid.height - 1, cy + r);
  const minX = Math.max(0, cx - r);
  const maxX = Math.min(grid.width - 1, cx + r);

  for (let ty = minY; ty <= maxY; ty++) {
    const dy = ty - cy;
    for (let tx = minX; tx <= maxX; tx++) {
      const dx = tx - cx;
      if (dx * dx + dy * dy > r2) continue;
      vis[ty * grid.width + tx] = Visibility.Visible;
    }
  }
}

/** Reveals the whole map — used by the result screen and by debug tooling. */
export function revealAll(world: World): void {
  world.visibility.fill(Visibility.Visible);
}

export function visibilityAtWorld(world: World, x: number, y: number): Visibility {
  const tx = worldToTileX(x);
  const ty = worldToTileY(y);
  if (!world.grid.inBounds(tx, ty)) return Visibility.Unexplored;
  return world.visibility[world.grid.index(tx, ty)] as Visibility;
}

/** Is this world position currently observed by the human player? */
export function isVisible(world: World, x: number, y: number): boolean {
  return visibilityAtWorld(world, x, y) === Visibility.Visible;
}

/** Has the human player ever seen this position? */
export function isExplored(world: World, x: number, y: number): boolean {
  return visibilityAtWorld(world, x, y) !== Visibility.Unexplored;
}

/** Tile-space variants used by the renderer's inner loops. */
export function tileVisibility(world: World, tx: number, ty: number): Visibility {
  if (!world.grid.inBounds(tx, ty)) return Visibility.Unexplored;
  return world.visibility[world.grid.index(tx, ty)] as Visibility;
}
