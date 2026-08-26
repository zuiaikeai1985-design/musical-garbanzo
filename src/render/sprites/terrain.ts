import { MAX_ORE_DENSITY, TILE } from "../../engine/constants";
import { TerrainKind } from "../../engine/types";
import { hash01 } from "../../engine/util/rng";
import { bake, px, type Sprite } from "./canvas";
import { PAL } from "./palette";

export const TERRAIN_VARIANTS = 4;
export const ORE_STAGES = 4;

export interface TileSet {
  /** `terrain[kind][variant]` */
  terrain: Sprite[][];
  /** `ore[kindIndex][stage][variant]` where kindIndex 0 = ore, 1 = gems. */
  ore: Sprite[][][];
}

/** Speckles a tile with deterministic noise so large areas do not look flat. */
function speckle(
  ctx: CanvasRenderingContext2D,
  seed: number,
  count: number,
  colors: readonly string[],
  size = 1,
): void {
  for (let i = 0; i < count; i++) {
    const x = Math.floor(hash01(seed, i, 1) * TILE);
    const y = Math.floor(hash01(seed, i, 2) * TILE);
    const c = colors[Math.floor(hash01(seed, i, 3) * colors.length)];
    px(ctx, x, y, size, size, c);
  }
}

function grassTile(variant: number): Sprite {
  return bake(TILE, TILE, (ctx) => {
    px(ctx, 0, 0, TILE, TILE, PAL.grass1);
    speckle(ctx, 100 + variant, 40, [PAL.grass2, PAL.grass3]);
    // A few tufts.
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash01(200 + variant, i, 1) * (TILE - 3));
      const y = Math.floor(hash01(200 + variant, i, 2) * (TILE - 3));
      px(ctx, x, y, 1, 2, PAL.grass3);
      px(ctx, x + 1, y + 1, 1, 1, PAL.grass2);
    }
  });
}

function dirtTile(variant: number): Sprite {
  return bake(TILE, TILE, (ctx) => {
    px(ctx, 0, 0, TILE, TILE, PAL.dirt1);
    speckle(ctx, 300 + variant, 46, [PAL.dirt2, PAL.dirt3]);
    for (let i = 0; i < 2; i++) {
      const x = Math.floor(hash01(400 + variant, i, 1) * (TILE - 5));
      const y = Math.floor(hash01(400 + variant, i, 2) * (TILE - 3));
      px(ctx, x, y, 4, 2, PAL.dirt3);
    }
  });
}

function roughTile(variant: number): Sprite {
  return bake(TILE, TILE, (ctx) => {
    px(ctx, 0, 0, TILE, TILE, PAL.rough1);
    speckle(ctx, 500 + variant, 34, [PAL.rough2, PAL.dirt2]);
    // Scattered stones.
    for (let i = 0; i < 5; i++) {
      const x = Math.floor(hash01(600 + variant, i, 1) * (TILE - 4));
      const y = Math.floor(hash01(600 + variant, i, 2) * (TILE - 4));
      px(ctx, x, y, 3, 2, PAL.cliff2);
      px(ctx, x, y, 3, 1, PAL.concreteLite);
    }
  });
}

function roadTile(variant: number): Sprite {
  return bake(TILE, TILE, (ctx) => {
    px(ctx, 0, 0, TILE, TILE, PAL.road1);
    speckle(ctx, 700 + variant, 30, [PAL.road2, PAL.road3]);
    // Ruts worn by traffic.
    px(ctx, 0, 7, TILE, 1, PAL.road2);
    px(ctx, 0, 16, TILE, 1, PAL.road2);
    for (let i = 0; i < 3; i++) {
      const x = Math.floor(hash01(800 + variant, i, 1) * (TILE - 4));
      const y = Math.floor(hash01(800 + variant, i, 2) * (TILE - 2));
      px(ctx, x, y, 3, 1, PAL.road3);
    }
  });
}

