import { TILE } from "../engine/constants";
import { structureDef, unitDef } from "../engine/rules";
import type { Structure, StructureKindId, Unit } from "../engine/types";
import { lerp } from "../engine/util/vec";
import type { World } from "../engine/world";
import type { Camera } from "./camera";
import { frameForAngle } from "./sprites/canvas";
import { PAL } from "./sprites/palette";
import type { SpriteAtlas } from "./sprites/atlas";
import { TerrainRenderer } from "./terrainChunks";

export interface PlacementPreview {
  kind: StructureKindId;
  tx: number;
  ty: number;
  valid: boolean;
}

export interface RenderOverlay {
  /** Drag-selection rectangle in screen pixels, or null. */
  marquee: { x0: number; y0: number; x1: number; y1: number } | null;
  placement: PlacementPreview | null;
  hoveredId: number;
  /** Screen-space shake offset applied to the world layer. */
  shakeX: number;
  shakeY: number;
}

export const EMPTY_OVERLAY: RenderOverlay = {
  marquee: null,
  placement: null,
  hoveredId: 0,
  shakeX: 0,
  shakeY: 0,
};

export class Renderer {
  readonly terrain: TerrainRenderer;

  constructor(
    private readonly world: World,
    private readonly atlas: SpriteAtlas,
  ) {
    this.terrain = new TerrainRenderer(world.grid, atlas.tiles);
  }

  /**
   * @param alpha fraction of a tick elapsed since the last simulation step, used to interpolate
   *              unit positions so movement is smooth above 30fps.
   */
  draw(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    alpha: number,
    overlay: RenderOverlay = EMPTY_OVERLAY,
    animTick = 0,
  ): void {
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = PAL.black;
    ctx.fillRect(0, 0, camera.viewportWidth, camera.viewportHeight);

    ctx.save();
    if (overlay.shakeX !== 0 || overlay.shakeY !== 0) {
      ctx.translate(Math.round(overlay.shakeX), Math.round(overlay.shakeY));
    }

    this.terrain.draw(ctx, camera);
    this.drawStructures(ctx, camera, animTick);
    this.drawUnits(ctx, camera, alpha);
    this.drawPlacement(ctx, camera, overlay.placement);

    ctx.restore();

    this.drawMarquee(ctx, overlay.marquee);
  }

  // ── Structures ────────────────────────────────────────────────────────────

  private drawStructures(ctx: CanvasRenderingContext2D, camera: Camera, animTick: number): void {
    const sorted = [...this.world.structures].sort((a, b) => a.ty - b.ty);
    for (const s of sorted) {
      if (s.dead) continue;
      const def = structureDef(s.kind);
      const wx = s.tx * TILE;
      const wy = s.ty * TILE;
      if (!camera.isVisible(wx + (def.w * TILE) / 2, wy + (def.h * TILE) / 2, def.w * TILE)) {
        continue;
      }

      const sprite = this.atlas.structure(s.kind, s.side);
      const sx = Math.round(camera.worldToScreenX(wx));
      const sy = Math.round(camera.worldToScreenY(wy));
      const w = Math.round(def.w * TILE * camera.zoom);
      const h = Math.round(def.h * TILE * camera.zoom);

      const image = s.hp < def.hp * 0.5 ? sprite.damaged : sprite.body;

      if (s.buildProgress < 1) {
        // Rise out of the ground while building up.
        const visible = Math.max(1, Math.round(h * s.buildProgress));
        ctx.save();
        ctx.beginPath();
        ctx.rect(sx, sy + h - visible, w, visible);
        ctx.clip();
        ctx.globalAlpha = 0.55 + s.buildProgress * 0.45;
        ctx.drawImage(image, sx, sy, w, h);
        ctx.restore();
      } else {
        ctx.drawImage(image, sx, sy, w, h);

        if (sprite.overlay && s.online) {
          const frame = Math.floor(animTick / sprite.overlaySpeed) % sprite.overlay.length;
          ctx.drawImage(sprite.overlay[frame], sx, sy, w, h);
        }

        if (sprite.turret) {
          const turret = frameForAngle(sprite.turret, s.turret);
          const cx = sx + w / 2;
          const cy = sy + h / 2;
          const tw = turret.width * camera.zoom;
          const th = turret.height * camera.zoom;
          ctx.drawImage(turret, Math.round(cx - tw / 2), Math.round(cy - th / 2), tw, th);
        }
      }

      const selected = this.world.selection.has(s.id);
      if (selected) this.drawSelectionBox(ctx, sx, sy, w, h);
      if (selected || s.hp < def.hp) {
        this.drawHealthBar(ctx, sx + 2, sy - 6 * camera.zoom, w - 4, s.hp / def.hp, camera.zoom);
      }
    }
  }

