import { TILE } from "../engine/constants";
import { hash01 } from "../engine/util/rng";
import { EffectKind, ProjectileKind, type Effect, type Projectile } from "../engine/types";
import { weaponDef } from "../engine/rules";
import { lerp } from "../engine/util/vec";
import type { World } from "../engine/world";
import type { Camera } from "./camera";
import { PAL, TEAM } from "./sprites/palette";

/**
 * Battlefield effects and projectiles.
 *
 * These are drawn procedurally each frame instead of being baked as sprites: an explosion needs
 * to interpolate colour and radius over its lifetime, and every particle offset is derived from
 * the effect's stable `seed`, so the animation is identical on every replay of the same match.
 */
export function drawEffects(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  effects: readonly Effect[],
  alpha: number,
  /** Draw only ground scars, or only airborne effects. */
  ground: boolean,
): void {
  for (const e of effects) {
    if (isGroundEffect(e.kind) !== ground) continue;
    if (!camera.isVisible(e.x, e.y, 96)) continue;
    const t = Math.min(1, (e.age + alpha) / e.life);
    switch (e.kind) {
      case EffectKind.MuzzleFlash:
        drawMuzzleFlash(ctx, camera, e, t);
        break;
      case EffectKind.Tracer:
        drawTracer(ctx, camera, e, t);
        break;
      case EffectKind.TeslaArc:
        drawTeslaArc(ctx, camera, e, t);
        break;
      case EffectKind.Spark:
        drawSparks(ctx, camera, e, t);
        break;
      case EffectKind.SmallExplosion:
        drawExplosion(ctx, camera, e, t, 10);
        break;
      case EffectKind.Explosion:
        drawExplosion(ctx, camera, e, t, 20);
        break;
      case EffectKind.BigExplosion:
        drawExplosion(ctx, camera, e, t, 34);
        break;
      case EffectKind.Smoke:
        drawSmoke(ctx, camera, e, t);
        break;
      case EffectKind.Fire:
        drawFire(ctx, camera, e, t);
        break;
      case EffectKind.Crater:
        drawCrater(ctx, camera, e, t);
        break;
      case EffectKind.Wreck:
        drawWreck(ctx, camera, e, t);
        break;
      case EffectKind.Corpse:
        drawCorpse(ctx, camera, e, t);
        break;
      case EffectKind.Shockwave:
        drawShockwave(ctx, camera, e, t);
        break;
      case EffectKind.Nuke:
        drawMushroomCloud(ctx, camera, e, t);
        break;
      case EffectKind.Ripple:
        drawRipple(ctx, camera, e, t);
        break;
    }
  }
}

/** Effects that must sit *under* units (craters, scorch marks) are drawn in a separate pass. */
export function isGroundEffect(kind: EffectKind): boolean {
  return kind === EffectKind.Crater || kind === EffectKind.Corpse || kind === EffectKind.Wreck;
}

