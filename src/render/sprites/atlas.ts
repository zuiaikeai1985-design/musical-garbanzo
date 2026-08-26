import { STRUCTURES, UNITS } from "../../engine/rules";
import type { Side, StructureKindId, UnitKindId } from "../../engine/types";
import { buildStructureSprite, type StructureSprite } from "./structures";
import { buildTileSet, type TileSet } from "./terrain";
import { buildUnitSprite, type UnitSprite } from "./units";

const SIDES: readonly Side[] = ["soviet", "allied"];

function key(kind: string, side: Side): string {
  return `${kind}:${side}`;
}

/**
 * Every sprite in the game, baked once during the loading screen.
 *
 * Baking up-front costs a few hundred milliseconds at startup and buys a completely hitch-free
 * frame budget afterwards — the render loop only ever calls `drawImage`.
 */
export class SpriteAtlas {
  readonly tiles: TileSet;
  private readonly unitSprites = new Map<string, UnitSprite>();
  private readonly structureSprites = new Map<string, StructureSprite>();

  private constructor(tiles: TileSet) {
    this.tiles = tiles;
  }

  unit(kind: UnitKindId, side: Side): UnitSprite {
    const k = key(kind, side);
    let sprite = this.unitSprites.get(k);
    if (!sprite) {
      sprite = buildUnitSprite(kind, side);
      this.unitSprites.set(k, sprite);
    }
    return sprite;
  }

  structure(kind: StructureKindId, side: Side): StructureSprite {
    const k = key(kind, side);
    let sprite = this.structureSprites.get(k);
    if (!sprite) {
      sprite = buildStructureSprite(kind, side);
      this.structureSprites.set(k, sprite);
    }
    return sprite;
  }

  /**
   * Builds the whole atlas, yielding to the event loop between steps so the loading screen can
   * keep painting its progress bar.
   */
  static async build(onProgress?: (fraction: number, label: string) => void): Promise<SpriteAtlas> {
    const report = async (fraction: number, label: string) => {
      onProgress?.(fraction, label);
      await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
    };

    await report(0, "terrain");
    const atlas = new SpriteAtlas(buildTileSet());

    const unitJobs: [UnitKindId, Side][] = [];
    for (const def of Object.values(UNITS)) {
      for (const side of SIDES) {
        if (def.side === side || def.side === "both") unitJobs.push([def.id, side]);
      }
    }
    const structureJobs: [StructureKindId, Side][] = [];
    for (const def of Object.values(STRUCTURES)) {
      for (const side of SIDES) {
        if (def.side === side || def.side === "both") structureJobs.push([def.id, side]);
      }
    }

    const total = unitJobs.length + structureJobs.length;
    let done = 0;

    for (const [kind, side] of unitJobs) {
      atlas.unit(kind, side);
      done++;
      if (done % 4 === 0) await report(0.05 + (done / total) * 0.9, "units");
    }
    for (const [kind, side] of structureJobs) {
      atlas.structure(kind, side);
      done++;
      if (done % 4 === 0) await report(0.05 + (done / total) * 0.9, "structures");
    }

    await report(1, "ready");
    return atlas;
  }
}
