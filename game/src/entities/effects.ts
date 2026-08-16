import * as THREE from "three";
import { decalTexture, sparkTexture } from "../world/textures";

interface Particle {
  sprite: THREE.Sprite;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  gravity: number;
  startScale: number;
  endScale: number;
  startOpacity: number;
}

interface Tracer {
  mesh: THREE.Mesh;
  life: number;
  maxLife: number;
}

interface Decal {
  mesh: THREE.Mesh;
  life: number;
}

const MAX_DECALS = 90;

/** Bullet tracers, impact sparks, dust puffs, blood and bullet holes. */
export class Effects {
  private readonly particles: Particle[] = [];
  private readonly freeParticles: THREE.Sprite[] = [];
  private readonly tracers: Tracer[] = [];
  private readonly freeTracers: THREE.Mesh[] = [];
  private readonly decals: Decal[] = [];

  private readonly sparkMaterial: THREE.SpriteMaterial;
  private readonly tracerGeometry = new THREE.CylinderGeometry(0.012, 0.012, 1, 5, 1, true);
  private readonly tracerMaterial: THREE.MeshBasicMaterial;
  private readonly decalGeometry = new THREE.PlaneGeometry(0.32, 0.32);
  private readonly decalMaterial: THREE.MeshBasicMaterial;

