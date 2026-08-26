/**
 * Small helpers for baking pixel-art sprites into offscreen canvases at load time.
 *
 * Everything the game draws on the battlefield is pre-rendered once here; the per-frame renderer
 * only ever calls `drawImage`. That keeps frame time flat no matter how ornate the artwork gets.
 */

export type Sprite = HTMLCanvasElement;

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.ceil(width));
  canvas.height = Math.max(1, Math.ceil(height));
  return canvas;
}

export function ctx2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext("2d", { willReadFrequently: false });
  if (!ctx) throw new Error("2D canvas context unavailable");
  ctx.imageSmoothingEnabled = false;
  return ctx;
}

/** Creates a canvas and hands you a pixel-snapped context to draw into. */
export function bake(
  width: number,
  height: number,
  draw: (ctx: CanvasRenderingContext2D, w: number, h: number) => void,
): Sprite {
  const canvas = makeCanvas(width, height);
  const ctx = ctx2d(canvas);
  draw(ctx, canvas.width, canvas.height);
  return canvas;
}

/**
 * Pre-rotates a sprite into `count` evenly spaced facings.
 *
 * Rotating at draw time would be fine for a handful of units, but with a few hundred on screen the
 * per-frame transform + resample cost adds up; baking also lets the nearest-neighbour resampling
 * happen once, which keeps the pixels crisp and consistent frame to frame.
 *
 * Index 0 points east (+x), matching the engine's `facing = 0`.
 */
export function bakeRotations(source: Sprite, count: number): Sprite[] {
  const diagonal = Math.ceil(Math.hypot(source.width, source.height));
  const size = diagonal + (diagonal % 2);
  const frames: Sprite[] = [];
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    frames.push(
      bake(size, size, (ctx) => {
        ctx.translate(size / 2, size / 2);
        ctx.rotate(angle);
        ctx.drawImage(source, -source.width / 2, -source.height / 2);
      }),
    );
  }
  return frames;
}

/** Picks the baked rotation closest to `angle`. */
export function frameForAngle(frames: Sprite[], angle: number): Sprite {
  const n = frames.length;
  const twoPi = Math.PI * 2;
  const a = ((angle % twoPi) + twoPi) % twoPi;
  return frames[Math.round((a / twoPi) * n) % n];
}

/** Soft elliptical drop shadow used under every unit. */
export function bakeShadow(width: number, height: number): Sprite {
  return bake(width, height, (ctx, w, h) => {
    ctx.fillStyle = "rgba(0,0,0,0.34)";
    ctx.beginPath();
    ctx.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Fills an axis-aligned rectangle on integer pixel boundaries. */
export function px(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h)));
}

/** A rectangle with a lit top/left edge and a shaded bottom/right edge. */
export function bevelRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  base: string,
  light: string,
  dark: string,
): void {
  px(ctx, x, y, w, h, base);
  px(ctx, x, y, w, 1, light);
  px(ctx, x, y, 1, h, light);
  px(ctx, x, y + h - 1, w, 1, dark);
  px(ctx, x + w - 1, y, 1, h, dark);
}

/** Outlines a rectangle with a 1px border. */
export function outlineRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  color: string,
): void {
  px(ctx, x, y, w, 1, color);
  px(ctx, x, y + h - 1, w, 1, color);
  px(ctx, x, y, 1, h, color);
  px(ctx, x + w - 1, y, 1, h, color);
}

/** Tints an already-drawn sprite, preserving its alpha (used for damage/shroud states). */
export function tinted(source: Sprite, color: string, alpha: number): Sprite {
  return bake(source.width, source.height, (ctx) => {
    ctx.drawImage(source, 0, 0);
    ctx.globalAlpha = alpha;
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, source.width, source.height);
  });
}