export function drawProjectiles(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  world: World,
  alpha: number,
): void {
  for (const p of world.projectiles) {
    if (p.dead) continue;
    const x = lerp(p.px, p.x, alpha);
    const y = lerp(p.py, p.y, alpha);
    if (!camera.isVisible(x, y, 48)) continue;
    const weapon = weaponDef(p.weapon);
    const sx = camera.worldToScreenX(x);
    const sy = camera.worldToScreenY(y);
    const zoom = camera.zoom;
    const angle = Math.atan2(p.vy, p.vx);

    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(angle);

    switch (weapon.projectile) {
      case ProjectileKind.Ballistic: {
        ctx.fillStyle = PAL.glow;
        ctx.fillRect(-3 * zoom, -1 * zoom, 5 * zoom, 2 * zoom);
        ctx.fillStyle = "#fff4c4";
        ctx.fillRect(0, -1 * zoom, 2 * zoom, 2 * zoom);
        break;
      }
      case ProjectileKind.Missile: {
        ctx.fillStyle = PAL.steelLite;
        ctx.fillRect(-4 * zoom, -1.5 * zoom, 7 * zoom, 3 * zoom);
        ctx.fillStyle = PAL.steelDark;
        ctx.fillRect(-4 * zoom, -1.5 * zoom, 2 * zoom, 3 * zoom);
        // Exhaust flare.
        ctx.fillStyle = PAL.fire2;
        ctx.fillRect(-7 * zoom, -1 * zoom, 3 * zoom, 2 * zoom);
        ctx.fillStyle = PAL.fire1;
        ctx.fillRect(-5.5 * zoom, -0.5 * zoom, 1.5 * zoom, 1 * zoom);
        break;
      }
      case ProjectileKind.Lobbed: {
        // Lob height peaks halfway through the flight, drawn as a rising shadow gap.
        const arc = Math.sin((p.age / Math.max(1, p.life)) * Math.PI);
        ctx.translate(0, -arc * 10 * zoom);
        ctx.fillStyle = "#3c3a30";
        ctx.beginPath();
        ctx.arc(0, 0, 2.2 * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#6d6a58";
        ctx.beginPath();
        ctx.arc(-0.5 * zoom, -0.5 * zoom, 1.2 * zoom, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case ProjectileKind.Flame: {
        ctx.fillStyle = PAL.fire2;
        ctx.beginPath();
        ctx.arc(0, 0, 3.5 * zoom, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = PAL.fire1;
        ctx.beginPath();
        ctx.arc(0, 0, 1.8 * zoom, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }
}

// ── Individual effects ──────────────────────────────────────────────────────

function drawMuzzleFlash(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  e: Effect,
  t: number,
): void {
  const zoom = camera.zoom;
  const size = (1 - t) * 5 * zoom;
  if (size <= 0) return;
  ctx.save();
  ctx.translate(camera.worldToScreenX(e.x), camera.worldToScreenY(e.y));
  ctx.rotate(e.rot);
  ctx.fillStyle = PAL.fire1;
  ctx.beginPath();
  ctx.moveTo(size * 2, 0);
  ctx.lineTo(0, -size);
  ctx.lineTo(0, size);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#fffbe8";
  ctx.beginPath();
  ctx.arc(0, 0, size * 0.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawTracer(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  ctx.save();
  ctx.globalAlpha = 1 - t;
  ctx.strokeStyle = PAL.glow;
  ctx.lineWidth = Math.max(1, camera.zoom * 0.75);
  ctx.beginPath();
  ctx.moveTo(camera.worldToScreenX(e.x), camera.worldToScreenY(e.y));
  ctx.lineTo(camera.worldToScreenX(e.x2), camera.worldToScreenY(e.y2));
  ctx.stroke();
  ctx.restore();
}

/** Jagged forked lightning between two points; the fork pattern is seeded per effect. */
function drawTeslaArc(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  const x0 = camera.worldToScreenX(e.x);
  const y0 = camera.worldToScreenY(e.y);
  const x1 = camera.worldToScreenX(e.x2);
  const y1 = camera.worldToScreenY(e.y2);
  const segments = 9;

  ctx.save();
  ctx.globalAlpha = 1 - t * 0.7;
  for (const [width, color] of [
    [4 * camera.zoom, "rgba(120,200,255,0.35)"],
    [1.6 * camera.zoom, PAL.tesla],
    [0.8 * camera.zoom, "#ffffff"],
  ] as const) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    for (let i = 1; i < segments; i++) {
      const f = i / segments;
      const jitter = (hash01(e.seed, i, Math.floor(e.age)) - 0.5) * 22 * camera.zoom * 0.5;
      const nx = -(y1 - y0);
      const ny = x1 - x0;
      const len = Math.hypot(nx, ny) || 1;
      ctx.lineTo(
        lerp(x0, x1, f) + (nx / len) * jitter,
        lerp(y0, y1, f) + (ny / len) * jitter,
      );
    }
    ctx.lineTo(x1, y1);
    ctx.stroke();
  }
  ctx.restore();
}

function drawSparks(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  const zoom = camera.zoom;
  const cx = camera.worldToScreenX(e.x);
  const cy = camera.worldToScreenY(e.y);
  ctx.save();
  ctx.globalAlpha = 1 - t;
  for (let i = 0; i < 5; i++) {
    const a = hash01(e.seed, i, 1) * Math.PI * 2;
    const d = t * (6 + hash01(e.seed, i, 2) * 8) * zoom;
    ctx.fillStyle = i % 2 === 0 ? PAL.fire1 : PAL.fire2;
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, zoom, zoom);
  }
  ctx.restore();
}

/** Expanding fireball that cools from white to orange, then leaves a smoke puff. */
function drawExplosion(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  e: Effect,
  t: number,
  baseRadius: number,
): void {
  const zoom = camera.zoom;
  const cx = camera.worldToScreenX(e.x);
  const cy = camera.worldToScreenY(e.y);
  const r = baseRadius * zoom * (0.35 + t * 0.9);

  ctx.save();
  // Smoke shell.
  ctx.globalAlpha = (1 - t) * 0.55;
  ctx.fillStyle = PAL.smoke2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 1.15, 0, Math.PI * 2);
  ctx.fill();

  // Fireball core, shrinking and cooling.
  const coreAlpha = Math.max(0, 1 - t * 1.5);
  ctx.globalAlpha = coreAlpha;
  ctx.fillStyle = PAL.fire3;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.85, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.fire2;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.55, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = PAL.fire1;
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.28, 0, Math.PI * 2);
  ctx.fill();

  // Debris flung outward.
  ctx.globalAlpha = 1 - t;
  for (let i = 0; i < 7; i++) {
    const a = hash01(e.seed, i, 3) * Math.PI * 2;
    const d = t * baseRadius * 1.9 * zoom * (0.5 + hash01(e.seed, i, 4));
    ctx.fillStyle = i % 3 === 0 ? PAL.fire2 : PAL.smoke1;
    const s = Math.max(1, zoom * (1 + hash01(e.seed, i, 5)));
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d, s, s);
  }
  ctx.restore();
}

function drawSmoke(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  const zoom = camera.zoom;
  const cx = camera.worldToScreenX(e.x);
  const cy = camera.worldToScreenY(e.y) - t * 16 * zoom * e.scale;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.45;
  for (let i = 0; i < 3; i++) {
    const drift = (hash01(e.seed, i, 6) - 0.5) * 10 * zoom;
    ctx.fillStyle = i === 0 ? PAL.smoke1 : PAL.smoke2;
    ctx.beginPath();
    ctx.arc(
      cx + drift * t,
      cy - i * 4 * zoom * t,
      (3 + i * 2 + t * 7) * zoom * e.scale,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.restore();
}

/** Flickering flames; the flicker is driven by the frame count so it never freezes. */
function drawFire(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  const zoom = camera.zoom;
  const cx = camera.worldToScreenX(e.x);
  const cy = camera.worldToScreenY(e.y);
  const fade = t > 0.8 ? (1 - t) / 0.2 : 1;

  ctx.save();
  ctx.globalAlpha = 0.85 * fade;
  for (let i = 0; i < 4; i++) {
    const flick = hash01(e.seed, i, Math.floor(e.age / 3));
    const h = (5 + flick * 8) * zoom * e.scale;
    const w = (2.5 + flick * 2.5) * zoom * e.scale;
    const ox = (hash01(e.seed, i, 7) - 0.5) * 10 * zoom * e.scale;
    ctx.fillStyle = i === 0 ? PAL.fire3 : i === 1 ? PAL.fire2 : PAL.fire1;
    ctx.beginPath();
    ctx.moveTo(cx + ox - w / 2, cy);
    ctx.lineTo(cx + ox, cy - h);
    ctx.lineTo(cx + ox + w / 2, cy);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalAlpha = 0.3 * fade;
  ctx.fillStyle = PAL.smoke2;
  ctx.beginPath();
  ctx.arc(cx, cy - 12 * zoom * e.scale, 5 * zoom * e.scale, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawCrater(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  const zoom = camera.zoom;
  const cx = camera.worldToScreenX(e.x);
  const cy = camera.worldToScreenY(e.y);
  const r = e.scale * TILE * 0.55 * zoom;
  ctx.save();
  ctx.globalAlpha = Math.min(0.75, (1 - t) * 1.5);
  ctx.fillStyle = "#1d1710";
  ctx.beginPath();
  ctx.ellipse(cx, cy, r, r * 0.85, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#2c2419";
  ctx.beginPath();
  ctx.ellipse(cx - r * 0.15, cy - r * 0.15, r * 0.6, r * 0.5, 0, 0, Math.PI * 2);
  ctx.fill();
  // Scattered rubble around the rim.
  for (let i = 0; i < 10; i++) {
    const a = hash01(e.seed, i, 8) * Math.PI * 2;
    const d = r * (0.7 + hash01(e.seed, i, 9) * 0.5);
    ctx.fillStyle = i % 2 === 0 ? "#40382c" : "#2a241b";
    ctx.fillRect(cx + Math.cos(a) * d, cy + Math.sin(a) * d * 0.85, zoom * 2, zoom * 2);
  }
  ctx.restore();
}

function drawWreck(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  const zoom = camera.zoom;
  const cx = camera.worldToScreenX(e.x);
  const cy = camera.worldToScreenY(e.y);
  ctx.save();
  ctx.globalAlpha = t > 0.85 ? (1 - t) / 0.15 : 1;
  ctx.translate(cx, cy);
  ctx.rotate(e.rot);
  ctx.fillStyle = "#26221c";
  ctx.fillRect(-9 * zoom, -6 * zoom, 18 * zoom, 12 * zoom);
  ctx.fillStyle = "#3a352c";
  ctx.fillRect(-8 * zoom, -5 * zoom, 12 * zoom, 4 * zoom);
  ctx.fillStyle = "#15120e";
  ctx.fillRect(-3 * zoom, -2 * zoom, 8 * zoom, 5 * zoom);
  ctx.restore();
}

function drawCorpse(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  const zoom = camera.zoom;
  const cx = camera.worldToScreenX(e.x);
  const cy = camera.worldToScreenY(e.y);
  ctx.save();
  ctx.globalAlpha = t > 0.8 ? (1 - t) / 0.2 : 0.85;
  ctx.translate(cx, cy);
  ctx.rotate(e.rot);
  ctx.fillStyle = "#3a2f22";
  ctx.fillRect(-4 * zoom, -2 * zoom, 8 * zoom, 4 * zoom);
  ctx.fillStyle = e.side ? TEAM[e.side].deep : "#2a2118";
  ctx.fillRect(1 * zoom, -1.5 * zoom, 3 * zoom, 3 * zoom);
  ctx.restore();
}

function drawShockwave(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  const zoom = camera.zoom;
  const cx = camera.worldToScreenX(e.x);
  const cy = camera.worldToScreenY(e.y);
  const r = t * e.scale * TILE * zoom;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.7;
  ctx.strokeStyle = "#ffe9c9";
  ctx.lineWidth = Math.max(2, (1 - t) * 8 * zoom);
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = (1 - t) * 0.3;
  ctx.strokeStyle = PAL.fire2;
  ctx.lineWidth = Math.max(1, (1 - t) * 14 * zoom);
  ctx.beginPath();
  ctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
  ctx.stroke();
  ctx.restore();
}

function drawRipple(ctx: CanvasRenderingContext2D, camera: Camera, e: Effect, t: number): void {
  const zoom = camera.zoom;
  ctx.save();
  ctx.globalAlpha = (1 - t) * 0.5;
  ctx.strokeStyle = PAL.water3;
  ctx.lineWidth = zoom;
  ctx.beginPath();
  ctx.arc(
    camera.worldToScreenX(e.x),
    camera.worldToScreenY(e.y),
    t * 10 * zoom * e.scale,
    0,
    Math.PI * 2,
  );
  ctx.stroke();
  ctx.restore();
}

/** Rising column plus cap; used by the nuclear strike. */
function drawMushroomCloud(
  ctx: CanvasRenderingContext2D,
  camera: Camera,
  e: Effect,
  t: number,
): void {
  const zoom = camera.zoom;
  const cx = camera.worldToScreenX(e.x);
  const cy = camera.worldToScreenY(e.y);
  const rise = t * 90 * zoom;
  const capR = (14 + t * 46) * zoom;

  ctx.save();
  ctx.globalAlpha = Math.min(1, (1 - t) * 2);

  // Stem.
  ctx.fillStyle = "#4a3a2c";
  ctx.beginPath();
  ctx.moveTo(cx - 12 * zoom, cy);
  ctx.lineTo(cx - 7 * zoom, cy - rise);
  ctx.lineTo(cx + 7 * zoom, cy - rise);
  ctx.lineTo(cx + 12 * zoom, cy);
  ctx.closePath();
  ctx.fill();

  // Cap, hot at the core.
  for (const [scale, color] of [
    [1, "#5a483a"],
    [0.75, PAL.fire3],
    [0.45, PAL.fire2],
    [0.2, PAL.fire1],
  ] as const) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.ellipse(cx, cy - rise, capR * scale, capR * scale * 0.65, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // Base fireball.
  ctx.globalAlpha = Math.max(0, 1 - t * 2.2);
  ctx.fillStyle = PAL.fire1;
  ctx.beginPath();
  ctx.arc(cx, cy, (10 + t * 60) * zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Reusable helper for the nuke/impact white-out flash. */
export function drawFlash(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  intensity: number,
): void {
  if (intensity <= 0) return;
  ctx.save();
  ctx.globalAlpha = Math.min(1, intensity);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

export type { Effect, Projectile };