function waterTile(variant: number): Sprite {
  return bake(TILE, TILE, (ctx) => {
    px(ctx, 0, 0, TILE, TILE, PAL.water1);
    speckle(ctx, 900 + variant, 26, [PAL.water2]);
    // Wave crests.
    for (let i = 0; i < 3; i++) {
      const y = 4 + i * 7 + Math.floor(hash01(950 + variant, i, 1) * 3);
      const x = Math.floor(hash01(950 + variant, i, 2) * (TILE - 8));
      px(ctx, x, y, 6, 1, PAL.water3);
      px(ctx, x + 2, y + 1, 3, 1, PAL.water2);
    }
  });
}

function beachTile(variant: number): Sprite {
  return bake(TILE, TILE, (ctx) => {
    px(ctx, 0, 0, TILE, TILE, PAL.beach1);
    speckle(ctx, 1000 + variant, 38, [PAL.beach2, PAL.dirt2]);
  });
}

function cliffTile(variant: number): Sprite {
  return bake(TILE, TILE, (ctx) => {
    px(ctx, 0, 0, TILE, TILE, PAL.cliff1);
    // Blocky rock facets with a consistent top-left light source.
    for (let i = 0; i < 6; i++) {
      const x = Math.floor(hash01(1100 + variant, i, 1) * (TILE - 8));
      const y = Math.floor(hash01(1100 + variant, i, 2) * (TILE - 8));
      const w = 5 + Math.floor(hash01(1100 + variant, i, 3) * 5);
      const h = 4 + Math.floor(hash01(1100 + variant, i, 4) * 5);
      px(ctx, x, y, w, h, PAL.cliff2);
      px(ctx, x, y, w, 1, PAL.concreteLite);
      px(ctx, x, y + h - 1, w, 1, PAL.cliff3);
    }
    speckle(ctx, 1200 + variant, 18, [PAL.cliff3]);
  });
}

const TERRAIN_BUILDERS: Record<number, (variant: number) => Sprite> = {
  [TerrainKind.Grass]: grassTile,
  [TerrainKind.Dirt]: dirtTile,
  [TerrainKind.Road]: roadTile,
  [TerrainKind.Rough]: roughTile,
  [TerrainKind.Water]: waterTile,
  [TerrainKind.Cliff]: cliffTile,
  [TerrainKind.Beach]: beachTile,
};

/** Ore/gem overlay: denser stages add more and brighter crystals. */
function oreTile(stage: number, variant: number, gem: boolean): Sprite {
  const shades = gem
    ? [PAL.gem1, PAL.gem2, PAL.gem3, PAL.gem4]
    : [PAL.ore1, PAL.ore2, PAL.ore3, PAL.ore4];
  const count = [5, 11, 18, 26][stage];
  return bake(TILE, TILE, (ctx) => {
    for (let i = 0; i < count; i++) {
      const x = Math.floor(hash01(1300 + variant * 7 + (gem ? 999 : 0), i, 1) * (TILE - 3));
      const y = Math.floor(hash01(1400 + variant * 7 + (gem ? 999 : 0), i, 2) * (TILE - 3));
      const bright = Math.min(3, stage + (hash01(1500 + variant, i, 3) > 0.6 ? 1 : 0));
      px(ctx, x, y, 2, 2, shades[Math.max(0, bright - 1)]);
      px(ctx, x, y, 1, 1, shades[bright]);
    }
  });
}

export function buildTileSet(): TileSet {
  const terrain: Sprite[][] = [];
  for (const kind of Object.values(TerrainKind)) {
    const builder = TERRAIN_BUILDERS[kind];
    terrain[kind] = Array.from({ length: TERRAIN_VARIANTS }, (_, v) => builder(v));
  }

  const ore: Sprite[][][] = [];
  for (let kindIndex = 0; kindIndex < 2; kindIndex++) {
    ore[kindIndex] = [];
    for (let stage = 0; stage < ORE_STAGES; stage++) {
      ore[kindIndex][stage] = Array.from({ length: TERRAIN_VARIANTS }, (_, v) =>
        oreTile(stage, v, kindIndex === 1),
      );
    }
  }

  return { terrain, ore };
}

/** Maps a raw ore density onto one of the four visual stages. */
export function oreStage(density: number): number {
  if (density <= 0) return -1;
  const t = density / MAX_ORE_DENSITY;
  if (t < 0.26) return 0;
  if (t < 0.51) return 1;
  if (t < 0.76) return 2;
  return 3;
}
