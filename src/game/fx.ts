import * as THREE from "three";
import type { Vec3 } from "./types";

interface Tracer {
  line: THREE.Line;
  life: number;
}

interface Spark {
  mesh: THREE.Mesh;
  vel: THREE.Vector3;
  life: number;
}

export class Effects {
  private tracers: Tracer[] = [];
  private sparks: Spark[] = [];
  private decals: THREE.Mesh[] = [];
  private readonly scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  tracer(from: Vec3, to: Vec3): void {
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(from.x, from.y, from.z),
      new THREE.Vector3(to.x, to.y, to.z),
    ]);
    const line = new THREE.Line(
      geo,
      new THREE.LineBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 0.85 }),
    );
    this.scene.add(line);
    this.tracers.push({ line, life: 0.08 });
  }

  impact(point: Vec3, normal?: Vec3): void {
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.04, 0.04, 0.04),
        new THREE.MeshBasicMaterial({ color: 0xe8d29a }),
      );
      mesh.position.set(point.x, point.y, point.z);
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 4, 1 + Math.random() * 3, (Math.random() - 0.5) * 4),
        life: 0.28,
      });
    }
    const decal = new THREE.Mesh(
      new THREE.CircleGeometry(0.06, 8),
      new THREE.MeshBasicMaterial({ color: 0x1a1612, transparent: true, opacity: 0.75, side: THREE.DoubleSide }),
    );
    decal.position.set(point.x, point.y, point.z);
    if (normal) {
      decal.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    } else {
      decal.lookAt(point.x, point.y + 1, point.z);
    }
    this.scene.add(decal);
    this.decals.push(decal);
    if (this.decals.length > 80) {
      const old = this.decals.shift();
      if (old) {
        this.scene.remove(old);
        old.geometry.dispose();
      }
    }
  }

  blood(point: Vec3): void {
    for (let i = 0; i < 5; i++) {
      const mesh = new THREE.Mesh(
        new THREE.BoxGeometry(0.05, 0.05, 0.05),
        new THREE.MeshBasicMaterial({ color: 0x8a1c1c }),
      );
      mesh.position.set(point.x, point.y, point.z);
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 3, 1 + Math.random() * 2, (Math.random() - 0.5) * 3),
        life: 0.32,
      });
    }
  }

  update(dt: number): void {
    for (const t of this.tracers) {
      t.life -= dt;
      const mat = t.line.material as THREE.LineBasicMaterial;
      mat.opacity = Math.max(0, t.life / 0.08);
      if (t.life <= 0) {
        this.scene.remove(t.line);
        t.line.geometry.dispose();
      }
    }
    this.tracers = this.tracers.filter((t) => t.life > 0);

    for (const s of this.sparks) {
      s.life -= dt;
      s.vel.y -= 12 * dt;
      s.mesh.position.addScaledVector(s.vel, dt);
      if (s.life <= 0) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
      }
    }
    this.sparks = this.sparks.filter((s) => s.life > 0);
  }
}
