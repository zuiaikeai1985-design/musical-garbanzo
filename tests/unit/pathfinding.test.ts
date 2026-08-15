import { describe, expect, it } from "vitest";
import { Grid } from "../../src/engine/grid";
import { Pathfinder, nearestOpen, octile } from "../../src/engine/pathfinding";
import { TerrainKind } from "../../src/engine/types";

function open(width = 16, height = 16): Grid {
  return new Grid(width, height);
}

/** Total octile length of a path, starting from the given tile. */
function pathLength(path: { tx: number; ty: number }[], sx: number, sy: number): number {
  let total = 0;
  let cx = sx;
  let cy = sy;
  for (const p of path) {
    total += octile(cx, cy, p.tx, p.ty);
    cx = p.tx;
    cy = p.ty;
  }
  return total;
}

describe("Pathfinder", () => {
  it("returns an empty path when already at the goal", () => {
    const grid = open();
    const pf = new Pathfinder(grid);
    expect(pf.find(grid, 3, 3, 3, 3)).toEqual([]);
  });

  it("finds the optimal straight-line path on open ground", () => {
    const grid = open();
    const pf = new Pathfinder(grid);
    const path = pf.find(grid, 2, 2, 9, 2);
    expect(path).not.toBeNull();
    expect(path!.length).toBe(7);
    expect(path![path!.length - 1]).toEqual({ tx: 9, ty: 2 });
    expect(pathLength(path!, 2, 2)).toBeCloseTo(7, 5);
  });

  it("finds the optimal diagonal path", () => {
    const grid = open();
    const pf = new Pathfinder(grid);
    const path = pf.find(grid, 1, 1, 6, 6);
    expect(path!.length).toBe(5);
    expect(pathLength(path!, 1, 1)).toBeCloseTo(5 * Math.SQRT2, 5);
  });

  it("routes around a wall instead of through it", () => {
    const grid = open();
    // Vertical wall at x=5 spanning y=0..12, leaving a gap at the bottom.
    for (let y = 0; y <= 12; y++) grid.setTerrain(5, y, TerrainKind.Cliff);
    const pf = new Pathfinder(grid);
    const path = pf.find(grid, 2, 2, 9, 2);

    expect(path).not.toBeNull();
    expect(path!.some((p) => p.tx === 5 && p.ty <= 12)).toBe(false);
    expect(path![path!.length - 1]).toEqual({ tx: 9, ty: 2 });
    // Must detour below the wall, so it is meaningfully longer than the straight route.
    expect(path!.length).toBeGreaterThan(11);
  });

  it("never cuts a corner diagonally between two blocked tiles", () => {
    const grid = open();
    grid.setTerrain(3, 2, TerrainKind.Cliff);
    grid.setTerrain(2, 3, TerrainKind.Cliff);
    const pf = new Pathfinder(grid);
    const path = pf.find(grid, 2, 2, 3, 3);
    expect(path).not.toBeNull();
    // The direct diagonal step is illegal, so the route must be longer than one move.
    expect(path!.length).toBeGreaterThan(1);
  });

  it("returns a partial path toward a fully walled-off goal", () => {
    const grid = open();
    // Box the goal in completely.
    for (const [x, y] of [
      [9, 8],
      [9, 10],
      [8, 9],
      [10, 9],
      [8, 8],
      [10, 10],
      [8, 10],
      [10, 8],
    ]) {
      grid.setTerrain(x, y, TerrainKind.Cliff);
    }
    const pf = new Pathfinder(grid);
    const path = pf.find(grid, 1, 1, 9, 9, { allowPartial: true });
    expect(path).not.toBeNull();
    // It gets as close as it can without ever standing on a cliff.
    for (const p of path!) expect(grid.terrainPassable(p.tx, p.ty)).toBe(true);
  });

  it("returns null for a walled-off goal when partial paths are disabled", () => {
    const grid = open();
    for (let y = 0; y < 16; y++) grid.setTerrain(8, y, TerrainKind.Cliff);
    const pf = new Pathfinder(grid);
    expect(pf.find(grid, 1, 1, 12, 12, { allowPartial: false })).toBeNull();
  });

  it("relocates a goal that sits inside a structure", () => {
    const grid = open();
    grid.occupy(7, 7, 2, 2, 42);
    const pf = new Pathfinder(grid);
    const path = pf.find(grid, 1, 1, 7, 7, { goalRadius: 3 });
    expect(path).not.toBeNull();
    const last = path![path!.length - 1];
    expect(grid.structureIdAt(last.tx, last.ty)).toBe(0);
    expect(octile(last.tx, last.ty, 7, 7)).toBeLessThanOrEqual(3);
  });

  it("prefers roads over rough ground", () => {
    const grid = open(24, 8);
    for (let x = 0; x < 24; x++) {
      grid.setTerrain(x, 3, TerrainKind.Rough);
      grid.setTerrain(x, 4, TerrainKind.Road);
    }
    const pf = new Pathfinder(grid);
    const path = pf.find(grid, 0, 3, 20, 3);
    const roadTiles = path!.filter((p) => p.ty === 4).length;
    expect(roadTiles).toBeGreaterThan(10);
  });

  it("stays within its node budget on a large empty map", () => {
    const grid = open(96, 96);
    const pf = new Pathfinder(grid);
    const path = pf.find(grid, 1, 1, 94, 94);
    expect(path).not.toBeNull();
    expect(pf.lastNodesExpanded).toBeLessThan(6000);
  });

  it("is reusable across calls without leaking state", () => {
    const grid = open();
    const pf = new Pathfinder(grid);
    const a = pf.find(grid, 1, 1, 5, 5);
    const b = pf.find(grid, 1, 1, 5, 5);
    expect(b).toEqual(a);
  });
});

describe("nearestOpen", () => {
  it("returns the tile itself when it already qualifies", () => {
    const grid = open();
    expect(nearestOpen(grid, 4, 4, 3, () => true)).toEqual({ tx: 4, ty: 4 });
  });

  it("spirals outward to the closest qualifying tile", () => {
    const grid = open();
    const found = nearestOpen(grid, 4, 4, 5, (x, y) => x === 6 && y === 4);
    expect(found).toEqual({ tx: 6, ty: 4 });
  });

  it("gives up beyond the radius", () => {
    const grid = open();
    expect(nearestOpen(grid, 4, 4, 2, (x) => x === 15)).toBeNull();
  });
});
