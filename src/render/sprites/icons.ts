import { STRUCTURES } from "../../engine/rules";
import type { Side, StructureKindId, UnitKindId } from "../../engine/types";
import type { SpriteAtlas } from "./atlas";
import { bake, ctx2d, frameForAngle, makeCanvas, outlineRect, px, type Sprite } from "./canvas";
import { PAL } from "./palette";

export const ICON_W = 60;
export const ICON_H = 48;

/**
 * Sidebar cameo icons.
 *
 * Rather than authoring a second set of artwork, each icon reuses the unit or structure sprite,
 * scaled to fit inside a riveted metal frame. That guarantees the cameo always matches what
 * actually appears on the battlefield, including team colours.
 */
export class IconCache {
  private readonly cache = new Map<string, string>();

  constructor(private readonly atlas: SpriteAtlas) {}

  /** Returns a data URL suitable for an `<img src>`. Built once per (kind, side). */
  dataUrl(kind: UnitKindId | StructureKindId, side: Side): string {
    const key = `${kind}:${side}`;
    let url = this.cache.get(key);
    if (!url) {
      url = this.render(kind, side).toDataURL();
      this.cache.set(key, url);
    }
    return url;
  }

  private render(kind: UnitKindId | StructureKindId, side: Side): HTMLCanvasElement {
    const isStructure = Object.prototype.hasOwnProperty.call(STRUCTURES, kind);
    const source = isStructure
      ? this.atlas.structure(kind as StructureKindId, side).body
      : composeUnit(this.atlas, kind as UnitKindId, side);

    const canvas = makeCanvas(ICON_W, ICON_H);
    const ctx = ctx2d(canvas);

    // Recessed metal plate.
    const plate = ctx.createLinearGradient(0, 0, 0, ICON_H);
    plate.addColorStop(0, "#3b332a");
    plate.addColorStop(1, "#221c16");
    ctx.fillStyle = plate;
    ctx.fillRect(0, 0, ICON_W, ICON_H);
    px(ctx, 0, 0, ICON_W, 1, "#7a6852");
    px(ctx, 0, 0, 1, ICON_H, "#7a6852");
    px(ctx, 0, ICON_H - 1, ICON_W, 1, "#0c0806");
    px(ctx, ICON_W - 1, 0, 1, ICON_H, "#0c0806");

    // Fit the sprite with integer scaling so the pixels stay square.
    const pad = 6;
    const scale = Math.max(
      1,
      Math.min((ICON_W - pad * 2) / source.width, (ICON_H - pad * 2) / source.height),
    );
    const w = Math.round(source.width * scale);
    const h = Math.round(source.height * scale);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, Math.round((ICON_W - w) / 2), Math.round((ICON_H - h) / 2), w, h);

    return canvas;
  }
}

/** Unit cameo: body plus turret, shown at a three-quarter facing so the silhouette reads. */
function composeUnit(atlas: SpriteAtlas, kind: UnitKindId, side: Side): Sprite {
  const sprite = atlas.unit(kind, side);
  const angle = -Math.PI / 4;
  const body = frameForAngle(sprite.frames[0], angle);
  return bake(body.width, body.height, (ctx, w, h) => {
    ctx.drawImage(body, 0, 0);
    if (sprite.turret) {
      const turret = frameForAngle(sprite.turret, angle);
      ctx.drawImage(turret, (w - turret.width) / 2, (h - turret.height) / 2);
    }
  });
}

/** Small "no entry" badge stamped over locked cameos. */
export function lockedOverlay(): string {
  const canvas = bake(ICON_W, ICON_H, (ctx, w, h) => {
    ctx.fillStyle = "rgba(6,6,8,0.6)";
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = PAL.hpRed;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 11, 0, Math.PI * 2);
    ctx.moveTo(w / 2 - 8, h / 2 - 8);
    ctx.lineTo(w / 2 + 8, h / 2 + 8);
    ctx.stroke();
    outlineRect(ctx, 0, 0, w, h, "rgba(0,0,0,0.8)");
  });
  return canvas.toDataURL();
}
