import * as THREE from 'three';

export interface Particle {
  mesh: THREE.Mesh;
  velocity: THREE.Vector3;
  life: number;
  maxLife: number;
  decay: number;
  color: THREE.Color;
  size: number;
}

export interface BulletTracer {
  mesh: THREE.Line;
  life: number;
  maxLife: number;
}

export class ParticleSystem {
  private particles: Particle[] = [];
  private tracers: BulletTracer[] = [];
  private group: THREE.Group;

  constructor() {
    this.group = new THREE.Group();
  }

  public getGroup(): THREE.Group {
    return this.group;
  }

  // Muzzle flash when firing
  public emitMuzzleFlash(position: THREE.Vector3, direction: THREE.Vector3) {
    const flashGeom = new THREE.SphereGeometry(0.08, 8, 8);
    const flashMat = new THREE.MeshBasicMaterial({
      color: 0xffaa22,
      transparent: true,
      opacity: 0.9,
    });
    const mesh = new THREE.Mesh(flashGeom, flashMat);
    mesh.position.copy(position).addScaledVector(direction, 0.05);
    this.group.add(mesh);

    this.particles.push({
      mesh,
      velocity: new THREE.Vector3(
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5,
        (Math.random() - 0.5) * 0.5
      ),
      life: 0.06,
      maxLife: 0.06,
      decay: 1.0,
      color: new THREE.Color(0xffaa22),
      size: 0.08,
    });

    // Sparks
    for (let i = 0; i < 4; i++) {
      const sparkGeom = new THREE.BoxGeometry(0.015, 0.015, 0.015);
      const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffe066 });
      const spark = new THREE.Mesh(sparkGeom, sparkMat);
      spark.position.copy(position);
      this.group.add(spark);

      const vel = direction.clone()
        .add(new THREE.Vector3((Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4, (Math.random() - 0.5) * 0.4))
        .multiplyScalar(4 + Math.random() * 6);

      this.particles.push({
        mesh: spark,
        velocity: vel,
        life: 0.12,
        maxLife: 0.12,
        decay: 1.0,
        color: new THREE.Color(0xffe066),
        size: 0.015,
      });
    }
  }

  // Bullet hit blood / impact sparks
  public emitHitEffect(position: THREE.Vector3, normal: THREE.Vector3, isBlood: boolean) {
    const count = isBlood ? 8 : 6;
    const colorHex = isBlood ? 0x990000 : 0xffdd44;

    for (let i = 0; i < count; i++) {
      const geom = new THREE.BoxGeometry(0.04, 0.04, 0.04);
      const mat = new THREE.MeshBasicMaterial({ color: colorHex, transparent: true, opacity: 0.85 });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(position);
      this.group.add(mesh);

      const spread = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2,
        (Math.random() - 0.5) * 2
      );
      const vel = normal.clone().multiplyScalar(2 + Math.random() * 3).add(spread);

      this.particles.push({
        mesh,
        velocity: vel,
        life: 0.4 + Math.random() * 0.3,
        maxLife: 0.7,
        decay: 1.0,
        color: new THREE.Color(colorHex),
        size: 0.04,
      });
    }
  }

  // Bullet tracer line
  public addTracer(start: THREE.Vector3, end: THREE.Vector3) {
    const points = [start, end];
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const mat = new THREE.LineBasicMaterial({
      color: 0xffe680,
      transparent: true,
      opacity: 0.8,
      linewidth: 2,
    });
    const line = new THREE.Line(geom, mat);
    this.group.add(line);

    this.tracers.push({
      mesh: line,
      life: 0.08,
      maxLife: 0.08,
    });
  }

  // Smoke grenade expanding cloud
  public emitSmokeExplosion(position: THREE.Vector3) {
    for (let i = 0; i < 35; i++) {
      const geom = new THREE.SphereGeometry(1.2 + Math.random() * 0.8, 8, 8);
      const mat = new THREE.MeshStandardMaterial({
        color: 0x94a3b8,
        transparent: true,
        opacity: 0.55,
        roughness: 1.0,
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(position).add(
        new THREE.Vector3((Math.random() - 0.5) * 4, Math.random() * 2.5, (Math.random() - 0.5) * 4)
      );
      this.group.add(mesh);

      this.particles.push({
        mesh,
        velocity: new THREE.Vector3((Math.random() - 0.5) * 0.4, 0.1 + Math.random() * 0.2, (Math.random() - 0.5) * 0.4),
        life: 14 + Math.random() * 4,
        maxLife: 18,
        decay: 0.1,
        color: new THREE.Color(0x94a3b8),
        size: 1.5,
      });
    }
  }

  // HE Grenade / C4 explosion blast
  public emitExplosion(position: THREE.Vector3, isC4: boolean = false) {
    const count = isC4 ? 60 : 30;
    for (let i = 0; i < count; i++) {
      const size = 0.2 + Math.random() * 0.5;
      const geom = new THREE.DodecahedronGeometry(size);
      const colors = [0xff4500, 0xffa500, 0x333333, 0x222222];
      const colorHex = colors[Math.floor(Math.random() * colors.length)];
      const mat = new THREE.MeshStandardMaterial({
        color: colorHex,
        roughness: 0.9,
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.copy(position);
      this.group.add(mesh);

      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5 + 0.5,
        (Math.random() - 0.5) * 2
      ).normalize().multiplyScalar((isC4 ? 12 : 7) + Math.random() * 5);

      this.particles.push({
        mesh,
        velocity: vel,
        life: 1.2 + Math.random() * 0.8,
        maxLife: 2.0,
        decay: 1.0,
        color: new THREE.Color(colorHex),
        size,
      });
    }
  }

  public update(delta: number) {
    // Update Tracers
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tracer = this.tracers[i];
      tracer.life -= delta;
      if (tracer.life <= 0) {
        this.group.remove(tracer.mesh);
        tracer.mesh.geometry.dispose();
        (tracer.mesh.material as THREE.Material).dispose();
        this.tracers.splice(i, 1);
      }
    }

    // Update Particles
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= delta;

      if (p.life <= 0) {
        this.group.remove(p.mesh);
        p.mesh.geometry.dispose();
        (p.mesh.material as THREE.Material).dispose();
        this.particles.splice(i, 1);
        continue;
      }

      // Physics integration
      p.mesh.position.addScaledVector(p.velocity, delta);
      // Gravity for non-smoke
      if (p.maxLife < 10) {
        p.velocity.y -= 9.8 * delta;
      }

      // Fade opacity
      const progress = p.life / p.maxLife;
      const mat = p.mesh.material as THREE.Material & { opacity?: number };
      if (mat.opacity !== undefined) {
        mat.opacity = progress * 0.85;
      }
    }
  }

  public clear() {
    for (const p of this.particles) {
      this.group.remove(p.mesh);
      p.mesh.geometry.dispose();
      (p.mesh.material as THREE.Material).dispose();
    }
    this.particles = [];

    for (const t of this.tracers) {
      this.group.remove(t.mesh);
      t.mesh.geometry.dispose();
      (t.mesh.material as THREE.Material).dispose();
    }
    this.tracers = [];
  }
}
