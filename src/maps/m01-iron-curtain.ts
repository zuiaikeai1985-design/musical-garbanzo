import { MAX_ORE_DENSITY } from "../engine/constants";
import { OreKind, TerrainKind, type Side } from "../engine/types";
import { Rng } from "../engine/util/rng";
import { tileToWorldX, tileToWorldY } from "../engine/util/vec";
import type { World } from "../engine/world";
import type { MissionDef } from "./types";

const W = 72;
const H = 72;

/** Soviet (player) base sits bottom-left; the Allied AI holds the north-east. */
const SOVIET_BASE = { tx: 9, ty: 54 };
const ALLIED_BASE = { tx: 54, ty: 9 };

export const m01IronCurtain: MissionDef = {
  id: "m01",
  width: W,
  height: H,
  seed: 0x5ed01,
  startCredits: { soviet: 5000, allied: 5000 },
  cameraStart: { tx: SOVIET_BASE.tx - 4, ty: SOVIET_BASE.ty - 6 },
  ai: {
    incomeMultiplier: 1,
    // The first wave lands around the two-and-a-half minute mark, which is long enough for the
    // player to get a refinery and a barracks up but short enough to keep the pressure on.
    waveInterval: 150 * 30,
    minWaveInterval: 50 * 30,
    firstWaveStrength: 1100,
    waveStrengthGrowth: 450,
    maxHarvesters: 3,
  },
  build(world: World) {
    const rng = new Rng(world.rng.getState() ^ 0xa11ed);
    paintTerrain(world, rng);
    carveRiver(world);
    scatterCliffs(world, rng);
    layRoads(world);
    placeOreFields(world, rng);
    placeStartingBases(world);
  },
};

// ── Terrain painting ────────────────────────────────────────────────────────

/** Cheap deterministic value noise — enough to break up flat ground into believable patches. */
function valueNoise(rng: Rng, width: number, height: number, scale: number): Float32Array {
  const gw = Math.ceil(width / scale) + 2;
  const gh = Math.ceil(height / scale) + 2;
  const lattice = new Float32Array(gw * gh);
  for (let i = 0; i < lattice.length; i++) lattice[i] = rng.next();

  const out = new Float32Array(width * height);
  for (let y = 0; y < height; y++) {
    const gy = y / scale;
    const y0 = Math.floor(gy);
    const fy = smoothstep(gy - y0);
    for (let x = 0; x < width; x++) {
      const gx = x / scale;
      const x0 = Math.floor(gx);
      const fx = smoothstep(gx - x0);
      const a = lattice[y0 * gw + x0];
      const b = lattice[y0 * gw + x0 + 1];
      const c = lattice[(y0 + 1) * gw + x0];
      const d = lattice[(y0 + 1) * gw + x0 + 1];
      out[y * width + x] = lerp(lerp(a, b, fx), lerp(c, d, fx), fy);
    }
  }
  return out;
}