  // ── Units ─────────────────────────────────────────────────────────────────

  private drawUnits(ctx: CanvasRenderingContext2D, camera: Camera, alpha: number): void {
    const sorted = [...this.world.units].sort((a, b) => a.y - b.y);

    // Shadows first so no unit casts a shadow over another.
    for (const u of sorted) {
      if (u.dead) continue;
      const x = lerp(u.px, u.x, alpha);
      const y = lerp(u.py, u.y, alpha);
      if (!camera.isVisible(x, y)) continue;
      const sprite = this.atlas.unit(u.kind, u.side);
      const sw = sprite.shadow.width * camera.zoom;
      const sh = sprite.shadow.height * camera.zoom;
      ctx.drawImage(
        sprite.shadow,
        Math.round(camera.worldToScreenX(x) - sw / 2 + 2 * camera.zoom),
        Math.round(camera.worldToScreenY(y) - sh / 2 + 3 * camera.zoom),
        sw,
        sh,
      );
    }

    for (const u of sorted) {
      if (u.dead) continue;
      const x = lerp(u.px, u.x, alpha);
      const y = lerp(u.py, u.y, alpha);
      if (!camera.isVisible(x, y)) continue;
      this.drawUnit(ctx, camera, u, x, y);
    }
  }

  private drawUnit(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    u: Unit,
    x: number,
    y: number,
  ): void {
    const sprite = this.atlas.unit(u.kind, u.side);
    const def = unitDef(u.kind);
    const sx = camera.worldToScreenX(x);
    const sy = camera.worldToScreenY(y);

    const moving = u.pathIndex < u.path.length;
    const step =
      sprite.animSpeed > 0 && moving
        ? Math.floor(u.age / sprite.animSpeed) % sprite.frames.length
        : 0;
    const body = frameForAngle(sprite.frames[step], u.facing);
    const bw = body.width * camera.zoom;
    const bh = body.height * camera.zoom;
    ctx.drawImage(body, Math.round(sx - bw / 2), Math.round(sy - bh / 2), bw, bh);

    if (sprite.turret) {
      const turret = frameForAngle(sprite.turret, u.turret);
      const tw = turret.width * camera.zoom;
      const th = turret.height * camera.zoom;
      ctx.drawImage(turret, Math.round(sx - tw / 2), Math.round(sy - th / 2), tw, th);
    }

    const selected = this.world.selection.has(u.id);
    const radius = def.radius * camera.zoom;
    if (selected) {
      this.drawSelectionBrackets(ctx, sx, sy, radius + 3 * camera.zoom);
    }
    if (selected || u.hp < def.hp) {
      this.drawHealthBar(
        ctx,
        sx - radius,
        sy - radius - 6 * camera.zoom,
        radius * 2,
        u.hp / def.hp,
        camera.zoom,
      );
    }
    // Harvester load indicator.
    if (def.cargoCapacity > 0 && u.cargo > 0) {
      const w = radius * 2;
      const filled = (u.cargo / def.cargoCapacity) * w;
      ctx.fillStyle = "rgba(0,0,0,0.6)";
      ctx.fillRect(Math.round(sx - radius), Math.round(sy + radius + 1), Math.round(w), 3);
      ctx.fillStyle = PAL.ore3;
      ctx.fillRect(Math.round(sx - radius), Math.round(sy + radius + 1), Math.round(filled), 3);
    }
  }

