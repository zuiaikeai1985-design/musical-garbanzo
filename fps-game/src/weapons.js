import * as THREE from "three";
import { clamp, lerp, randRange, DEG } from "./utils.js";

export const WEAPONS = {
  knife: {
    id: "knife",
    name: "军刀",
    slot: 3,
    price: 0,
    type: "melee",
    damage: 55,
    fireRate: 1.9,
    range: 2.3,
    speedScale: 1.06,
  },
  usp: {
    id: "usp",
    name: "USP 手枪",
    slot: 2,
    price: 0,
    type: "pistol",
    auto: false,
    damage: 26,
    headMul: 4,
    fireRate: 5.5,
    magSize: 12,
    reserve: 36,
    reloadTime: 1.9,
    spread: 0.35 * DEG,
    moveSpread: 1.6 * DEG,
    bloomPerShot: 0.28 * DEG,
    recoilPitch: 0.55 * DEG,
    recoilYaw: 0.22 * DEG,
    kick: 0.035,
    range: 120,
    speedScale: 1.0,
    zoomFov: 68,
  },
  mp5: {
    id: "mp5",
    name: "MP5 冲锋枪",
    slot: 1,
    price: 1500,
    type: "smg",
    auto: true,
    damage: 20,
    headMul: 3.8,
    fireRate: 12,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.2,
    spread: 0.5 * DEG,
    moveSpread: 1.1 * DEG,
    bloomPerShot: 0.16 * DEG,
    recoilPitch: 0.38 * DEG,
    recoilYaw: 0.2 * DEG,
    kick: 0.025,
    range: 110,
    speedScale: 0.99,
    zoomFov: 66,
  },
  shotgun: {
    id: "shotgun",
    name: "XM 霰弹枪",
    slot: 1,
    price: 1200,
    type: "shotgun",
    auto: false,
    damage: 11,
    headMul: 2.2,
    pellets: 8,
    fireRate: 1.05,
    magSize: 8,
    reserve: 32,
    reloadTime: 2.8,
    spread: 3.2 * DEG,
    moveSpread: 1.2 * DEG,
    bloomPerShot: 0.2 * DEG,
    recoilPitch: 2.6 * DEG,
    recoilYaw: 0.5 * DEG,
    kick: 0.1,
    range: 45,
    speedScale: 0.96,
    zoomFov: 70,
  },
  ak47: {
    id: "ak47",
    name: "AK-47",
    slot: 1,
    price: 2700,
    type: "rifle",
    auto: true,
    damage: 34,
    headMul: 4.2,
    fireRate: 10,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.4,
    spread: 0.42 * DEG,
    moveSpread: 2.4 * DEG,
    bloomPerShot: 0.34 * DEG,
    recoilPitch: 0.85 * DEG,
    recoilYaw: 0.42 * DEG,
    kick: 0.045,
    range: 150,
    speedScale: 0.94,
    zoomFov: 62,
  },
  m4: {
    id: "m4",
    name: "M4A1 卡宾枪",
    slot: 1,
    price: 3100,
    type: "rifle",
    auto: true,
    damage: 29,
    headMul: 4,
    fireRate: 11,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.2,
    spread: 0.36 * DEG,
    moveSpread: 2.0 * DEG,
    bloomPerShot: 0.26 * DEG,
    recoilPitch: 0.62 * DEG,
    recoilYaw: 0.3 * DEG,
    kick: 0.038,
    range: 150,
    speedScale: 0.94,
    zoomFov: 62,
  },
  awp: {
    id: "awp",
    name: "AWP 狙击枪",
    slot: 1,
    price: 4750,
    type: "sniper",
    auto: false,
    damage: 112,
    headMul: 2,
    fireRate: 0.85,
    magSize: 5,
    reserve: 20,
    reloadTime: 3.2,
    spread: 4.5 * DEG, // 未开镜
    scopedSpread: 0.04 * DEG,
    moveSpread: 3 * DEG,
    bloomPerShot: 0.4 * DEG,
    recoilPitch: 2.4 * DEG,
    recoilYaw: 0.3 * DEG,
    kick: 0.14,
    range: 300,
    speedScale: 0.85,
    zoomFov: 20,
  },
};

