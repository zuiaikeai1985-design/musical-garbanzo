import type { AABB, HitZone, Vec3 } from "./types";

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function aabbFromCenter(
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
): AABB {
  const hw = w / 2;
  const hh = h / 2;
  const hd = d / 2;
  return {
    minX: x - hw,
    maxX: x + hw,
    minY: y - hh,
    maxY: y + hh,
    minZ: z - hd,
    maxZ: z + hd,
  };
}

export function aabbFromFoot(
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
): AABB {
  return {
    minX: x - radius,
    maxX: x + radius,
    minY: y,
    maxY: y + height,
    minZ: z - radius,
    maxZ: z + radius,
  };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.minX < b.maxX &&
    a.maxX > b.minX &&
    a.minY < b.maxY &&
    a.maxY > b.minY &&
    a.minZ < b.maxZ &&
    a.maxZ > b.minZ
  );
}

export function pointInAABB(p: Vec3, box: AABB): boolean {
  return (
    p.x >= box.minX &&
    p.x <= box.maxX &&
    p.y >= box.minY &&
    p.y <= box.maxY &&
    p.z >= box.minZ &&
    p.z <= box.maxZ
  );
}

export function expandAABB(box: AABB, radius: number, height: number): AABB {
  return {
    minX: box.minX - radius,
    maxX: box.maxX + radius,
    minY: box.minY,
    maxY: box.maxY + height,
    minZ: box.minZ - radius,
    maxZ: box.maxZ + radius,
  };
}

export function resolveCapsule(
  pos: Vec3,
  vel: Vec3,
  radius: number,
  height: number,
  boxes: AABB[],
): { pos: Vec3; vel: Vec3; grounded: boolean } {
  const next = { x: pos.x + vel.x, y: pos.y + vel.y, z: pos.z + vel.z };
  let grounded = false;

  next.x = slideAxis(pos.x, next.x, pos.y, pos.z, radius, height, boxes, "x");
  const beforeY = next.y;
  next.y = slideAxis(pos.y, next.x, next.y, next.z, radius, height, boxes, "y");
  if (next.y !== beforeY && vel.y < 0) {
    grounded = true;
    vel = { ...vel, y: 0 };
  } else if (next.y !== beforeY && vel.y > 0) {
    vel = { ...vel, y: 0 };
  }
  next.z = slideAxis(pos.z, next.x, next.y, next.z, radius, height, boxes, "z");

  if (next.y < 0) {
    next.y = 0;
    vel = { ...vel, y: 0 };
    grounded = true;
  }

  return { pos: next, vel, grounded };
}

function slideAxis(
  prev: number,
  x: number,
  y: number,
  z: number,
  radius: number,
  height: number,
  boxes: AABB[],
  axis: "x" | "y" | "z",
): number {
  const body = aabbFromFoot(x, y, z, radius, height);
  for (const box of boxes) {
    if (!aabbOverlap(body, box)) continue;
    if (axis === "x") {
      if (prev <= (box.minX + box.maxX) / 2) x = box.minX - radius - 0.001;
      else x = box.maxX + radius + 0.001;
    } else if (axis === "z") {
      if (prev <= (box.minZ + box.maxZ) / 2) z = box.minZ - radius - 0.001;
      else z = box.maxZ + radius + 0.001;
    } else if (prev < box.minY) {
      y = box.minY - height - 0.001;
    } else {
      y = box.maxY + 0.001;
    }
    return slideAxis(prev, x, y, z, radius, height, boxes, axis);
  }
  return axis === "x" ? x : axis === "y" ? y : z;
}

export function raySphere(
  origin: Vec3,
  dir: Vec3,
  center: Vec3,
  radius: number,
): number | null {
  const ox = origin.x - center.x;
  const oy = origin.y - center.y;
  const oz = origin.z - center.z;
  const b = ox * dir.x + oy * dir.y + oz * dir.z;
  const c = ox * ox + oy * oy + oz * oz - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0) {
    const t2 = -b + Math.sqrt(disc);
    return t2 >= 0 ? t2 : null;
  }
  return t;
}

export function rayAABB(origin: Vec3, dir: Vec3, box: AABB): number | null {
  let tmin = 0;
  let tmax = Infinity;

  const axes: Array<["x" | "y" | "z", number, number, number]> = [
    ["x", origin.x, dir.x, 0],
    ["y", origin.y, dir.y, 0],
    ["z", origin.z, dir.z, 0],
  ];

  for (const [axis, o, d] of axes) {
    const min = axis === "x" ? box.minX : axis === "y" ? box.minY : box.minZ;
    const max = axis === "x" ? box.maxX : axis === "y" ? box.maxY : box.maxZ;
    if (Math.abs(d) < 1e-8) {
      if (o < min || o > max) return null;
      continue;
    }
    const inv = 1 / d;
    let t1 = (min - o) * inv;
    let t2 = (max - o) * inv;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
    }
    tmin = Math.max(tmin, t1);
    tmax = Math.min(tmax, t2);
    if (tmin > tmax) return null;
  }
  return tmin >= 0 ? tmin : tmax >= 0 ? tmax : null;
}

export interface DamageResult {
  health: number;
  armor: number;
  dealt: number;
}

export function applyDamage(
  health: number,
  armor: number,
  baseDamage: number,
  armorPen: number,
  zone: HitZone,
  hasHelmet: boolean,
): DamageResult {
  const zoneMul = zone === "head" ? 4 : zone === "legs" ? 0.75 : 1;
  let raw = baseDamage * zoneMul;
  if (zone === "head" && !hasHelmet) {
    return {
      health: Math.max(0, health - raw),
      armor,
      dealt: raw,
    };
  }

  if (armor <= 0) {
    return {
      health: Math.max(0, health - raw),
      armor: 0,
      dealt: raw,
    };
  }

  const absorbed = raw * (1 - armorPen);
  const leftover = raw * armorPen;
  const armorTaken = Math.min(armor, absorbed);
  const bleed = absorbed - armorTaken;
  const dealt = leftover + bleed;
  return {
    health: Math.max(0, health - dealt),
    armor: Math.max(0, armor - armorTaken),
    dealt,
  };
}

export function formatClock(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function length2(x: number, z: number): number {
  return Math.hypot(x, z);
}

export function normalize2(x: number, z: number): { x: number; z: number } {
  const len = Math.hypot(x, z);
  if (len < 1e-6) return { x: 0, z: 0 };
  return { x: x / len, z: z / len };
}