  constructor(private readonly scene: THREE.Scene) {
    this.sparkMaterial = new THREE.SpriteMaterial({
      map: sparkTexture(),
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.tracerMaterial = new THREE.MeshBasicMaterial({
      color: 0xffdf9a,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    this.decalMaterial = new THREE.MeshBasicMaterial({
      map: decalTexture(),
      transparent: true,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      opacity: 0.9,
    });
  }

  private takeSprite(): THREE.Sprite {
    const sprite = this.freeSpritePop() ?? new THREE.Sprite(this.sparkMaterial.clone());
    sprite.visible = true;
    this.scene.add(sprite);
    return sprite;
  }

  private freeSpritePop(): THREE.Sprite | undefined {
    return this.freeParticles.pop();
  }

  private emit(
    position: THREE.Vector3,
    velocity: THREE.Vector3,
    options: {
      life: number;
      gravity?: number;
      color: number;
      startScale: number;
      endScale: number;
      opacity?: number;
      blending?: THREE.Blending;
    },
  ): void {
    if (this.particles.length > 420) return;
    const sprite = this.takeSprite();
    const material = sprite.material as THREE.SpriteMaterial;
    material.color.setHex(options.color);
    material.blending = options.blending ?? THREE.AdditiveBlending;
    material.opacity = options.opacity ?? 1;
    sprite.position.copy(position);
    sprite.scale.setScalar(options.startScale);
    this.particles.push({
      sprite,
      velocity: velocity.clone(),
      life: options.life,
      maxLife: options.life,
      gravity: options.gravity ?? 0,
      startScale: options.startScale,
      endScale: options.endScale,
      startOpacity: options.opacity ?? 1,
    });
  }

  tracer(from: THREE.Vector3, to: THREE.Vector3, thickness = 1): void {
    const distance = from.distanceTo(to);
    if (distance < 0.05) return;
    const mesh =
      this.freeTracers.pop() ?? new THREE.Mesh(this.tracerGeometry, this.tracerMaterial.clone());
    mesh.visible = true;
    mesh.scale.set(thickness, distance, thickness);
    mesh.position.copy(from).lerp(to, 0.5);
    mesh.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      to.clone().sub(from).normalize(),
    );
    (mesh.material as THREE.MeshBasicMaterial).opacity = 0.75;
    this.scene.add(mesh);
    this.tracers.push({ mesh, life: 0.06, maxLife: 0.06 });
  }

  impact(point: THREE.Vector3, normal: THREE.Vector3, surface: "world" | "flesh"): void {
    if (surface === "flesh") {
      for (let i = 0; i < 8; i++) {
        const velocity = normal
          .clone()
          .multiplyScalar(1.6 + Math.random() * 1.6)
          .add(
            new THREE.Vector3(
              (Math.random() - 0.5) * 2.2,
              (Math.random() - 0.5) * 2.2,
              (Math.random() - 0.5) * 2.2,
            ),
          );
        this.emit(point, velocity, {
          life: 0.42 + Math.random() * 0.25,
          gravity: -7,
          color: 0xb3121b,
          startScale: 0.1,
          endScale: 0.02,
          opacity: 0.95,
          blending: THREE.NormalBlending,
        });
      }
      return;
    }

    for (let i = 0; i < 6; i++) {
      const velocity = normal
        .clone()
        .multiplyScalar(2.5 + Math.random() * 3)
        .add(
          new THREE.Vector3(
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3,
            (Math.random() - 0.5) * 3,
          ),
        );
      this.emit(point, velocity, {
        life: 0.22 + Math.random() * 0.2,
        gravity: -9,
        color: 0xffce7a,
        startScale: 0.08,
        endScale: 0.005,
      });
    }

    for (let i = 0; i < 4; i++) {
      this.emit(
        point.clone().addScaledVector(normal, 0.05),
        normal
          .clone()
          .multiplyScalar(0.6 + Math.random())
          .add(new THREE.Vector3((Math.random() - 0.5) * 0.8, Math.random() * 0.6, (Math.random() - 0.5) * 0.8)),
        {
          life: 0.55 + Math.random() * 0.35,
          gravity: 0.4,
          color: 0xcbb894,
          startScale: 0.12,
          endScale: 0.55,
          opacity: 0.5,
          blending: THREE.NormalBlending,
        },
      );
    }

    this.addDecal(point, normal);
  }

  muzzleSmoke(position: THREE.Vector3, direction: THREE.Vector3): void {
    this.emit(
      position,
      direction.clone().multiplyScalar(1.4).add(new THREE.Vector3(0, 0.3, 0)),
      {
        life: 0.5,
        gravity: 0.5,
        color: 0xdad2c4,
        startScale: 0.08,
        endScale: 0.42,
        opacity: 0.28,
        blending: THREE.NormalBlending,
      },
    );
  }

  private addDecal(point: THREE.Vector3, normal: THREE.Vector3): void {
    const mesh = new THREE.Mesh(this.decalGeometry, this.decalMaterial.clone());
    mesh.position.copy(point).addScaledVector(normal, 0.012);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    mesh.rotateZ(Math.random() * Math.PI * 2);
    const scale = 0.7 + Math.random() * 0.5;
    mesh.scale.setScalar(scale);
    this.scene.add(mesh);
    this.decals.push({ mesh, life: 22 });

    if (this.decals.length > MAX_DECALS) {
      const oldest = this.decals.shift();
      if (oldest) {
        this.scene.remove(oldest.mesh);
        (oldest.mesh.material as THREE.Material).dispose();
      }
    }
  }

  update(dt: number): void {
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      if (p.life <= 0) {
        this.scene.remove(p.sprite);
        this.freeParticles.push(p.sprite);
        this.particles.splice(i, 1);
        continue;
      }
      p.velocity.y += p.gravity * dt;
      p.velocity.multiplyScalar(1 - 2.2 * dt);
      p.sprite.position.addScaledVector(p.velocity, dt);
      const t = 1 - p.life / p.maxLife;
      p.sprite.scale.setScalar(THREE.MathUtils.lerp(p.startScale, p.endScale, t));
      (p.sprite.material as THREE.SpriteMaterial).opacity = p.startOpacity * (1 - t);
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      if (t.life <= 0) {
        this.scene.remove(t.mesh);
        this.freeTracers.push(t.mesh);
        this.tracers.splice(i, 1);
        continue;
      }
      (t.mesh.material as THREE.MeshBasicMaterial).opacity = 0.75 * (t.life / t.maxLife);
    }

    for (let i = this.decals.length - 1; i >= 0; i--) {
      const d = this.decals[i];
      d.life -= dt;
      const material = d.mesh.material as THREE.MeshBasicMaterial;
      if (d.life < 3) material.opacity = 0.9 * Math.max(0, d.life / 3);
      if (d.life <= 0) {
        this.scene.remove(d.mesh);
        material.dispose();
        this.decals.splice(i, 1);
      }
    }
  }

  clear(): void {
    for (const p of this.particles) this.scene.remove(p.sprite);
    this.particles.length = 0;
    for (const t of this.tracers) this.scene.remove(t.mesh);
    this.tracers.length = 0;
    for (const d of this.decals) {
      this.scene.remove(d.mesh);
      (d.mesh.material as THREE.Material).dispose();
    }
    this.decals.length = 0;
  }
}
