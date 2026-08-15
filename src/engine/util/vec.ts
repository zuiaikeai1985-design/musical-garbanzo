import { TILE } from "../constants";

export const TAU = Math.PI * 2;

export function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.hypot(bx - ax, by - ay);
}

export function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  return dx * dx + dy * dy;
}

export function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(a: number): number {
  let x = a % TAU;
  if (x > Math.PI) x -= TAU;
  if (x <= -Math.PI) x += TAU;
  return x;
}

/** Shortest signed difference from `from` to `to`. */
export function angleDelta(from: number, to: number): number {
  return wrapAngle(to - from);
}

/** Rotate `from` toward `to` by at most `maxStep` radians. */
export function turnToward(from: number, to: number, maxStep: number): number {
  const d = angleDelta(from, to);
  if (Math.abs(d) <= maxStep) return wrapAngle(to);
  return wrapAngle(from + Math.sign(d) * maxStep);
}

/** Quantise an angle to one of `n` facings — used for sprite selection. */
export function facingIndex(angle: number, n: number): number {
  const a = ((angle % TAU) + TAU) % TAU;
  return Math.round((a / TAU) * n) % n;
}

// ── Tile <-> world helpers ──────────────────────────────────────────────────

export function tileToWorldX(tx: number): number {
  return tx * TILE + TILE / 2;
}

export function tileToWorldY(ty: number): number {
  return ty * TILE + TILE / 2;
}

export function worldToTileX(x: number): number {
  return Math.floor(x / TILE);
}

export function worldToTileY(y: number): number {
  return Math.floor(y / TILE);
}