  // ── Overlays ──────────────────────────────────────────────────────────────

  private drawSelectionBrackets(
    ctx: CanvasRenderingContext2D,
    cx: number,
    cy: number,
    r: number,
  ): void {
    const len = Math.max(3, r * 0.45);
    ctx.strokeStyle = PAL.selection;
    ctx.lineWidth = 1;
    ctx.beginPath();
    const corners = [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ];
    for (const [dx, dy] of corners) {
      const x = Math.round(cx + dx * r) + 0.5;
      const y = Math.round(cy + dy * r) + 0.5;
      ctx.moveTo(x - dx * len, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y - dy * len);
    }
    ctx.stroke();
  }

  private drawSelectionBox(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
  ): void {
    ctx.strokeStyle = PAL.selection;
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w) - 1, Math.round(h) - 1);
  }

  private drawHealthBar(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    fraction: number,
    zoom: number,
  ): void {
    const f = Math.max(0, Math.min(1, fraction));
    const h = Math.max(2, Math.round(zoom * 1.5));
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, Math.round(w) + 2, h + 2);
    ctx.fillStyle = f > 0.6 ? PAL.hpGreen : f > 0.3 ? PAL.hpAmber : PAL.hpRed;
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w * f), h);
  }

  private drawMarquee(
    ctx: CanvasRenderingContext2D,
    marquee: RenderOverlay["marquee"],
  ): void {
    if (!marquee) return;
    const x = Math.min(marquee.x0, marquee.x1);
    const y = Math.min(marquee.y0, marquee.y1);
    const w = Math.abs(marquee.x1 - marquee.x0);
    const h = Math.abs(marquee.y1 - marquee.y0);
    ctx.strokeStyle = PAL.selection;
    ctx.setLineDash([4, 3]);
    ctx.lineWidth = 1;
    ctx.strokeRect(Math.round(x) + 0.5, Math.round(y) + 0.5, Math.round(w), Math.round(h));
    ctx.setLineDash([]);
    ctx.fillStyle = "rgba(89,255,100,0.08)";
    ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  private drawPlacement(
    ctx: CanvasRenderingContext2D,
    camera: Camera,
    placement: PlacementPreview | null,
  ): void {
    if (!placement) return;
    const def = structureDef(placement.kind);
    const sprite = this.atlas.structure(placement.kind, this.world.humanSide);
    const sx = Math.round(camera.worldToScreenX(placement.tx * TILE));
    const sy = Math.round(camera.worldToScreenY(placement.ty * TILE));
    const w = Math.round(def.w * TILE * camera.zoom);
    const h = Math.round(def.h * TILE * camera.zoom);

    ctx.save();
    ctx.globalAlpha = 0.6;
    ctx.drawImage(sprite.body, sx, sy, w, h);
    ctx.restore();

    // Per-tile validity grid, like the original's build-site overlay.
    const cell = Math.round(TILE * camera.zoom);
    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        const tileOk = placement.valid && this.canBuildOn(placement.tx + x, placement.ty + y);
        ctx.fillStyle = tileOk ? "rgba(53,194,58,0.28)" : "rgba(208,52,44,0.35)";
        ctx.fillRect(sx + x * cell, sy + y * cell, cell, cell);
        ctx.strokeStyle = tileOk ? "rgba(53,194,58,0.7)" : "rgba(208,52,44,0.8)";
        ctx.lineWidth = 1;
        ctx.strokeRect(sx + x * cell + 0.5, sy + y * cell + 0.5, cell - 1, cell - 1);
      }
    }
  }

  private canBuildOn(tx: number, ty: number): boolean {
    const grid = this.world.grid;
    return grid.inBounds(tx, ty) && grid.terrainPassable(tx, ty) && grid.structureIdAt(tx, ty) === 0;
  }
}

/** Convenience for other layers that need a structure's world-space centre. */
export function structureCenter(s: Structure): { x: number; y: number } {
  const def = structureDef(s.kind);
  return { x: (s.tx + def.w / 2) * TILE, y: (s.ty + def.h / 2) * TILE };
}
