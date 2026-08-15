import { TILE } from "../engine/constants";
import { structureDef } from "../engine/rules";
import { OreKind, TerrainKind } from "../engine/types";
import type { World } from "../engine/world";
import { Visibility } from "../engine/world";
import type { Camera } from "./camera";
import { ctx2d, makeCanvas } from "./sprites/canvas";
import { PAL, TEAM } from "./sprites/palette";

/** One pixel per tile; the display canvas scales this up. */
const TERRAIN_COLORS: Record<number, string> = {
  [TerrainKind.Grass]: "#3c552a",
  [TerrainKind.Dirt]: "#6b5436",
  [TerrainKind.Road]: "#6a6155",
  [TerrainKind.Rough]: "#4a4335",
  [TerrainKind.Water]: "#1e3c5e",
  [TerrainKind.Cliff]: "#4a4038",
  [TerrainKind.Beach]: "#8a7a52",
};

/**
 * The sidebar radar.
 *
 * The terrain layer is baked once (and re-baked only when ore changes) while units, structures and
 * the viewport rectangle are drawn live on top.
 */
export class Minimap {
  private readonly base: HTMLCanvasElement;
  private dirty = true;

  constructor(private readonly world: World) {
    this.base = makeCanvas(world.grid.width, world.grid.height);
  }

  invalidate(): void {
    this.dirty = true;
  }

  /** Renders into `canvas`, which is expected to be square-ish and small. */
  draw(canvas: HTMLCanvasElement, camera: Camera, shroudEnabled: boolean): void {
    if (this.dirty) this.bakeTerrain(shroudEnabled);

    const ctx = ctx2d(canvas);
    const grid = this.world.grid;
    const scale = Math.min(canvas.width / grid.width, canvas.height / grid.height);
    const offsetX = Math.floor((canvas.width - grid.width * scale) / 2);
    const offsetY = Math.floor((canvas.height - grid.height * scale) / 2);

    ctx.fillStyle = "#07090c";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.base, offsetX, offsetY, grid.width * scale, grid.height * scale);

    const dot = Math.max(1, Math.round(scale));
    const toX = (wx: number) => offsetX + (wx / TILE) * scale;
    const toY = (wy: number) => offsetY + (wy / TILE) * scale;

    for (const s of this.world.structures) {
      if (s.dead) continue;
      if (shroudEnabled && !this.explored(s.tx, s.ty)) continue;
      const def = structureDef(s.kind);
      ctx.fillStyle = TEAM[s.side].base;
      ctx.fillRect(
        Math.round(offsetX + s.tx * scale),
        Math.round(offsetY + s.ty * scale),
        Math.max(1, Math.round(def.w * scale)),
        Math.max(1, Math.round(def.h * scale)),
      );
    }

    for (const u of this.world.units) {
      if (u.dead) continue;
      const tx = Math.floor(u.x / TILE);
      const ty = Math.floor(u.y / TILE);
      if (shroudEnabled && !this.visible(tx, ty) && u.side !== this.world.humanSide) continue;
      ctx.fillStyle = TEAM[u.side].light;
      ctx.fillRect(Math.round(toX(u.x)) - 1, Math.round(toY(u.y)) - 1, dot + 1, dot + 1);
    }

    // Viewport rectangle.
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = 1;
    const vx = offsetX + (camera.x / TILE) * scale;
    const vy = offsetY + (camera.y / TILE) * scale;
    const vw = (camera.viewportWidth / camera.zoom / TILE) * scale;
    const vh = (camera.viewportHeight / camera.zoom / TILE) * scale;
    ctx.strokeRect(Math.round(vx) + 0.5, Math.round(vy) + 0.5, Math.round(vw), Math.round(vh));
  }

  /** Converts a click inside the minimap canvas into world coordinates. */
  canvasToWorld(
    canvas: HTMLCanvasElement,
    px: number,
    py: number,
  ): { x: number; y: number } | null {
    const grid = this.world.grid;
    const scale = Math.min(canvas.width / grid.width, canvas.height / grid.height);
    const offsetX = Math.floor((canvas.width - grid.width * scale) / 2);
    const offsetY = Math.floor((canvas.height - grid.height * scale) / 2);
    const tx = (px - offsetX) / scale;
    const ty = (py - offsetY) / scale;
    if (tx < 0 || ty < 0 || tx > grid.width || ty > grid.height) return null;
    return { x: tx * TILE, y: ty * TILE };
  }

  private explored(tx: number, ty: number): boolean {
    return this.world.visibility[this.world.grid.index(tx, ty)] !== Visibility.Unexplored;
  }

  private visible(tx: number, ty: number): boolean {
    if (!this.world.grid.inBounds(tx, ty)) return false;
    return this.world.visibility[this.world.grid.index(tx, ty)] === Visibility.Visible;
  }

  private bakeTerrain(shroudEnabled: boolean): void {
    const grid = this.world.grid;
    const ctx = ctx2d(this.base);
    const image = ctx.createImageData(grid.width, grid.height);
    const data = image.data;

    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        const i = grid.index(tx, ty);
        let color = TERRAIN_COLORS[grid.terrain[i]] ?? PAL.grass1;
        if (grid.ore[i] > 0) {
          color = grid.oreKind[i] === OreKind.Gem ? PAL.gem2 : PAL.ore2;
        }
        if (shroudEnabled && this.world.visibility[i] === Visibility.Unexplored) {
          color = "#05060a";
        }
        const rgb = parseHex(color);
        const p = i * 4;
        data[p] = rgb[0];
        data[p + 1] = rgb[1];
        data[p + 2] = rgb[2];
        data[p + 3] = 255;
      }
    }

    ctx.putImageData(image, 0, 0);
    this.dirty = false;
  }
}

function parseHex(hex: string): [number, number, number] {
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
}