const HIP_POS = new THREE.Vector3(0.27, -0.25, -0.5);
const ADS_POS = new THREE.Vector3(0, -0.175, -0.38);

function boxMesh(w, h, d, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(
    new THREE.BoxGeometry(w, h, d),
    new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.35 }),
  );
  m.position.set(x, y, z);
  return m;
}

function cylMesh(r, len, color, x = 0, y = 0, z = 0, rotX = Math.PI / 2) {
  const m = new THREE.Mesh(
    new THREE.CylinderGeometry(r, r, len, 10),
    new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.4 }),
  );
  m.rotation.x = rotX;
  m.position.set(x, y, z);
  return m;
}

/** 用几何体拼出各武器的第一人称模型，返回 { group, muzzle } */
function buildViewModel(id) {
  const g = new THREE.Group();
  let muzzleZ = -0.35;
  const dark = "#23262a";
  const gray = "#3d4148";
  const wood = "#6e4a26";

  if (id === "knife") {
    g.add(boxMesh(0.035, 0.09, 0.13, "#2c2c30", 0, -0.03, 0.05));
    const blade = boxMesh(0.012, 0.055, 0.3, "#b9c2c9", 0, 0.01, -0.14);
    blade.rotation.x = -0.06;
    g.add(blade);
    const tip = boxMesh(0.012, 0.035, 0.08, "#cdd6dd", 0, 0.02, -0.3);
    tip.rotation.x = -0.25;
    g.add(tip);
    muzzleZ = -0.2;
  } else if (id === "usp") {
    g.add(boxMesh(0.05, 0.09, 0.26, dark, 0, 0.02, -0.05));
    g.add(boxMesh(0.052, 0.045, 0.26, gray, 0, 0.075, -0.05));
    const grip = boxMesh(0.048, 0.13, 0.07, "#2a2d33", 0, -0.06, 0.06);
    grip.rotation.x = 0.25;
    g.add(grip);
    g.add(cylMesh(0.014, 0.06, dark, 0, 0.06, -0.2));
    muzzleZ = -0.24;
  } else if (id === "mp5") {
    g.add(boxMesh(0.055, 0.1, 0.42, dark, 0, 0.02, -0.08));
    g.add(cylMesh(0.02, 0.22, gray, 0, 0.045, -0.34));
    const mag = boxMesh(0.04, 0.2, 0.07, gray, 0, -0.11, -0.1);
    mag.rotation.x = -0.35;
    g.add(mag);
    g.add(boxMesh(0.045, 0.1, 0.08, "#2a2d33", 0, -0.05, 0.12));
    g.add(boxMesh(0.02, 0.03, 0.2, dark, 0, 0.1, -0.05));
    muzzleZ = -0.46;
  } else if (id === "shotgun") {
    g.add(boxMesh(0.055, 0.09, 0.5, "#3a2c1c", 0, 0, -0.05));
    g.add(cylMesh(0.022, 0.4, dark, 0, 0.05, -0.3));
    g.add(cylMesh(0.018, 0.34, gray, 0, -0.005, -0.33));
    g.add(boxMesh(0.05, 0.05, 0.12, wood, 0, -0.05, -0.28));
    g.add(boxMesh(0.05, 0.12, 0.1, wood, 0, -0.05, 0.14));
    muzzleZ = -0.52;
  } else if (id === "ak47") {
    g.add(boxMesh(0.05, 0.09, 0.5, dark, 0, 0.02, -0.1));
    g.add(boxMesh(0.052, 0.06, 0.2, wood, 0, 0.0, -0.25));
    g.add(cylMesh(0.014, 0.18, dark, 0, 0.035, -0.42));
    g.add(boxMesh(0.02, 0.05, 0.02, dark, 0, 0.075, -0.45));
    const mag1 = boxMesh(0.042, 0.13, 0.075, "#5a4420", 0, -0.09, -0.06);
    mag1.rotation.x = -0.4;
    g.add(mag1);
    const mag2 = boxMesh(0.042, 0.1, 0.07, "#5a4420", 0, -0.16, 0.0);
    mag2.rotation.x = -0.75;
    g.add(mag2);
    g.add(boxMesh(0.045, 0.09, 0.16, wood, 0, -0.03, 0.13));
    muzzleZ = -0.52;
  } else if (id === "m4") {
    g.add(boxMesh(0.05, 0.09, 0.46, gray, 0, 0.02, -0.1));
    g.add(boxMesh(0.03, 0.035, 0.22, dark, 0, 0.085, -0.02));
    g.add(cylMesh(0.015, 0.24, dark, 0, 0.035, -0.42));
    g.add(boxMesh(0.02, 0.06, 0.02, dark, 0, 0.08, -0.48));
    g.add(boxMesh(0.04, 0.16, 0.06, dark, 0, -0.1, -0.04));
    g.add(boxMesh(0.045, 0.08, 0.14, gray, 0, -0.04, 0.12));
    muzzleZ = -0.55;
  } else if (id === "awp") {
    g.add(boxMesh(0.055, 0.09, 0.62, "#3f4a34", 0, 0, -0.12));
    g.add(cylMesh(0.016, 0.34, dark, 0, 0.03, -0.55));
    g.add(cylMesh(0.035, 0.22, dark, 0, 0.095, -0.1));
    g.add(cylMesh(0.04, 0.03, "#10141a", 0, 0.095, 0.02));
    const bolt = boxMesh(0.02, 0.02, 0.08, "#9aa2ab", 0.045, 0.04, 0.02);
    g.add(bolt);
    g.add(boxMesh(0.05, 0.11, 0.14, "#39422f", 0, -0.05, 0.16));
    g.add(boxMesh(0.04, 0.12, 0.06, "#2c3324", 0, -0.1, -0.02));
    muzzleZ = -0.73;
  }

  const muzzle = new THREE.Object3D();
  muzzle.position.set(0, 0.03, muzzleZ);
  g.add(muzzle);
  return { group: g, muzzle };
}

