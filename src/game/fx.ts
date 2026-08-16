import * as THREE from "three";
import { muzzleFlashTex } from "./look";
import type { Vec3 } from "./types";

interface Tracer {
  mesh: THREE.Mesh;
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
  private readonly flashMap: THREE.CanvasTexture;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.flashMap = muzzleFlashTex();
  }

  tracer(from: Vec3, to: Vec3): void {
    const a = new THREE.Vector3(from.x, from.y, from.z);
    const b = new THREE.Vector3(to.x, to.y, to.z);
    const len = a.distanceTo(b);
    const mesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.004, len, 5),
      new THREE.MeshBasicMaterial({
        color: 0xffd27a,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
      }),
    );
    mesh.position.copy(a).lerp(b, 0.5);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.07 });
  }

  impact(point: Vec3, normal?: Vec3): void {
    for (let i = 0; i < 8; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.025, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0xe8d29a, roughness: 0.8 }),
      );
      mesh.position.set(point.x, point.y, point.z);
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 5, 1.2 + Math.random() * 3.2, (Math.random() - 0.5) * 5),
        life: 0.3,
      });
    }
    const puff = new THREE.Mesh(
      new THREE.PlaneGeometry(0.28, 0.28),
      new THREE.MeshBasicMaterial({
        map: this.flashMap,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    puff.position.set(point.x, point.y, point.z);
    this.scene.add(puff);
    this.sparks.push({ mesh: puff, vel: new THREE.Vector3(0, 0.4, 0), life: 0.16 });

    const decal = new THREE.Mesh(
      new THREE.CircleGeometry(0.055, 10),
      new THREE.MeshStandardMaterial({
        color: 0x1a1612,
        transparent: true,
        opacity: 0.8,
        roughness: 1,
        side: THREE.DoubleSide,
      }),
    );
    decal.position.set(point.x, point.y, point.z);
    if (normal) decal.lookAt(point.x + normal.x, point.y + normal.y, point.z + normal.z);
    else decal.lookAt(point.x, point.y + 1, point.z);
    this.scene.add(decal);
    this.decals.push(decal);
    if (this.decals.length > 90) {
      const old = this.decals.shift();
      if (old) {
        this.scene.remove(old);
        old.geometry.dispose();
      }
    }
  }

  blood(point: Vec3): void {
    for (let i = 0; i < 6; i++) {
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.03, 6, 5),
        new THREE.MeshStandardMaterial({ color: 0x7a1818, roughness: 0.55 }),
      );
      mesh.position.set(point.x, point.y, point.z);
      this.scene.add(mesh);
      this.sparks.push({
        mesh,
        vel: new THREE.Vector3((Math.random() - 0.5) * 3.2, 1 + Math.random() * 2.4, (Math.random() - 0.5) * 3.2),
        life: 0.34,
      });
    }
  }

  update(dt: number): void {
    for (const t of this.tracers) {
      t.life -= dt;
      const mat = t.mesh.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, t.life / 0.07);
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        t.mesh.geometry.dispose();
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
