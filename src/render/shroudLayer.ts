import { TILE } from "../engine/constants";
import { Visibility, type World } from "../engine/world";
import type { Camera } from "./camera";
import { ctx2d, makeCanvas } from "./sprites/canvas";

/**
 * Draws the fog of war.
 *
 * The mask is painted at one pixel per tile into a small offscreen canvas and then upscaled with
 * smoothing *on*. That is the one place in the renderer where bilinear filtering is wanted: it
 * turns the tile grid into soft, believable darkness instead of a checkerboard of black squares,
 * for the cost of a 72x72 blit.
 */
export class ShroudLayer {
  private readonly mask: HTMLCanvasElement;
  private readonly image: ImageData;

  constructor(private readonly world: World) {
    this.mask = makeCanvas(world.grid.width, world.grid.height);
    this.image = ctx2d(this.mask).createImageData(world.grid.width, world.grid.height);
  }

  draw(ctx: CanvasRenderingContext2D, camera: Camera): void {
    const grid = this.world.grid;
    const vis = this.world.visibility;
    const data = this.image.data;

    for (let i = 0; i < vis.length; i++) {
      const p = i * 4;
      data[p] = 0;
      data[p + 1] = 0;
      data[p + 2] = 0;
      // Never seen: opaque. Remembered: dimmed. Observed: clear.
      data[p + 3] = vis[i] === Visibility.Unexplored ? 255 : vis[i] === Visibility.Fogged ? 118 : 0;
    }

    const maskCtx = ctx2d(this.mask);
    maskCtx.putImageData(this.image, 0, 0);

    const view = camera.visibleTiles(2);
    const x0 = Math.max(0, view.x0);
    const y0 = Math.max(0, view.y0);
    const x1 = Math.min(grid.width, view.x1);
    const y1 = Math.min(grid.height, view.y1);
    if (x1 <= x0 || y1 <= y0) return;

    const prevSmoothing = ctx.imageSmoothingEnabled;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(
      this.mask,
      x0,
      y0,
      x1 - x0,
      y1 - y0,
      Math.floor(camera.worldToScreenX(x0 * TILE)),
      Math.floor(camera.worldToScreenY(y0 * TILE)),
      Math.ceil((x1 - x0) * TILE * camera.zoom),
      Math.ceil((y1 - y0) * TILE * camera.zoom),
    );
    ctx.imageSmoothingEnabled = prevSmoothing;
  }
}
