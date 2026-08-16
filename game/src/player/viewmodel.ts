import * as THREE from "three";
import type { WeaponId } from "./weapons";
import { sparkTexture } from "../world/textures";

const GUN_METAL = new THREE.MeshStandardMaterial({
  color: 0x2b2f34,
  roughness: 0.45,
  metalness: 0.75,
});
const GUN_DARK = new THREE.MeshStandardMaterial({
  color: 0x17191c,
  roughness: 0.6,
  metalness: 0.5,
});
const WOOD = new THREE.MeshStandardMaterial({
  color: 0x6c452a,
  roughness: 0.8,
  metalness: 0.05,
});
const POLY = new THREE.MeshStandardMaterial({
  color: 0x3f4a3a,
  roughness: 0.85,
  metalness: 0.1,
});
const GLOVE = new THREE.MeshStandardMaterial({
  color: 0x30302f,
  roughness: 0.95,
  metalness: 0,
});
const STEEL = new THREE.MeshStandardMaterial({
  color: 0xb9c0c6,
  roughness: 0.28,
  metalness: 0.9,
});

function box(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x = 0,
  y = 0,
  z = 0,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  return mesh;
}

function hands(gunLength: number, gripZ: number): THREE.Group {
  const group = new THREE.Group();
  const rear = box(0.075, 0.075, 0.16, GLOVE, 0.005, -0.055, gripZ);
  rear.rotation.x = 0.25;
  const front = box(0.07, 0.07, 0.15, GLOVE, -0.01, -0.05, gripZ - gunLength * 0.55);
  front.rotation.x = -0.15;
  group.add(rear, front);
  return group;
}

/** Procedural low-poly weapon models — no external assets required. */
function buildWeaponModel(id: WeaponId): { group: THREE.Group; muzzle: THREE.Object3D } {
  const group = new THREE.Group();
  const muzzle = new THREE.Object3D();

  switch (id) {
    case "rifle": {
      group.add(box(0.075, 0.11, 0.62, GUN_METAL, 0, 0, -0.1));
      group.add(box(0.06, 0.09, 0.34, WOOD, 0, -0.005, 0.28));
      const mag = box(0.055, 0.2, 0.11, GUN_DARK, 0, -0.13, -0.05);
      mag.rotation.x = -0.32;
      group.add(mag);
      group.add(box(0.05, 0.05, 0.42, GUN_DARK, 0, 0.015, -0.5));
      group.add(box(0.07, 0.07, 0.2, WOOD, 0, -0.01, -0.32));
      group.add(box(0.02, 0.045, 0.03, GUN_DARK, 0, 0.085, -0.62));
      group.add(box(0.02, 0.05, 0.03, GUN_DARK, 0, 0.085, 0.08));
      const grip = box(0.05, 0.14, 0.07, GUN_DARK, 0, -0.1, 0.14);
      grip.rotation.x = 0.35;
      group.add(grip);
      group.add(hands(0.6, 0.14));
      muzzle.position.set(0, 0.015, -0.72);
      break;
    }
    case "smg": {
      group.add(box(0.07, 0.1, 0.42, GUN_DARK, 0, 0, -0.02));
      group.add(box(0.045, 0.045, 0.24, GUN_METAL, 0, 0.01, -0.32));
      const mag = box(0.05, 0.22, 0.08, GUN_DARK, 0, -0.13, -0.02);
      group.add(mag);
      group.add(box(0.05, 0.05, 0.2, GUN_DARK, 0, 0.0, 0.26));
      group.add(box(0.02, 0.04, 0.03, GUN_DARK, 0, 0.075, -0.4));
      const grip = box(0.05, 0.13, 0.06, GUN_DARK, 0, -0.09, 0.16);
      grip.rotation.x = 0.3;
      group.add(grip);
      group.add(hands(0.42, 0.16));
      muzzle.position.set(0, 0.01, -0.46);
      break;
    }
    case "pistol": {
      group.add(box(0.055, 0.085, 0.3, GUN_METAL, 0, 0, -0.02));
      group.add(box(0.045, 0.045, 0.1, GUN_DARK, 0, -0.03, -0.19));
      const grip = box(0.05, 0.16, 0.08, POLY, 0, -0.11, 0.07);
      grip.rotation.x = 0.28;
      group.add(grip);
      group.add(box(0.018, 0.03, 0.02, GUN_DARK, 0, 0.06, -0.16));
      group.add(box(0.018, 0.03, 0.02, GUN_DARK, 0, 0.06, 0.11));
      group.add(hands(0.2, 0.06));
      muzzle.position.set(0, -0.005, -0.24);
      break;
    }
    case "sniper": {
      group.add(box(0.07, 0.1, 0.7, GUN_DARK, 0, 0, -0.16));
      group.add(box(0.06, 0.1, 0.36, POLY, 0, -0.01, 0.3));
      group.add(box(0.04, 0.04, 0.5, GUN_METAL, 0, 0.01, -0.66));
      const scope = new THREE.Mesh(
        new THREE.CylinderGeometry(0.038, 0.038, 0.34, 14),
        GUN_DARK,
      );
      scope.rotation.x = Math.PI / 2;
      scope.position.set(0, 0.1, -0.1);
      group.add(scope);
      group.add(box(0.02, 0.02, 0.1, STEEL, 0.06, 0.03, 0.02));
      const grip = box(0.05, 0.14, 0.07, POLY, 0, -0.1, 0.16);
      grip.rotation.x = 0.3;
      group.add(grip);
      const bipod = box(0.012, 0.16, 0.012, GUN_DARK, 0.04, -0.11, -0.5);
      bipod.rotation.z = 0.35;
      group.add(bipod);
      group.add(hands(0.66, 0.16));
      muzzle.position.set(0, 0.01, -0.92);
      break;
    }
    case "knife": {
      const blade = box(0.018, 0.055, 0.3, STEEL, 0, 0.02, -0.2);
      blade.rotation.x = 0.06;
      group.add(blade);
      group.add(box(0.03, 0.05, 0.14, GUN_DARK, 0, 0, 0.0));
      group.add(box(0.055, 0.015, 0.03, GUN_METAL, 0, 0.01, -0.06));
      group.add(hands(0.1, 0.04));
      muzzle.position.set(0, 0, -0.3);
      break;
    }
  }

  group.traverse((obj) => {
    if (obj instanceof THREE.Mesh) {
      obj.castShadow = false;
      obj.receiveShadow = false;
      obj.renderOrder = 10;
      const material = obj.material as THREE.Material;
      material.depthTest = true;
    }
  });
  group.add(muzzle);
  return { group, muzzle };
}

