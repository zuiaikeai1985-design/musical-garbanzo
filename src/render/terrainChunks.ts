import { TILE } from "../engine/constants";
import type { Grid } from "../engine/grid";
import { OreKind } from "../engine/types";
import type { Camera } from "./camera";
import { ctx2d, makeCanvas } from "./sprites/canvas";
import { oreStage, TERRAIN_VARIANTS, type TileSet } from "./sprites/terrain";

const CHUNK_TILES = 16;
const CHUNK_PX = CHUNK_TILES * TILE;

/**
 * Terrain is baked into 16x16-tile chunk canvases and blitted whole.
 *
 * Drawing 40x24 individual tiles every frame is affordable, but it is pure waste: terrain only
 * changes when ore is harvested or a crater appears. Chunking turns the per-frame cost into a
 * handful of `drawImage` calls and is the single biggest rendering win in the game.
 */
export class TerrainRenderer {
  private readonly cols: number;
  private readonly rows: number;
  private readonly chunks: HTMLCanvasElement[];
  private readonly dirty: boolean[];

  constructor(
    private readonly grid: Grid,
    private readonly tiles: TileSet,
  ) {
    this.cols = Math.ceil(grid.width / CHUNK_TILES);
    this.rows = Math.ceil(grid.height / CHUNK_TILES);
    this.chunks = new Array(this.cols * this.rows);
    this.dirty = new Array(this.cols * this.rows).fill(true);
    for (let i = 0; i < this.chunks.length; i++) {
      this.chunks[i] = makeCanvas(CHUNK_PX, CHUNK_PX);
    }
  }

  /** Marks the chunk containing a tile for re-baking (ore mined, crater, wall built). */
  invalidateTile(tx: number, ty: number): void {
    const cx = Math.floor(tx / CHUNK_TILES);
    const cy = Math.floor(ty / CHUNK_TILES);
    if (cx < 0 || cy < 0 || cx >= this.cols || cy >= this.rows) return;
    this.dirty[cy * this.cols + cx] = true;
  }

  invalidateAll(): void {
    this.dirty.fill(true);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const view = camera.visibleTiles(0);
    const c0 = Math.max(0, Math.floor(view.x0 / CHUNK_TILES));
    const c1 = Math.min(this.cols - 1, Math.floor(view.x1 / CHUNK_TILES));
    const r0 = Math.max(0, Math.floor(view.y0 / CHUNK_TILES));
    const r1 = Math.min(this.rows - 1, Math.floor(view.y1 / CHUNK_TILES));

    for (let cy = r0; cy <= r1; cy++) {
      for (let cx = c0; cx <= c1; cx++) {
        const index = cy * this.cols + cx;
        if (this.dirty[index]) this.bakeChunk(cx, cy);
        const sx = Math.round(camera.worldToScreenX(cx * CHUNK_PX));
        const sy = Math.round(camera.worldToScreenY(cy * CHUNK_PX));
        const size = Math.round(CHUNK_PX * camera.zoom);
        ctx.drawImage(this.chunks[index], sx, sy, size, size);
      }
    }
  }

  private bakeChunk(cx: number, cy: number): void {
    const index = cy * this.cols + cx;
    const canvas = this.chunks[index];
    const ctx = ctx2d(canvas);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const grid = this.grid;
    const baseX = cx * CHUNK_TILES;
    const baseY = cy * CHUNK_TILES;

    for (let y = 0; y < CHUNK_TILES; y++) {
      const ty = baseY + y;
      if (ty >= grid.height) break;
      for (let x = 0; x < CHUNK_TILES; x++) {
        const tx = baseX + x;
        if (tx >= grid.width) break;
        const i = grid.index(tx, ty);
        const variant = grid.variant[i] % TERRAIN_VARIANTS;
        const kind = grid.terrain[i];
        ctx.drawImage(this.tiles.terrain[kind][variant], x * TILE, y * TILE);

        const density = grid.ore[i];
        if (density > 0) {
          const stage = oreStage(density);
          const kindIndex = grid.oreKind[i] === OreKind.Gem ? 1 : 0;
          ctx.drawImage(this.tiles.ore[kindIndex][stage][variant], x * TILE, y * TILE);
        }
      }
    }

    this.dirty[index] = false;
  }
}
