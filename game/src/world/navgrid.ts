import * as THREE from "three";

const UNREACHABLE = 0xffff;

/**
 * Coarse navigation grid with a shared flow field toward the player.
 *
 * Bots used to steer with short whisker rays, which left them stuck against the
 * long walls of the map. One breadth-first field per tick is cheap and lets
 * every bot follow a route that actually goes around geometry.
 */
export class NavGrid {
  private readonly cell: number;
  private readonly originX: number;
  private readonly originZ: number;
  private readonly cols: number;
  private readonly rows: number;
  private readonly blocked: Uint8Array;
  private readonly distance: Uint16Array;
  private readonly queue: Int32Array;
  private goalIndex = -1;

  constructor(bounds: THREE.Box3, colliders: readonly THREE.Box3[], cell = 0.75) {
    this.cell = cell;
    this.originX = bounds.min.x;
    this.originZ = bounds.min.z;
    this.cols = Math.ceil((bounds.max.x - bounds.min.x) / cell);
    this.rows = Math.ceil((bounds.max.z - bounds.min.z) / cell);
    this.blocked = new Uint8Array(this.cols * this.rows);
    this.distance = new Uint16Array(this.cols * this.rows).fill(UNREACHABLE);
    this.queue = new Int32Array(this.cols * this.rows);

    const padding = 0.42;
    for (const collider of colliders) {
      // Anything low enough to step onto, or high enough to walk under, is
      // not an obstacle for navigation.
      if (collider.max.y < 0.7) continue;
      if (collider.min.y > 1.9) continue;
      const x0 = this.col(collider.min.x - padding);
      const x1 = this.col(collider.max.x + padding);
      const z0 = this.row(collider.min.z - padding);
      const z1 = this.row(collider.max.z + padding);
      for (let x = x0; x <= x1; x++) {
        for (let z = z0; z <= z1; z++) this.blocked[z * this.cols + x] = 1;
      }
    }
  }

  private col(x: number): number {
    return THREE.MathUtils.clamp(
      Math.floor((x - this.originX) / this.cell),
      0,
      this.cols - 1,
    );
  }

  private row(z: number): number {
    return THREE.MathUtils.clamp(
      Math.floor((z - this.originZ) / this.cell),
      0,
      this.rows - 1,
    );
  }

  private centerX(col: number): number {
    return this.originX + (col + 0.5) * this.cell;
  }

  private centerZ(row: number): number {
    return this.originZ + (row + 0.5) * this.cell;
  }

  /** Rebuilds the distance field so every open cell knows the way to `goal`. */
  update(goal: THREE.Vector3): void {
    const goalIndex = this.row(goal.z) * this.cols + this.col(goal.x);
    this.goalIndex = goalIndex;
    this.distance.fill(UNREACHABLE);

    let head = 0;
    let tail = 0;
    this.distance[goalIndex] = 0;
    this.queue[tail++] = goalIndex;

    while (head < tail) {
      const current = this.queue[head++];
      const col = current % this.cols;
      const row = (current - col) / this.cols;
      const next = this.distance[current] + 1;

      for (let i = 0; i < 4; i++) {
        const nc = col + (i === 0 ? 1 : i === 1 ? -1 : 0);
        const nr = row + (i === 2 ? 1 : i === 3 ? -1 : 0);
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const index = nr * this.cols + nc;
        if (this.blocked[index] || this.distance[index] !== UNREACHABLE) continue;
        this.distance[index] = next;
        this.queue[tail++] = index;
      }
    }
  }

  /**
   * Direction a bot at `position` should walk to make progress toward the goal,
   * or null when it is already there or the field never reached it.
   */
  direction(position: THREE.Vector3, target = new THREE.Vector3()): THREE.Vector3 | null {
    if (this.goalIndex < 0) return null;
    const col = this.col(position.x);
    const row = this.row(position.z);
    const index = row * this.cols + col;
    if (index === this.goalIndex) return null;

    let bestDistance = this.distance[index];
    let bestCol = -1;
    let bestRow = -1;

    for (let dc = -1; dc <= 1; dc++) {
      for (let dr = -1; dr <= 1; dr++) {
        if (dc === 0 && dr === 0) continue;
        const nc = col + dc;
        const nr = row + dr;
        if (nc < 0 || nr < 0 || nc >= this.cols || nr >= this.rows) continue;
        const neighbour = nr * this.cols + nc;
        if (this.blocked[neighbour]) continue;
        // Do not cut corners diagonally through a blocked cell.
        if (dc !== 0 && dr !== 0) {
          if (this.blocked[row * this.cols + nc] || this.blocked[nr * this.cols + col]) continue;
        }
        const d = this.distance[neighbour];
        if (d < bestDistance) {
          bestDistance = d;
          bestCol = nc;
          bestRow = nr;
        }
      }
    }

    if (bestCol < 0) return null;
    return target
      .set(this.centerX(bestCol) - position.x, 0, this.centerZ(bestRow) - position.z)
      .normalize();
  }
}