export class WeaponSystem {
  constructor(camera, player, world, enemies, effects, audio, hud) {
    this.camera = camera;
    this.player = player;
    this.world = world;
    this.enemies = enemies;
    this.effects = effects;
    this.audio = audio;
    this.hud = hud;

    this.root = new THREE.Group();
    camera.add(this.root);
    this.models = {};
    for (const id of Object.keys(WEAPONS)) {
      const { group, muzzle } = buildViewModel(id);
      group.visible = false;
      this.root.add(group);
      this.models[id] = { group, muzzle };
    }
    // 枪口闪光
    const flashMat = new THREE.SpriteMaterial({
      map: effects.flashTex,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    });
    this.flashSprite = new THREE.Sprite(flashMat);
    this.flashSprite.scale.setScalar(0.22);
    this.flashSprite.visible = false;
    this.flashLight = new THREE.PointLight("#ffca6a", 0, 8);
    this.root.add(this.flashLight);

    this.reset(true);

    this.bobT = 0;
    this.swayX = 0;
    this.swayY = 0;
    this.kickZ = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
    this.bloom = 0;
    this.aim = 0; // 0=腰射 1=瞄准
    this.aimToggle = false;
    this.flashTimer = 0;
    this.prevFireHeld = false;
    this.onAmmoChanged = null;
    this.onShot = null;
  }

  /** 初始/重置装备。fullReset=true 时清掉主武器 */
  reset(fullReset = false) {
    if (fullReset || !this.ammo) {
      this.primary = null;
      this.ammo = {};
      this._initAmmo("usp");
    }
    this.current = this.primary || "usp";
    this.switchTimer = 0.4;
    this.reloadTimer = 0;
    this.reloadStage = -1;
    this.fireTimer = 0;
    this.aim = 0;
    this.aimToggle = false;
    this._showModel(this.current);
  }

  _initAmmo(id) {
    const def = WEAPONS[id];
    if (def.magSize) this.ammo[id] = { mag: def.magSize, reserve: def.reserve };
  }

  get def() {
    return WEAPONS[this.current];
  }

  owns(id) {
    return id === "knife" || id === "usp" || this.primary === id;
  }

  /** 购买武器（返回是否成功放入主武器槽） */
  give(id) {
    const def = WEAPONS[id];
    if (!def || def.slot !== 1) return false;
    this.primary = id;
    this._initAmmo(id);
    this.switchTo(id);
    return true;
  }

