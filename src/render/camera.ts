import { TILE } from "../engine/constants";
import { clamp } from "../engine/util/vec";

export const MIN_ZOOM = 1;
export const MAX_ZOOM = 4;

/**
 * Maps world pixels to screen pixels.
 *
 * Zoom is kept integral so the pixel art always lands on whole device pixels — a fractional zoom
 * would reintroduce the resampling blur the whole art pipeline is designed to avoid.
 */
export class Camera {
  /** Top-left of the visible area, in world pixels. */
  x = 0;
  y = 0;
  zoom = 2;

  viewportWidth = 1;
  viewportHeight = 1;

  constructor(
    private worldWidth: number,
    private worldHeight: number,
  ) {}

  setViewport(width: number, height: number): void {
    this.viewportWidth = width;
    this.viewportHeight = height;
    this.clampToWorld();
  }

  setZoom(zoom: number, anchorScreenX?: number, anchorScreenY?: number): void {
    const next = clamp(Math.round(zoom), MIN_ZOOM, MAX_ZOOM);
    if (next === this.zoom) return;
    const ax = anchorScreenX ?? this.viewportWidth / 2;
    const ay = anchorScreenY ?? this.viewportHeight / 2;
    const worldX = this.x + ax / this.zoom;
    const worldY = this.y + ay / this.zoom;
    this.zoom = next;
    this.x = worldX - ax / this.zoom;
    this.y = worldY - ay / this.zoom;
    this.clampToWorld();
  }

  move(dx: number, dy: number): void {
    this.x += dx;
    this.y += dy;
    this.clampToWorld();
  }

  /** Centres the view on a world position. */
  centerOn(worldX: number, worldY: number): void {
    this.x = worldX - this.viewportWidth / this.zoom / 2;
    this.y = worldY - this.viewportHeight / this.zoom / 2;
    this.clampToWorld();
  }

  centerOnTile(tx: number, ty: number): void {
    this.centerOn(tx * TILE, ty * TILE);
  }

  clampToWorld(): void {
    const visibleW = this.viewportWidth / this.zoom;
    const visibleH = this.viewportHeight / this.zoom;
    const maxX = Math.max(0, this.worldWidth - visibleW);
    const maxY = Math.max(0, this.worldHeight - visibleH);
    this.x = clamp(this.x, 0, maxX);
    this.y = clamp(this.y, 0, maxY);
  }

  screenToWorldX(sx: number): number {
    return this.x + sx / this.zoom;
  }

  screenToWorldY(sy: number): number {
    return this.y + sy / this.zoom;
  }

  worldToScreenX(wx: number): number {
    return (wx - this.x) * this.zoom;
  }

  worldToScreenY(wy: number): number {
    return (wy - this.y) * this.zoom;
  }

  /** Inclusive tile bounds currently visible, padded by `pad` tiles. */
  visibleTiles(pad = 1): { x0: number; y0: number; x1: number; y1: number } {
    const x0 = Math.floor(this.x / TILE) - pad;
    const y0 = Math.floor(this.y / TILE) - pad;
    const x1 = Math.ceil((this.x + this.viewportWidth / this.zoom) / TILE) + pad;
    const y1 = Math.ceil((this.y + this.viewportHeight / this.zoom) / TILE) + pad;
    return { x0, y0, x1, y1 };
  }

  isVisible(worldX: number, worldY: number, margin = 48): boolean {
    const sx = this.worldToScreenX(worldX);
    const sy = this.worldToScreenY(worldY);
    return (
      sx >= -margin &&
      sy >= -margin &&
      sx <= this.viewportWidth + margin &&
      sy <= this.viewportHeight + margin
    );
  }
}
