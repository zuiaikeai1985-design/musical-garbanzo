import { PATH_MAX_NODES } from "./constants";
import type { Grid } from "./grid";
import { MinHeap } from "./util/heap";
import type { TilePoint } from "./types";

const SQRT2 = Math.SQRT2;

/** 8-way neighbour offsets: the four cardinals first so ties prefer straight moves. */
const DX = [1, -1, 0, 0, 1, 1, -1, -1];
const DY = [0, 0, 1, -1, 1, -1, 1, -1];

export interface PathOptions {
  /**
   * When the goal tile itself is not passable (a structure, or a cliff), accept any tile within
   * this many tiles of it instead. Used for "attack that building" and "harvest that ore" orders.
   */
  goalRadius?: number;
  /**
   * Return the best partial path when the goal cannot be reached at all, instead of `null`.
   * This is what makes units behave sensibly when ordered into a walled-off area.
   */
  allowPartial?: boolean;
  /** Treat these tiles as passable even if a structure occupies them (e.g. the unit's own dock). */
  ignoreStructureId?: number;
}

/**
 * A* over the tile grid.
 *
 * Scratch buffers are retained between calls and invalidated with a generation stamp, so a search
 * costs no allocations beyond the returned path.
 */
export class Pathfinder {
  private gScore: Float32Array;
  private cameFrom: Int32Array;
  private stamp: Int32Array;
  private closed: Uint8Array;
  private generation = 0;
  private heap: MinHeap;
  private width: number;
  private height: number;

  /** Diagnostics — handy in tests and for a debug overlay. */
  lastNodesExpanded = 0;

  constructor(grid: Grid) {
    this.width = grid.width;
    this.height = grid.height;
    const n = grid.size;
    this.gScore = new Float32Array(n);
    this.cameFrom = new Int32Array(n);
    this.stamp = new Int32Array(n);
    this.closed = new Uint8Array(n);
    this.heap = new MinHeap(Math.max(64, n >> 2));
  }

  find(
    grid: Grid,
    startX: number,
    startY: number,
    goalX: number,
    goalY: number,
    opts: PathOptions = {},
  ): TilePoint[] | null {
    const { goalRadius = 0, allowPartial = true, ignoreStructureId = 0 } = opts;
    this.lastNodesExpanded = 0;

    if (!grid.inBounds(startX, startY) || !grid.inBounds(goalX, goalY)) return null;
    if (startX === goalX && startY === goalY) return [];

    const passable = (x: number, y: number): boolean => {
      if (!grid.terrainPassable(x, y)) return false;
      const occ = grid.structureAt[grid.index(x, y)];
      return occ === 0 || occ === ignoreStructureId;
    };

    // Resolve an unreachable goal (inside a building, in the sea) to the nearest open tile.
    let gx = goalX;
    let gy = goalY;
    if (!passable(gx, gy) || goalRadius > 0) {
      const relocated = nearestOpen(grid, goalX, goalY, Math.max(goalRadius, 1), passable);
      if (relocated) {
        gx = relocated.tx;
        gy = relocated.ty;
      } else if (!passable(gx, gy)) {
        return null;
      }
    }
    if (startX === gx && startY === gy) return [];

    const gen = ++this.generation;
    const heap = this.heap;
    heap.clear();

    const startIdx = grid.index(startX, startY);
    const goalIdx = grid.index(gx, gy);

    this.stamp[startIdx] = gen;
    this.gScore[startIdx] = 0;
    this.cameFrom[startIdx] = -1;
    this.closed[startIdx] = 0;
    heap.push(startIdx, octile(startX, startY, gx, gy));

    let bestIdx = startIdx;
    let bestH = octile(startX, startY, gx, gy);
    let expanded = 0;

    while (heap.length > 0) {
      const current = heap.pop();
      if (this.closed[current] === 1 && this.stamp[current] === gen) continue;
      this.closed[current] = 1;
      this.stamp[current] = gen;

      if (current === goalIdx) {
        this.lastNodesExpanded = expanded;
        return this.reconstruct(current, gen);
      }

      if (++expanded > PATH_MAX_NODES) break;

      const cx = current % this.width;
      const cy = (current / this.width) | 0;
      const currentG = this.gScore[current];

      for (let d = 0; d < 8; d++) {
        const nx = cx + DX[d];
        const ny = cy + DY[d];
        if (nx < 0 || ny < 0 || nx >= this.width || ny >= this.height) continue;
        if (!passable(nx, ny)) continue;

        // No cutting corners around blocked tiles.
        if (d >= 4 && (!passable(cx + DX[d], cy) || !passable(cx, cy + DY[d]))) continue;

        const step = (d >= 4 ? SQRT2 : 1) * grid.moveCost(nx, ny);
        const tentative = currentG + step;
        const ni = ny * this.width + nx;

        const seen = this.stamp[ni] === gen;
        if (seen && this.closed[ni] === 1) continue;
        if (seen && tentative >= this.gScore[ni]) continue;

        this.stamp[ni] = gen;
        this.closed[ni] = 0;
        this.gScore[ni] = tentative;
        this.cameFrom[ni] = current;

        const h = octile(nx, ny, gx, gy);
        if (h < bestH) {
          bestH = h;
          bestIdx = ni;
        }
        heap.push(ni, tentative + h * 1.02);
      }
    }

    this.lastNodesExpanded = expanded;
    if (allowPartial && bestIdx !== startIdx) return this.reconstruct(bestIdx, gen);
    return null;
  }

  private reconstruct(endIdx: number, gen: number): TilePoint[] {
    const out: TilePoint[] = [];
    let i = endIdx;
    let guard = 0;
    while (i >= 0 && guard++ < 1 << 16) {
      out.push({ tx: i % this.width, ty: (i / this.width) | 0 });
      if (this.stamp[i] !== gen) break;
      const prev = this.cameFrom[i];
      if (prev === i) break;
      i = prev;
    }
    out.pop(); // drop the start tile — the unit is already standing there
    out.reverse();
    return out;
  }
}

export function octile(ax: number, ay: number, bx: number, by: number): number {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);
  return dx > dy ? dx + (SQRT2 - 1) * dy : dy + (SQRT2 - 1) * dx;
}

/**
 * Spiral outward from (tx,ty) to find the closest tile satisfying `ok`.
 * Returns null when nothing is found inside `maxRadius`.
 */
export function nearestOpen(
  grid: Grid,
  tx: number,
  ty: number,
  maxRadius: number,
  ok: (x: number, y: number) => boolean,
): TilePoint | null {
  if (ok(tx, ty)) return { tx, ty };
  for (let r = 1; r <= maxRadius; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const x = tx + dx;
        const y = ty + dy;
        if (!grid.inBounds(x, y)) continue;
        if (ok(x, y)) return { tx: x, ty: y };
      }
    }
  }
  return null;
}