  fillAmmo() {
    for (const id of Object.keys(this.ammo)) {
      this.ammo[id].reserve = WEAPONS[id].reserve;
    }
    this._ammoChanged();
  }

  switchTo(id) {
    if (!this.owns(id) || id === this.current) return;
    this.lastWeapon = this.current;
    this.current = id;
    this.switchTimer = 0.42;
    this.reloadTimer = 0;
    this.reloadStage = -1;
    this.aim = 0;
    this.aimToggle = false;
    this._showModel(id);
    this._ammoChanged();
  }

  _showModel(id) {
    for (const key of Object.keys(this.models)) {
      this.models[key].group.visible = key === id;
    }
  }

  _ammoChanged() {
    if (this.onAmmoChanged) this.onAmmoChanged(this.getAmmoInfo());
  }

  getAmmoInfo() {
    const def = this.def;
    if (def.type === "melee") return { name: def.name, mag: "--", reserve: "" };
    const a = this.ammo[this.current];
    return { name: def.name, mag: a.mag, reserve: a.reserve };
  }

  isScoped() {
    return this.def.type === "sniper" && this.aim > 0.7;
  }

  getFov(baseFov) {
    const def = this.def;
    const target = def.zoomFov || baseFov;
    return lerp(baseFov, target, this.aim);
  }

  getSensScale() {
    return this.isScoped() ? 0.35 : 1;
  }

  /** 当前总散布（弧度） */
  getSpread() {
    const def = this.def;
    if (def.type === "melee") return 0;
    let spread = def.spread;
    if (def.type === "sniper") {
      spread = this.aim > 0.7 ? def.scopedSpread : def.spread;
    } else {
      spread *= lerp(1, 0.55, this.aim);
    }
    const moveFactor = clamp(this.player.moveSpeed2D / 6.4, 0, 1);
    spread += def.moveSpread * moveFactor;
    if (!this.player.onGround) spread += 2.2 * DEG;
    if (this.player.crouching) spread *= 0.72;
    spread += this.bloom;
    return spread;
  }

  update(dt, input, canFire, allowSwitch = true) {
    const def = this.def;
    this.player.speedScale = def.speedScale;

    // 切枪
    if (allowSwitch) {
      if (input.wasPressed("Digit1") && this.primary) this.switchTo(this.primary);
      if (input.wasPressed("Digit2")) this.switchTo("usp");
      if (input.wasPressed("Digit3")) this.switchTo("knife");
      if (input.wasPressed("KeyQ") && this.lastWeapon && this.owns(this.lastWeapon)) {
        this.switchTo(this.lastWeapon);
      }
      if (input.wheelDelta !== 0) {
        const order = [this.primary, "usp", "knife"].filter(Boolean);
        const idx = order.indexOf(this.current);
        const next = order[(idx + (input.wheelDelta > 0 ? 1 : order.length - 1)) % order.length];
        this.switchTo(next);
      }
    }

    if (this.switchTimer > 0) this.switchTimer -= dt;
    if (this.fireTimer > 0) this.fireTimer -= dt;

    // 瞄准
    if (input.wasPressed("KeyZ")) this.aimToggle = !this.aimToggle;
    const wantAim =
      canFire &&
      def.type !== "melee" &&
      this.reloadTimer <= 0 &&
      this.switchTimer <= 0 &&
      (input.mouse2Down || this.aimToggle);
    this.aim = clamp(this.aim + (wantAim ? dt * 7 : -dt * 9), 0, 1);

    // 换弹
    if (this.reloadTimer > 0) {
      const t = 1 - this.reloadTimer / def.reloadTime;
      if (this.reloadStage === 0 && t > 0.18) {
        this.audio.reload(0);
        this.reloadStage = 1;
      } else if (this.reloadStage === 1 && t > 0.62) {
        this.audio.reload(1);
        this.reloadStage = 2;
      } else if (this.reloadStage === 2 && t > 0.9) {
        this.audio.reload(2);
        this.reloadStage = 3;
      }
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const a = this.ammo[this.current];
        const need = def.magSize - a.mag;
        const take = Math.min(need, a.reserve);
        a.mag += take;
        a.reserve -= take;
        this.reloadStage = -1;
        this._ammoChanged();
      }
    } else if (canFire && input.wasPressed("KeyR")) {
      this.tryReload();
    }

