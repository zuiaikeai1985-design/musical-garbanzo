import * as THREE from "three";

export interface RayHit {
  distance: number;
  point: THREE.Vector3;
  normal: THREE.Vector3;
}

const EPS = 1e-6;

/**
 * Slab-method ray/AABB intersection that also reports the surface normal of the
 * entry face, which the impact effects need in order to orient decals.
 */
export function rayBox(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  box: THREE.Box3,
  maxDistance: number,
): RayHit | null {
  let tMin = 0;
  let tMax = maxDistance;
  let hitAxis = 0;
  let hitSign = 1;

  const o = [origin.x, origin.y, origin.z];
  const d = [dir.x, dir.y, dir.z];
  const lo = [box.min.x, box.min.y, box.min.z];
  const hi = [box.max.x, box.max.y, box.max.z];

  for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(d[axis]) < EPS) {
      if (o[axis] < lo[axis] || o[axis] > hi[axis]) return null;
      continue;
    }
    const inv = 1 / d[axis];
    let t1 = (lo[axis] - o[axis]) * inv;
    let t2 = (hi[axis] - o[axis]) * inv;
    let sign = -1;
    if (t1 > t2) {
      const tmp = t1;
      t1 = t2;
      t2 = tmp;
      sign = 1;
    }
    if (t1 > tMin) {
      tMin = t1;
      hitAxis = axis;
      hitSign = sign;
    }
    if (t2 < tMax) tMax = t2;
    if (tMin > tMax) return null;
  }

  const point = origin.clone().addScaledVector(dir, tMin);
  const normal = new THREE.Vector3();
  normal.setComponent(hitAxis, hitSign);
  return { distance: tMin, point, normal };
}

export function rayBoxes(
  origin: THREE.Vector3,
  dir: THREE.Vector3,
  boxes: readonly THREE.Box3[],
  maxDistance: number,
): RayHit | null {
  let best: RayHit | null = null;
  for (const box of boxes) {
    const hit = rayBox(origin, dir, box, maxDistance);
    if (hit && (!best || hit.distance < best.distance)) best = hit;
  }
  return best;
}

/** Axis-by-axis collide-and-slide for an axis aligned character box. */
export function moveAxisAligned(
  position: THREE.Vector3,
  velocity: THREE.Vector3,
  half: THREE.Vector3,
  colliders: readonly THREE.Box3[],
  dt: number,
): { grounded: boolean; hitCeiling: boolean } {
  let grounded = false;
  let hitCeiling = false;
  const box = new THREE.Box3();

  const step = (axis: "x" | "y" | "z") => {
    const delta = velocity[axis] * dt;
    if (delta === 0) return;
    position[axis] += delta;
    box.min.set(position.x - half.x, position.y - half.y, position.z - half.z);
    box.max.set(position.x + half.x, position.y + half.y, position.z + half.z);

    for (const collider of colliders) {
      if (!box.intersectsBox(collider)) continue;

      if (delta > 0) {
        position[axis] = collider.min[axis] - half[axis] - 1e-4;
        if (axis === "y") hitCeiling = true;
      } else {
        position[axis] = collider.max[axis] + half[axis] + 1e-4;
        if (axis === "y") grounded = true;
      }
      velocity[axis] = 0;
      box.min.set(position.x - half.x, position.y - half.y, position.z - half.z);
      box.max.set(position.x + half.x, position.y + half.y, position.z + half.z);
    }
  };

  // Vertical first so that walking off a ledge does not clip into its side.
  step("y");
  step("x");
  step("z");

  return { grounded, hitCeiling };
}

/**
 * Lets the player and bots walk up low obstacles (crates, stairs) instead of
 * being stopped dead by them, the way CS-style movement does.
 */
export function tryStepUp(
  position: THREE.Vector3,
  half: THREE.Vector3,
  colliders: readonly THREE.Box3[],
  desired: THREE.Vector3,
  maxStep: number,
): boolean {
  const box = new THREE.Box3();
  const probe = position.clone().add(desired);
  probe.y += maxStep;
  box.min.set(probe.x - half.x, probe.y - half.y, probe.z - half.z);
  box.max.set(probe.x + half.x, probe.y + half.y, probe.z + half.z);

  for (const collider of colliders) {
    if (box.intersectsBox(collider)) return false;
  }

  // Find the ground under the stepped-up position and drop onto it.
  let support = -Infinity;
  for (const collider of colliders) {
    if (
      probe.x + half.x > collider.min.x &&
      probe.x - half.x < collider.max.x &&
      probe.z + half.z > collider.min.z &&
      probe.z - half.z < collider.max.z &&
      collider.max.y <= position.y - half.y + maxStep + 1e-3 &&
      collider.max.y > support
    ) {
      support = collider.max.y;
    }
  }
  if (support === -Infinity) return false;

  position.copy(probe);
  position.y = support + half.y + 1e-3;
  return true;
}

export function boxAt(
  center: THREE.Vector3,
  size: THREE.Vector3,
  target = new THREE.Box3(),
): THREE.Box3 {
  target.min.set(
    center.x - size.x / 2,
    center.y - size.y / 2,
    center.z - size.z / 2,
  );
  target.max.set(
    center.x + size.x / 2,
    center.y + size.y / 2,
    center.z + size.z / 2,
  );
  return target;
}
