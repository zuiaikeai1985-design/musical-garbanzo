import * as THREE from "three";

/** 生成柔和圆形光斑贴图 */
function glowTexture(color) {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const ctx = c.getContext("2d");
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, color);
  g.addColorStop(0.4, color.replace("1)", "0.55)"));
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Effects {
  constructor(scene) {
    this.scene = scene;
    this.tracers = [];
    this.particles = [];
    this.casings = [];
    this.flashes = [];
    this.decals = [];
    this.maxDecals = 64;

    this.flashTex = glowTexture("rgba(255,220,120,1)");
    this.sparkTex = glowTexture("rgba(255,200,110,1)");
    this.bloodTex = glowTexture("rgba(200,20,20,1)");
    this.decalGeo = new THREE.CircleGeometry(0.045, 8);
    this.decalMat = new THREE.MeshBasicMaterial({
      color: "#1b1b1b",
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    this.casingGeo = new THREE.BoxGeometry(0.02, 0.02, 0.05);
    this.casingMat = new THREE.MeshBasicMaterial({ color: "#d8b24a" });
  }

  /** 弹道轨迹（快速淡出的亮线） */
  tracer(start, end, color = 0xffe08a) {
    const geo = new THREE.BufferGeometry().setFromPoints([start, end]);
    const mat = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const line = new THREE.Line(geo, mat);
    this.scene.add(line);
    this.tracers.push({ obj: line, life: 0.12, total: 0.12 });
  }

  /** 世界坐标枪口闪光（敌人开枪用） */
  worldFlash(pos) {
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.flashTex,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    sprite.position.copy(pos);
    sprite.scale.setScalar(0.7 + Math.random() * 0.3);
    this.scene.add(sprite);
    this.flashes.push({ obj: sprite, life: 0.09, total: 0.09 });
  }

  /** 命中特效：wall=火花+弹孔，flesh=血液 */
  impact(point, normal, surface) {
    const isFlesh = surface === "flesh";
    const count = isFlesh ? 10 : 7;
    for (let i = 0; i < count; i++) {
      const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: isFlesh ? this.bloodTex : this.sparkTex,
          transparent: true,
          blending: isFlesh ? THREE.NormalBlending : THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      sprite.position.copy(point);
      sprite.scale.setScalar(isFlesh ? 0.1 + Math.random() * 0.12 : 0.05 + Math.random() * 0.07);
      const vel = new THREE.Vector3(
        (Math.random() - 0.5) * 2,
        Math.random() * 1.5,
        (Math.random() - 0.5) * 2,
      );
      if (normal) vel.addScaledVector(normal, 1.5 + Math.random() * 2);
      vel.multiplyScalar(isFlesh ? 1.2 : 1.6);
      this.scene.add(sprite);
      this.particles.push({
        obj: sprite,
        vel,
        life: 0.35 + Math.random() * 0.2,
        total: 0.5,
        gravity: isFlesh ? 6 : 9,
      });
    }
    if (!isFlesh && normal) this.bulletHole(point, normal);
  }

  bulletHole(point, normal) {
    const mesh = new THREE.Mesh(this.decalGeo, this.decalMat);
    mesh.position.copy(point).addScaledVector(normal, 0.008);
    mesh.lookAt(point.clone().add(normal));
    this.scene.add(mesh);
    this.decals.push(mesh);
    if (this.decals.length > this.maxDecals) {
      const old = this.decals.shift();
      this.scene.remove(old);
    }
  }

  /** 抛壳 */
  shellCasing(pos, rightDir) {
    const mesh = new THREE.Mesh(this.casingGeo, this.casingMat);
    mesh.position.copy(pos);
    const vel = rightDir
      .clone()
      .multiplyScalar(1.2 + Math.random() * 0.8)
      .add(new THREE.Vector3(0, 1.8 + Math.random(), 0));
    this.scene.add(mesh);
    this.casings.push({
      obj: mesh,
      vel,
      spin: new THREE.Vector3(Math.random() * 20, Math.random() * 20, Math.random() * 20),
      life: 1.0,
      total: 1.0,
    });
  }

  update(dt) {
    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const t = this.tracers[i];
      t.life -= dt;
      t.obj.material.opacity = Math.max(0, (t.life / t.total) * 0.85);
      if (t.life <= 0) {
        this.scene.remove(t.obj);
        t.obj.geometry.dispose();
        t.obj.material.dispose();
        this.tracers.splice(i, 1);
      }
    }
    for (let i = this.flashes.length - 1; i >= 0; i--) {
      const f = this.flashes[i];
      f.life -= dt;
      if (f.life <= 0) {
        this.scene.remove(f.obj);
        f.obj.material.dispose();
        this.flashes.splice(i, 1);
      }
    }
    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.life -= dt;
      p.vel.y -= p.gravity * dt;
      p.obj.position.addScaledVector(p.vel, dt);
      p.obj.material.opacity = Math.max(0, p.life / p.total);
      if (p.life <= 0 || p.obj.position.y < 0) {
        this.scene.remove(p.obj);
        p.obj.material.dispose();
        this.particles.splice(i, 1);
      }
    }
    for (let i = this.casings.length - 1; i >= 0; i--) {
      const c = this.casings[i];
      c.life -= dt;
      c.vel.y -= 12 * dt;
      c.obj.position.addScaledVector(c.vel, dt);
      c.obj.rotation.x += c.spin.x * dt;
      c.obj.rotation.y += c.spin.y * dt;
      if (c.obj.position.y < 0.02) {
        c.obj.position.y = 0.02;
        c.vel.y *= -0.3;
        c.vel.x *= 0.6;
        c.vel.z *= 0.6;
      }
      if (c.life <= 0) {
        this.scene.remove(c.obj);
        this.casings.splice(i, 1);
      }
    }
  }

  clearTransient() {
    for (const arr of [this.tracers, this.flashes, this.particles, this.casings]) {
      for (const item of arr) this.scene.remove(item.obj);
      arr.length = 0;
    }
  }
}