    // 开火（clicks/wasPressed 兜底：低帧率下按下+抬起可能发生在同一帧内）
    const fireHeld = input.mouseDown || input.isDown("Enter");
    const fireTapped = input.clicks > 0 || input.wasPressed("Enter");
    const firePressed = (fireHeld && !this.prevFireHeld) || fireTapped;
    this.prevFireHeld = fireHeld;
    if (canFire && this.switchTimer <= 0 && this.reloadTimer <= 0 && this.fireTimer <= 0) {
      const shouldFire = def.auto ? fireHeld || fireTapped : firePressed;
      if (shouldFire || (def.type === "melee" && firePressed)) {
        if (def.type === "melee") {
          this._swingKnife();
        } else {
          const a = this.ammo[this.current];
          if (a.mag <= 0) {
            if (firePressed) {
              this.audio.dryFire();
              this.tryReload();
            }
          } else {
            this._fire();
          }
        }
      }
    }

    // 后座恢复与散布收敛
    this.recoilPitch = lerp(this.recoilPitch, 0, Math.min(1, dt * 9));
    this.recoilYaw = lerp(this.recoilYaw, 0, Math.min(1, dt * 9));
    this.bloom = Math.max(0, this.bloom - dt * 3 * DEG);
    this.kickZ = lerp(this.kickZ, 0, Math.min(1, dt * 10));

