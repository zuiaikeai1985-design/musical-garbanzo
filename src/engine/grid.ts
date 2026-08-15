import { MAX_ORE_DENSITY, TILE } from "./constants";
import { OreKind, TerrainKind, type EntityId } from "./types";

/**
 * The tile map, stored as a struct-of-arrays so the hot loops (pathfinding, rendering, ore
 * depletion) stay cache friendly and allocation free.
 */
export class Grid {
  readonly width: number;
  readonly height: number;

  /** Base terrain type per tile. */
  readonly terrain: Uint8Array;
  /** Ore density 0..MAX_ORE_DENSITY. */
  readonly ore: Uint8Array;
  /** Which kind of ore overlay sits on the tile. */
  readonly oreKind: Uint8Array;
  /** Stable per-tile art variant so terrain rendering is deterministic. */
  readonly variant: Uint8Array;
  /** Structure entity id occupying the tile, or 0. */
  readonly structureAt: Int32Array;
  /** Number of units currently standing on the tile — used as a soft path cost. */
  readonly unitCount: Uint8Array;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    const n = width * height;
    this.terrain = new Uint8Array(n);
    this.ore = new Uint8Array(n);
    this.oreKind = new Uint8Array(n);
    this.variant = new Uint8Array(n);
    this.structureAt = new Int32Array(n);
    this.unitCount = new Uint8Array(n);
  }

  get size(): number {
    return this.width * this.height;
  }

  index(tx: number, ty: number): number {
    return ty * this.width + tx;
  }

  inBounds(tx: number, ty: number): boolean {
    return tx >= 0 && ty >= 0 && tx < this.width && ty < this.height;
  }

  /** Is the tile's base terrain walkable, ignoring structures and units? */
  terrainPassable(tx: number, ty: number): boolean {
    if (!this.inBounds(tx, ty)) return false;
    const t = this.terrain[this.index(tx, ty)];
    return t !== TerrainKind.Water && t !== TerrainKind.Cliff;
  }

  /** Can a ground unit occupy this tile right now? */
  passable(tx: number, ty: number): boolean {
    if (!this.terrainPassable(tx, ty)) return false;
    return this.structureAt[this.index(tx, ty)] === 0;
  }

  /** Movement cost multiplier for the tile (roads are fast, rough ground is slow). */
  moveCost(tx: number, ty: number): number {
    const i = this.index(tx, ty);
    let cost: number;
    switch (this.terrain[i]) {
      case TerrainKind.Road:
        cost = 0.75;
        break;
      case TerrainKind.Rough:
        cost = 1.4;
        break;
      case TerrainKind.Beach:
        cost = 1.2;
        break;
      default:
        cost = 1;
    }
    // Discourage — but do not forbid — driving through a traffic jam.
    cost += this.unitCount[i] * 0.35;
    return cost;
  }

  setTerrain(tx: number, ty: number, kind: TerrainKind): void {
    this.terrain[this.index(tx, ty)] = kind;
  }

  getTerrain(tx: number, ty: number): TerrainKind {
    return this.terrain[this.index(tx, ty)] as TerrainKind;
  }

  setOre(tx: number, ty: number, kind: OreKind, density: number): void {
    const i = this.index(tx, ty);
    this.oreKind[i] = kind;
    this.ore[i] = Math.max(0, Math.min(MAX_ORE_DENSITY, density));
    if (this.ore[i] === 0) this.oreKind[i] = OreKind.None;
  }

  getOre(tx: number, ty: number): number {
    if (!this.inBounds(tx, ty)) return 0;
    return this.ore[this.index(tx, ty)];
  }

  getOreKind(tx: number, ty: number): OreKind {
    if (!this.inBounds(tx, ty)) return OreKind.None;
    return this.oreKind[this.index(tx, ty)] as OreKind;
  }

  /** Removes one scoop; returns the kind harvested (or None when the tile was empty). */
  takeOre(tx: number, ty: number): OreKind {
    if (!this.inBounds(tx, ty)) return OreKind.None;
    const i = this.index(tx, ty);
    if (this.ore[i] === 0) return OreKind.None;
    const kind = this.oreKind[i] as OreKind;
    this.ore[i]--;
    if (this.ore[i] === 0) this.oreKind[i] = OreKind.None;
    return kind;
  }

  occupy(tx: number, ty: number, w: number, h: number, id: EntityId): void {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (!this.inBounds(x, y)) continue;
        const i = this.index(x, y);
        this.structureAt[i] = id;
        // Building over ore destroys it, as in the original.
        this.ore[i] = 0;
        this.oreKind[i] = OreKind.None;
      }
    }
  }

  vacate(tx: number, ty: number, w: number, h: number): void {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (!this.inBounds(x, y)) continue;
        this.structureAt[this.index(x, y)] = 0;
      }
    }
  }

  structureIdAt(tx: number, ty: number): EntityId {
    if (!this.inBounds(tx, ty)) return 0;
    return this.structureAt[this.index(tx, ty)];
  }

  /** Clears the per-tick unit occupancy counters. */
  clearUnitCounts(): void {
    this.unitCount.fill(0);
  }

  addUnitCount(tx: number, ty: number): void {
    if (!this.inBounds(tx, ty)) return;
    const i = this.index(tx, ty);
    if (this.unitCount[i] < 255) this.unitCount[i]++;
  }

  get worldWidth(): number {
    return this.width * TILE;
  }

  get worldHeight(): number {
    return this.height * TILE;
  }
}
