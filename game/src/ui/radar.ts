import * as THREE from "three";

export interface RadarBlip {
  position: THREE.Vector3;
  spotted: boolean;
}

/**
 * CS-style overhead radar. Walls come straight from the level colliders, and
 * enemies only appear while they have eyes on the player.
 */
export class Radar {
  private readonly ctx: CanvasRenderingContext2D;
  private readonly walls: Array<[number, number, number, number]> = [];
  private readonly size: number;
  private readonly scale: number;
  private redrawTimer = 0;

  constructor(
    canvas: HTMLCanvasElement,
    bounds: THREE.Box3,
    colliders: readonly THREE.Box3[],
  ) {
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("radar canvas unavailable");
    this.ctx = ctx;

    const dpr = Math.min(window.devicePixelRatio, 2);
    this.size = canvas.clientWidth || 168;
    canvas.width = this.size * dpr;
    canvas.height = this.size * dpr;
    ctx.scale(dpr, dpr);

    const span = Math.max(
      bounds.max.x - bounds.min.x,
      bounds.max.z - bounds.min.z,
    );
    this.scale = this.size / span;

    for (const collider of colliders) {
      const height = collider.max.y - collider.min.y;
      const footprint =
        (collider.max.x - collider.min.x) * (collider.max.z - collider.min.z);
      // Skip the ground plane and clutter that reads as noise on a small radar.
      if (height < 0.8 || footprint > 3000) continue;
      this.walls.push([
        collider.min.x,
        collider.min.z,
        collider.max.x - collider.min.x,
        collider.max.z - collider.min.z,
      ]);
    }
  }

  private toRadar(x: number, z: number): [number, number] {
    return [this.size / 2 + x * this.scale, this.size / 2 + z * this.scale];
  }

  update(
    dt: number,
    player: { position: THREE.Vector3; yaw: number },
    blips: RadarBlip[],
  ): void {
    // 20 Hz is plenty for a radar and keeps the 2D context off the hot path.
    this.redrawTimer -= dt;
    if (this.redrawTimer > 0) return;
    this.redrawTimer = 0.05;

    const ctx = this.ctx;
    const size = this.size;
    ctx.clearRect(0, 0, size, size);

    ctx.fillStyle = "rgba(10, 14, 19, 0.72)";
    ctx.fillRect(0, 0, size, size);

    ctx.fillStyle = "rgba(180, 168, 140, 0.5)";
    for (const [x, z, w, d] of this.walls) {
      const [px, pz] = this.toRadar(x, z);
      ctx.fillRect(px, pz, Math.max(1.5, w * this.scale), Math.max(1.5, d * this.scale));
    }

    for (const blip of blips) {
      if (!blip.spotted) continue;
      const [bx, bz] = this.toRadar(blip.position.x, blip.position.z);
      ctx.beginPath();
      ctx.arc(bx, bz, 3.4, 0, Math.PI * 2);
      ctx.fillStyle = "#e5484d";
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(0,0,0,0.8)";
      ctx.stroke();
    }

    const [px, pz] = this.toRadar(player.position.x, player.position.z);
    ctx.save();
    ctx.translate(px, pz);
    ctx.rotate(-player.yaw);
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(4.2, 5);
    ctx.lineTo(0, 2.6);
    ctx.lineTo(-4.2, 5);
    ctx.closePath();
    ctx.fillStyle = "#6bff8a";
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.85)";
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
  }
}
