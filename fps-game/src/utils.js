import * as THREE from "three";

export const clamp = (v, min, max) => Math.min(max, Math.max(min, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const randRange = (a, b) => a + Math.random() * (b - a);
export const randInt = (a, b) => Math.floor(randRange(a, b + 1));
export const DEG = Math.PI / 180;

/** 由中心点和尺寸构造一个 Box3 碰撞盒 */
export function makeBox(cx, cy, cz, sx, sy, sz) {
  return new THREE.Box3(
    new THREE.Vector3(cx - sx / 2, cy - sy / 2, cz - sz / 2),
    new THREE.Vector3(cx + sx / 2, cy + sy / 2, cz + sz / 2),
  );
}

const _pBox = new THREE.Box3();

function bodyBox(pos, radius, height) {
  _pBox.min.set(pos.x - radius, pos.y, pos.z - radius);
  _pBox.max.set(pos.x + radius, pos.y + height, pos.z + radius);
  return _pBox;
}

/**
 * 逐轴移动 + AABB 碰撞解算（角色以脚底位置 pos 表示）。
 * 会直接修改 pos 与 vel，返回 { onGround }。
 */
export function moveWithCollisions(pos, vel, dt, radius, height, colliders) {
  let onGround = false;

  // X 轴
  pos.x += vel.x * dt;
  let box = bodyBox(pos, radius, height);
  for (const c of colliders) {
    if (box.intersectsBox(c)) {
      if (vel.x > 0) pos.x = c.min.x - radius - 0.001;
      else if (vel.x < 0) pos.x = c.max.x + radius + 0.001;
      vel.x = 0;
      box = bodyBox(pos, radius, height);
    }
  }

  // Z 轴
  pos.z += vel.z * dt;
  box = bodyBox(pos, radius, height);
  for (const c of colliders) {
    if (box.intersectsBox(c)) {
      if (vel.z > 0) pos.z = c.min.z - radius - 0.001;
      else if (vel.z < 0) pos.z = c.max.z + radius + 0.001;
      vel.z = 0;
      box = bodyBox(pos, radius, height);
    }
  }

  // Y 轴
  pos.y += vel.y * dt;
  box = bodyBox(pos, radius, height);
  for (const c of colliders) {
    if (box.intersectsBox(c)) {
      if (vel.y <= 0 && pos.y < c.max.y && pos.y > c.max.y - 1.2) {
        pos.y = c.max.y + 0.001;
        vel.y = 0;
        onGround = true;
      } else if (vel.y > 0) {
        pos.y = c.min.y - height - 0.001;
        vel.y = 0;
      }
      box = bodyBox(pos, radius, height);
    }
  }

  // 地面
  if (pos.y <= 0) {
    pos.y = 0;
    if (vel.y < 0) vel.y = 0;
    onGround = true;
  }
  return { onGround };
}

/**
 * 射线与 AABB 求交（slab 法），返回距离 t 或 null。
 */
export function rayAABB(origin, dir, box, maxDist) {
  let tmin = 0;
  let tmax = maxDist;
  let nAxis = -1;
  let nSign = 0;
  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  const bmin = [box.min.x, box.min.y, box.min.z];
  const bmax = [box.max.x, box.max.y, box.max.z];
  for (let i = 0; i < 3; i++) {
    if (Math.abs(d[i]) < 1e-9) {
      if (o[i] < bmin[i] || o[i] > bmax[i]) return null;
    } else {
      const inv = 1 / d[i];
      let t1 = (bmin[i] - o[i]) * inv;
      let t2 = (bmax[i] - o[i]) * inv;
      let sign = -1;
      if (t1 > t2) {
        const tmp = t1;
        t1 = t2;
        t2 = tmp;
        sign = 1;
      }
      if (t1 > tmin) {
        tmin = t1;
        nAxis = i;
        nSign = sign;
      }
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  if (tmin <= 0 || tmin > maxDist) return null;
  const normal = new THREE.Vector3();
  if (nAxis === 0) normal.x = nSign;
  else if (nAxis === 1) normal.y = nSign;
  else if (nAxis === 2) normal.z = nSign;
  return { t: tmin, normal };
}

/** 在一组 AABB 中找最近的射线命中 */
export function raycastBoxes(origin, dir, boxes, maxDist) {
  let best = null;
  for (const box of boxes) {
    const hit = rayAABB(origin, dir, box, maxDist);
    if (hit && (!best || hit.t < best.t)) best = hit;
  }
  if (!best) return null;
  const point = origin.clone().addScaledVector(dir, best.t);
  return { dist: best.t, point, normal: best.normal };
}

/** 射线与球体求交，返回距离或 null */
export function raySphere(origin, dir, center, radius, maxDist) {
  const oc = new THREE.Vector3().subVectors(origin, center);
  const b = oc.dot(dir);
  const c = oc.lengthSq() - radius * radius;
  const disc = b * b - c;
  if (disc < 0) return null;
  const t = -b - Math.sqrt(disc);
  if (t < 0 || t > maxDist) return null;
  return t;
}

/** 由 canvas 绘制回调生成贴图 */
export function canvasTexture(size, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  draw(ctx, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