function smoothstep(t: number): number {
  return t * t * (3 - 2 * t);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

function paintTerrain(world: World, rng: Rng): void {
  const grid = world.grid;
  const dirt = valueNoise(rng, W, H, 7);
  const rough = valueNoise(rng, W, H, 4);

  for (let ty = 0; ty < H; ty++) {
    for (let tx = 0; tx < W; tx++) {
      const i = grid.index(tx, ty);
      const d = dirt[i];
      const r = rough[i];
      let kind: TerrainKind = TerrainKind.Grass;
      if (d > 0.62) kind = TerrainKind.Dirt;
      if (r > 0.78) kind = TerrainKind.Rough;
      grid.terrain[i] = kind;
      grid.variant[i] = rng.int(0, 3);
    }
  }
}

/**
 * A river entering from the north edge and widening into a lake in the middle of the map.
 * It deliberately stops short of the south edge so there is always a land route between the
 * bases — a hard chokepoint would make harvesters far too easy to strand.
 */
function carveRiver(world: World): void {
  const grid = world.grid;
  for (let ty = 0; ty < 46; ty++) {
    const centre = 34 + Math.sin(ty * 0.16) * 7 + Math.sin(ty * 0.05) * 4;
    const halfWidth = ty < 34 ? 2 : 2 + (ty - 34) * 0.32;
    for (let tx = 0; tx < W; tx++) {
      const d = Math.abs(tx - centre);
      if (d <= halfWidth) {
        grid.setTerrain(tx, ty, TerrainKind.Water);
      } else if (d <= halfWidth + 1.2) {
        grid.setTerrain(tx, ty, TerrainKind.Beach);
      }
    }
  }
}

function scatterCliffs(world: World, rng: Rng): void {
  const grid = world.grid;
  const ridges = [
    { tx: 22, ty: 24, len: 9, dx: 1, dy: 0 },
    { tx: 46, ty: 40, len: 8, dx: 0, dy: 1 },
    { tx: 14, ty: 34, len: 7, dx: 1, dy: 1 },
    { tx: 56, ty: 30, len: 6, dx: 1, dy: 0 },
    { tx: 30, ty: 58, len: 8, dx: 1, dy: 0 },
  ];
  for (const ridge of ridges) {
    for (let i = 0; i < ridge.len; i++) {
      const tx = ridge.tx + ridge.dx * i;
      const ty = ridge.ty + ridge.dy * i;
      const thickness = rng.int(1, 2);
      for (let t = 0; t < thickness; t++) {
        const px = tx + (ridge.dy ? t : 0);
        const py = ty + (ridge.dx ? t : 0);
        if (!grid.inBounds(px, py)) continue;
        if (grid.getTerrain(px, py) === TerrainKind.Water) continue;
        grid.setTerrain(px, py, TerrainKind.Cliff);
      }
    }
  }
}

/** A dirt road linking the two bases, crossing the river on a bridge. */
function layRoads(world: World): void {
  const grid = world.grid;
  const bridgeY = 40;

  const paint = (tx: number, ty: number) => {
    if (!grid.inBounds(tx, ty)) return;
    grid.setTerrain(tx, ty, TerrainKind.Road);
  };

  // South road from the Soviet base heading east.
  for (let tx = SOVIET_BASE.tx + 2; tx <= 62; tx++) paint(tx, 60);
  // North road heading toward the Allied base.
  for (let ty = 12; ty <= 60; ty++) paint(62, ty);
  for (let tx = ALLIED_BASE.tx + 2; tx <= 62; tx++) paint(tx, 12);

  // A bridge across the river so the northern half stays reachable.
  for (let tx = 20; tx <= 52; tx++) {
    for (let d = 0; d < 3; d++) paint(tx, bridgeY + d);
  }
  // Feed roads into the bridge.
  for (let ty = bridgeY; ty <= 60; ty++) paint(30, ty);
  for (let ty = 12; ty <= bridgeY; ty++) paint(48, ty);
}

// ── Ore ─────────────────────────────────────────────────────────────────────

interface OreField {
  tx: number;
  ty: number;
  radius: number;
  kind: OreKind;
}

const ORE_FIELDS: readonly OreField[] = [
  // Soviet (player) side of the map.
  { tx: 16, ty: 46, radius: 7, kind: OreKind.Ore },
  { tx: 5, ty: 43, radius: 6, kind: OreKind.Ore },
  { tx: 20, ty: 64, radius: 6, kind: OreKind.Ore },
  { tx: 8, ty: 30, radius: 6, kind: OreKind.Ore },
  // Allied (AI) side.
  { tx: 60, ty: 20, radius: 7, kind: OreKind.Ore },
  { tx: 65, ty: 36, radius: 6, kind: OreKind.Ore },
  { tx: 46, ty: 5, radius: 6, kind: OreKind.Ore },
  { tx: 63, ty: 6, radius: 5, kind: OreKind.Ore },
  // Contested high-value fields in the middle — worth fighting over.
  { tx: 36, ty: 56, radius: 6, kind: OreKind.Gem },
  { tx: 26, ty: 17, radius: 5, kind: OreKind.Gem },
  { tx: 44, ty: 30, radius: 5, kind: OreKind.Ore },
];

function placeOreFields(world: World, rng: Rng): void {
  const grid = world.grid;
  for (const field of ORE_FIELDS) {
    for (let dy = -field.radius; dy <= field.radius; dy++) {
      for (let dx = -field.radius; dx <= field.radius; dx++) {
        const tx = field.tx + dx;
        const ty = field.ty + dy;
        if (!grid.inBounds(tx, ty)) continue;
        const d = Math.hypot(dx, dy);
        if (d > field.radius) continue;
        if (!grid.terrainPassable(tx, ty)) continue;
        if (grid.getTerrain(tx, ty) === TerrainKind.Road) continue;
        // Feather the edges so fields do not look like perfect discs.
        const falloff = 1 - d / field.radius;
        if (rng.next() > falloff * 2.2) continue;
        const density = Math.max(
          4,
          Math.round(MAX_ORE_DENSITY * (0.55 + falloff * 0.45) * rng.range(0.85, 1)),
        );
        grid.setOre(tx, ty, field.kind, density);
      }
    }
  }
}

// ── Starting bases ──────────────────────────────────────────────────────────

/** Clears a rectangle of cliffs/ore so a base can be placed on it no matter what the noise did. */
function flatten(world: World, tx: number, ty: number, w: number, h: number): void {
  const grid = world.grid;
  for (let y = ty; y < ty + h; y++) {
    for (let x = tx; x < tx + w; x++) {
      if (!grid.inBounds(x, y)) continue;
      const t = grid.getTerrain(x, y);
      if (t === TerrainKind.Cliff || t === TerrainKind.Water || t === TerrainKind.Beach) {
        grid.setTerrain(x, y, TerrainKind.Dirt);
      }
      grid.setOre(x, y, OreKind.None, 0);
    }
  }
}

function placeStartingBases(world: World): void {
  buildBase(world, "soviet", SOVIET_BASE.tx, SOVIET_BASE.ty);
  buildBase(world, "allied", ALLIED_BASE.tx, ALLIED_BASE.ty);
}

function buildBase(world: World, side: Side, bx: number, by: number): void {
  const soviet = side === "soviet";
  flatten(world, bx - 3, by - 3, 16, 14);

  const conyard = soviet ? "conyard" : "conyard_a";
  const power = soviet ? "power" : "power_a";
  const refinery = soviet ? "refinery" : "refinery_a";

  world.spawnStructure(conyard, side, bx, by, true);
  world.spawnStructure(power, side, bx + 4, by, true);
  world.spawnStructure(power, side, bx + 4, by + 3, true);
  const ref = world.spawnStructure(refinery, side, bx, by + 4, true);

  // Every refinery arrives with a harvester, exactly like the original.
  if (ref) {
    const harvKind = soviet ? "harv" : "harva";
    const hx = tileToWorldX(bx + 3);
    const hy = tileToWorldY(by + 6);
    const harvester = world.spawnUnit(harvKind, side, hx, hy, soviet ? 0 : Math.PI);
    harvester.homeRefinery = ref.id;
  }

  // A small starting escort.
  const infantryKind = soviet ? "e1" : "e1a";
  for (let i = 0; i < 3; i++) {
    world.spawnUnit(
      infantryKind,
      side,
      tileToWorldX(bx + 7 + i),
      tileToWorldY(by + 7),
      soviet ? -Math.PI / 4 : (Math.PI * 3) / 4,
    );
  }

  if (!soviet) {
    // The AI starts with a light defensive presence so an early rush is not a free win.
    world.spawnStructure("pillbox", side, bx - 2, by + 2, true);
    world.spawnStructure("pillbox", side, bx + 8, by + 6, true);
  }
}