    this.player.syncCamera(this.recoilPitch, this.recoilYaw);
    this._animateViewModel(dt, input);

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flashSprite.visible = false;
        this.flashLight.intensity = 0;
      }
    }
  }

  tryReload() {
    const def = this.def;
    if (def.type === "melee" || this.reloadTimer > 0 || this.switchTimer > 0) return;
    const a = this.ammo[this.current];
    if (a.mag >= def.magSize || a.reserve <= 0) return;
    this.reloadTimer = def.reloadTime;
    this.reloadStage = 0;
    this.aim = 0;
    this.aimToggle = false;
  }

  _spreadDir() {
    const dir = this.player.aimDir();
    const spread = this.getSpread();
    if (spread <= 0) return dir;
    const up = Math.abs(dir.y) > 0.98 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(dir, up).normalize();
    const realUp = new THREE.Vector3().crossVectors(right, dir).normalize();
    const angle = Math.random() * Math.PI * 2;
    const r = Math.sqrt(Math.random()) * spread;
    dir.addScaledVector(right, Math.cos(angle) * r).addScaledVector(realUp, Math.sin(angle) * r);
    return dir.normalize();
  }

  _muzzleWorld() {
    this.camera.updateMatrixWorld();
    return this.models[this.current].muzzle.getWorldPosition(new THREE.Vector3());
  }

  _fire() {
    const def = this.def;
    const a = this.ammo[this.current];
    a.mag--;
    this.fireTimer = 1 / def.fireRate;
    this.audio.shot(def.id);
    if (this.onShot) this.onShot();

    const pellets = def.pellets || 1;
    const origin = this.player.eyePos;
    const muzzle = this._muzzleWorld();
    for (let p = 0; p < pellets; p++) {
      const dir = this._spreadDir();
      const wallHit = this.world.raycast(origin, dir, def.range);
      const maxD = wallHit ? wallHit.dist : def.range;
      const botHit = this.enemies.raycast(origin, dir, maxD);
      let endPoint;
      if (botHit) {
        endPoint = botHit.point;
        let dmg = def.damage * (botHit.isHead ? def.headMul || 1 : 1);
        if (def.type !== "sniper") {
          dmg *= clamp(1 - (botHit.dist - 15) / 80, 0.4, 1);
        }
        this.effects.impact(botHit.point, null, "flesh");
        this.enemies.applyDamage(botHit.bot, Math.round(dmg), botHit.isHead, def.id);
        this.hud.hitmarker(botHit.isHead);
        this.audio.hitmarker(botHit.isHead);
      } else if (wallHit) {
        endPoint = wallHit.point;
        this.effects.impact(wallHit.point, wallHit.normal, "wall");
      } else {
        endPoint = origin.clone().addScaledVector(dir, def.range);
      }
      if (pellets === 1 || p % 2 === 0) {
        this.effects.tracer(muzzle, endPoint);
      }
    }

    // 后座
    this.recoilPitch += def.recoilPitch * randRange(0.8, 1.2);
    this.recoilYaw += def.recoilYaw * randRange(-1, 1);
    this.player.pitch += def.recoilPitch * 0.35;
    this.bloom = Math.min(this.bloom + def.bloomPerShot, 3 * DEG);
    this.kickZ += def.kick;

    // 枪口闪光 + 抛壳
    const m = this.models[this.current].muzzle;
    this.flashSprite.position.copy(m.getWorldPosition(new THREE.Vector3()));
    this.root.worldToLocal(this.flashSprite.position);
    if (this.flashSprite.parent !== this.root) this.root.add(this.flashSprite);
    this.flashSprite.material.rotation = Math.random() * Math.PI;
    this.flashSprite.visible = true;
    this.flashLight.position.copy(this.flashSprite.position);
    this.flashLight.intensity = 18;
    this.flashTimer = 0.045;
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(this.camera.quaternion);
    this.effects.shellCasing(muzzle.clone().addScaledVector(right, 0.05), right);

    if (def.type === "sniper") {
      this.aim = 0;
      this.aimToggle = false;
    }
    this._ammoChanged();
  }

  _swingKnife() {
    const def = this.def;
    this.fireTimer = 1 / def.fireRate;
    this.audio.knifeSwing();
    this.kickZ -= 0.1;
    const origin = this.player.eyePos;
    const dir = this.player.aimDir();
    const botHit = this.enemies.raycast(origin, dir, def.range);
    if (botHit) {
      this.effects.impact(botHit.point, null, "flesh");
      this.enemies.applyDamage(botHit.bot, def.damage, false, def.id);
      this.hud.hitmarker(false);
      this.audio.knifeHit();
    } else {
      const wallHit = this.world.raycast(origin, dir, def.range);
      if (wallHit) {
        this.effects.impact(wallHit.point, wallHit.normal, "wall");
        this.audio.knifeHit();
      }
    }
  }

  _animateViewModel(dt, input) {
    const model = this.models[this.current].group;
    const def = this.def;

    // 移动摆动
    if (this.player.onGround && this.player.moveSpeed2D > 0.5) {
      this.bobT += dt * this.player.moveSpeed2D * 1.7;
    }
    const bobAmt = clamp(this.player.moveSpeed2D / 6.4, 0, 1) * (1 - this.aim * 0.85);
    const bobX = Math.cos(this.bobT) * 0.012 * bobAmt;
    const bobY = Math.abs(Math.sin(this.bobT)) * -0.014 * bobAmt;

    // 视角滑动惯性
    this.swayX = lerp(this.swayX, clamp(-input.mouseDX * 0.0006, -0.03, 0.03), Math.min(1, dt * 12));
    this.swayY = lerp(this.swayY, clamp(input.mouseDY * 0.0005, -0.02, 0.02), Math.min(1, dt * 12));

    // 换弹/切枪下沉
    let dipY = 0;
    let dipRot = 0;
    if (this.reloadTimer > 0) {
      const t = 1 - this.reloadTimer / def.reloadTime;
      const s = Math.sin(Math.min(t * 1.25, 1) * Math.PI);
      dipY = -0.12 * s;
      dipRot = -0.5 * s;
    }
    if (this.switchTimer > 0) {
      const t = this.switchTimer / 0.42;
      dipY -= 0.25 * t;
      dipRot -= 0.7 * t;
    }

    const targetPos = new THREE.Vector3().lerpVectors(HIP_POS, ADS_POS, this.aim);
    model.position.set(
      targetPos.x + bobX + this.swayX,
      targetPos.y + bobY + this.swayY + dipY,
      targetPos.z + this.kickZ,
    );
    model.rotation.set(dipRot + this.kickZ * 0.8 + (def.type === "melee" ? this.kickZ * 3 : 0), this.swayX * 1.5, 0);

    // 开镜时隐藏狙击枪模型（用全屏镜片 UI 代替）
    model.visible = !(def.type === "sniper" && this.aim > 0.85);
  }
}