export interface ViewModelInput {
  dt: number;
  speed: number;
  grounded: boolean;
  moving: boolean;
  aiming: boolean;
  reloadProgress: number | null;
  mouseDX: number;
  mouseDY: number;
}

const HIP = new THREE.Vector3(0.17, -0.16, -0.36);
const ADS = new THREE.Vector3(0, -0.075, -0.28);

export class ViewModel {
  readonly root = new THREE.Group();
  private readonly models = new Map<WeaponId, THREE.Group>();
  private readonly muzzles = new Map<WeaponId, THREE.Object3D>();
  private current: WeaponId = "rifle";

  private bobPhase = 0;
  private swayX = 0;
  private swayY = 0;
  private kickZ = 0;
  private kickPitch = 0;
  private drawTimer = 0;
  private meleeTimer = 0;

  private readonly flash: THREE.Sprite;
  private readonly flashLight: THREE.PointLight;
  private flashTimer = 0;

  constructor(camera: THREE.Camera) {
    for (const id of ["rifle", "smg", "pistol", "sniper", "knife"] as WeaponId[]) {
      const { group, muzzle } = buildWeaponModel(id);
      group.visible = false;
      this.models.set(id, group);
      this.muzzles.set(id, muzzle);
      this.root.add(group);
    }
    this.models.get(this.current)!.visible = true;

    const flashMaterial = new THREE.SpriteMaterial({
      map: sparkTexture(),
      color: 0xffd27a,
      transparent: true,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.flash = new THREE.Sprite(flashMaterial);
    this.flash.scale.set(0.4, 0.4, 0.4);
    this.flash.visible = false;
    this.flash.renderOrder = 20;
    this.root.add(this.flash);

    this.flashLight = new THREE.PointLight(0xffc978, 0, 9, 2);
    this.root.add(this.flashLight);

    camera.add(this.root);
  }

  setWeapon(id: WeaponId): void {
    if (id === this.current) return;
    this.models.get(this.current)!.visible = false;
    this.current = id;
    this.models.get(id)!.visible = true;
    this.drawTimer = 0.42;
    this.kickZ = 0;
    this.kickPitch = 0;
  }

  fire(strength: number): void {
    this.kickZ += 0.055 * strength;
    this.kickPitch += 0.05 * strength;
    this.flashTimer = 0.045;
    const muzzle = this.muzzles.get(this.current)!;
    this.flash.position.copy(muzzle.position).applyMatrix4(this.models.get(this.current)!.matrix);
    this.flash.scale.setScalar(0.28 + Math.random() * 0.16 * strength);
    this.flash.material.rotation = Math.random() * Math.PI;
    this.flash.visible = true;
    this.flashLight.position.copy(this.flash.position);
    this.flashLight.intensity = 6 * strength;
  }

  melee(): void {
    this.meleeTimer = 0.28;
  }

  /** World-space position of the current weapon's muzzle, for tracers. */
  getMuzzleWorldPosition(target: THREE.Vector3): THREE.Vector3 {
    return this.muzzles.get(this.current)!.getWorldPosition(target);
  }

  update(input: ViewModelInput): void {
    const { dt } = input;
    const model = this.models.get(this.current)!;

    // Sway follows the mouse with a spring so the gun lags behind the camera.
    const swayTargetX = THREE.MathUtils.clamp(-input.mouseDX * 0.0016, -0.05, 0.05);
    const swayTargetY = THREE.MathUtils.clamp(-input.mouseDY * 0.0016, -0.05, 0.05);
    this.swayX = THREE.MathUtils.damp(this.swayX, swayTargetX, 9, dt);
    this.swayY = THREE.MathUtils.damp(this.swayY, swayTargetY, 9, dt);

    if (input.moving && input.grounded) {
      this.bobPhase += dt * (5.2 + input.speed * 1.15);
    } else {
      this.bobPhase = THREE.MathUtils.damp(this.bobPhase % (Math.PI * 2), 0, 6, dt);
    }
    const bobAmount = input.aiming ? 0.28 : 1;
    const bobX = Math.cos(this.bobPhase) * 0.012 * bobAmount * Math.min(1, input.speed / 4);
    const bobY = Math.abs(Math.sin(this.bobPhase)) * 0.011 * bobAmount * Math.min(1, input.speed / 4);

    const base = input.aiming ? ADS : HIP;
    const targetPos = new THREE.Vector3(
      base.x + this.swayX + bobX,
      base.y + this.swayY - bobY,
      base.z,
    );

    // Reload: dip the weapon out of view and rock it.
    let reloadPitch = 0;
    let reloadRoll = 0;
    if (input.reloadProgress !== null) {
      const p = input.reloadProgress;
      const dip = Math.sin(Math.min(1, p * 1.35) * Math.PI);
      targetPos.y -= dip * 0.16;
      targetPos.z += dip * 0.04;
      reloadPitch = dip * 0.55;
      reloadRoll = Math.sin(p * Math.PI * 3) * 0.18 * dip;
    }

    if (this.drawTimer > 0) {
      this.drawTimer = Math.max(0, this.drawTimer - dt);
      const t = this.drawTimer / 0.42;
      targetPos.y -= t * 0.24;
      reloadPitch += t * 0.6;
    }

    let meleePitch = 0;
    let meleeYaw = 0;
    if (this.meleeTimer > 0) {
      this.meleeTimer = Math.max(0, this.meleeTimer - dt);
      const t = 1 - this.meleeTimer / 0.28;
      const swing = Math.sin(t * Math.PI);
      meleePitch = -swing * 0.9;
      meleeYaw = swing * 0.8;
      targetPos.z -= swing * 0.18;
    }

    this.kickZ = THREE.MathUtils.damp(this.kickZ, 0, 12, dt);
    this.kickPitch = THREE.MathUtils.damp(this.kickPitch, 0, 12, dt);

    model.position.lerp(
      targetPos.clone().add(new THREE.Vector3(0, 0, this.kickZ)),
      1 - Math.exp(-24 * dt),
    );
    model.rotation.set(
      this.kickPitch + reloadPitch + meleePitch,
      meleeYaw + this.swayX * 1.6,
      reloadRoll + this.swayX * 2.2,
    );
    model.updateMatrix();

    if (this.flashTimer > 0) {
      this.flashTimer -= dt;
      if (this.flashTimer <= 0) {
        this.flash.visible = false;
        this.flashLight.intensity = 0;
      } else {
        this.flashLight.intensity *= 0.6;
      }
    }
  }
}
