import * as THREE from "three";
import { Input } from "./input";
import { clamp, normalize2, resolveCapsule } from "./math";
import type { AABB, Team, WeaponState } from "./types";
import { beginReload, createWeaponState, currentSpread, tickWeapon } from "./weapons";

export const PLAYER_RADIUS = 0.38;
export const PLAYER_HEIGHT = 1.72;
export const CROUCH_HEIGHT = 1.22;

export class Player {
  readonly camera: THREE.PerspectiveCamera;
  readonly team: Team;
  name = "YOU";
  pos = { x: 0, y: 0, z: 0 };
  vel = { x: 0, y: 0, z: 0 };
  yaw = 0;
  pitch = 0;
  health = 100;
  armor = 0;
  hasHelmet = false;
  money = 3500;
  kills = 0;
  deaths = 0;
  grounded = true;
  crouching = false;
  walking = false;
  invuln = 0;
  spray = 0;
  scoped = false;
  sensitivity = 1;
  weapons: WeaponState[] = [];
  active = 0;
  recoilPitch = 0;
  recoilYaw = 0;
  viewKick = 0;
  stepTimer = 0;
  alive = true;
  spawnProtect = 0;

  constructor(team: Team, camera: THREE.PerspectiveCamera) {
    this.team = team;
    this.camera = camera;
    const pistol = team === "T" ? "glock" : "usp";
    const rifle = team === "T" ? "ak47" : "m4a4";
    this.weapons = [createWeaponState(rifle), createWeaponState(pistol), createWeaponState("knife")];
    this.active = 1;
  }

  get weapon(): WeaponState {
    return this.weapons[this.active];
  }

  get height(): number {
    return this.crouching ? CROUCH_HEIGHT : PLAYER_HEIGHT;
  }

  get eyeY(): number {
    return this.pos.y + this.height * 0.92;
  }

  get moving(): boolean {
    return Math.hypot(this.vel.x, this.vel.z) > 0.8;
  }

  spawnAt(x: number, z: number, yaw: number): void {
    this.pos = { x, y: 0, z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = yaw;
    this.pitch = 0;
    this.health = 100;
    this.alive = true;
    this.invuln = 1.4;
    this.spawnProtect = 1.4;
    this.scoped = false;
    this.spray = 0;
    this.recoilPitch = 0;
    this.recoilYaw = 0;
  }

  give(id: string): boolean {
    const next = createWeaponState(id);
    const idx = this.weapons.findIndex((w) => w.def.slot === next.def.slot);
    if (idx >= 0) this.weapons[idx] = next;
    else this.weapons.push(next);
    this.active = this.weapons.findIndex((w) => w.def.id === id);
    return true;
  }

  buy(id: string, price: number): boolean {
    if (this.money < price) return false;
    this.money -= price;
    this.give(id);
    return true;
  }

  buyArmor(): boolean {
    if (this.money < 1000) return false;
    this.money -= 1000;
    this.armor = 100;
    this.hasHelmet = true;
    return true;
  }

  look(input: Input): void {
    const sens = 0.0022 * this.sensitivity;
    this.yaw -= input.mouseDX * sens;
    this.pitch -= input.mouseDY * sens;
    this.pitch = clamp(this.pitch, -1.25, 1.25);
  }

  update(dt: number, input: Input, colliders: AABB[]): { footstep: boolean; reloaded: boolean } {
    if (!this.alive) return { footstep: false, reloaded: false };

    this.look(input);
    this.crouching = input.keys.has("ControlLeft") || input.keys.has("ControlRight");
    this.walking = input.keys.has("ShiftLeft") || input.keys.has("ShiftRight");

    if (input.consumeKey("Digit1")) this.switchSlot(1);
    if (input.consumeKey("Digit2")) this.switchSlot(2);
    if (input.consumeKey("Digit3")) this.switchSlot(3);
    if (input.consumeKey("KeyR")) beginReload(this.weapon);

    const reloaded = tickWeapon(this.weapon, dt);
    this.invuln = Math.max(0, this.invuln - dt);
    this.spawnProtect = Math.max(0, this.spawnProtect - dt);
    this.recoilPitch = lerpToward(this.recoilPitch, 0, dt * 8);
    this.recoilYaw = lerpToward(this.recoilYaw, 0, dt * 8);
    this.viewKick = lerpToward(this.viewKick, 0, dt * 10);
    this.spray = lerpToward(this.spray, 0, dt * 6);

    let mx = 0;
    let mz = 0;
    if (input.keys.has("KeyW")) mz += 1;
    if (input.keys.has("KeyS")) mz -= 1;
    if (input.keys.has("KeyA")) mx -= 1;
    if (input.keys.has("KeyD")) mx += 1;
    const wish = normalize2(mx, mz);
    const forward = { x: -Math.sin(this.yaw), z: -Math.cos(this.yaw) };
    const right = { x: Math.cos(this.yaw), z: -Math.sin(this.yaw) };
    const wishDir = {
      x: forward.x * wish.z + right.x * wish.x,
      z: forward.z * wish.z + right.z * wish.x,
    };

    const maxSpeed = this.crouching ? 2.15 : this.walking ? 3.1 : this.weapon.def.id === "awp" ? 5.2 : 6.4;
    const accel = this.grounded ? 38 : 9;
    if (this.grounded) {
      this.vel.x *= Math.max(0, 1 - 10 * dt);
      this.vel.z *= Math.max(0, 1 - 10 * dt);
    }
    this.vel.x += wishDir.x * accel * dt;
    this.vel.z += wishDir.z * accel * dt;
    const speed = Math.hypot(this.vel.x, this.vel.z);
    if (speed > maxSpeed) {
      this.vel.x = (this.vel.x / speed) * maxSpeed;
      this.vel.z = (this.vel.z / speed) * maxSpeed;
    }

    if (this.grounded && (input.keys.has("Space") || input.consumeKey("Space"))) {
      this.vel.y = 7.1;
      this.grounded = false;
    }
    this.vel.y -= 20 * dt;

    const stepped = resolveCapsule(
      this.pos,
      { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt },
      PLAYER_RADIUS,
      this.height,
      colliders,
    );
    this.pos = stepped.pos;
    this.vel.y = stepped.vel.y / dt || 0;
    this.grounded = stepped.grounded;

    this.pos.x = clamp(this.pos.x, -38.5, 38.5);
    this.pos.z = clamp(this.pos.z, -34.5, 34.5);

    this.syncCamera();

    let footstep = false;
    if (this.grounded && this.moving) {
      this.stepTimer -= dt;
      if (this.stepTimer <= 0) {
        this.stepTimer = this.walking ? 0.48 : 0.34;
        footstep = true;
      }
    } else {
      this.stepTimer = 0.1;
    }

    return { footstep, reloaded };
  }

  syncCamera(): void {
    this.camera.position.set(this.pos.x, this.eyeY, this.pos.z);
    this.camera.rotation.order = "YXZ";
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch + this.recoilPitch;
    this.camera.rotation.z = this.recoilYaw * 0.35;
    this.camera.fov = this.scoped && this.weapon.def.scoped ? 22 : 78;
    this.camera.updateProjectionMatrix();
  }

  aimDirection(): THREE.Vector3 {
    const spread = currentSpread(this.weapon, this.moving, !this.grounded, this.crouching, this.spray);
    const dir = new THREE.Vector3();
    this.camera.getWorldDirection(dir);
    if (spread > 0) {
      dir.x += (Math.random() * 2 - 1) * spread;
      dir.y += (Math.random() * 2 - 1) * spread * 0.7;
      dir.z += (Math.random() * 2 - 1) * spread;
      dir.normalize();
    }
    return dir;
  }

  applyRecoil(): void {
    const w = this.weapon.def;
    this.recoilPitch -= w.recoilPitch;
    this.recoilYaw += (Math.random() * 2 - 1) * w.recoilYaw;
    this.viewKick = 1;
    this.spray = Math.min(18, this.spray + 1);
    this.pitch = clamp(this.pitch - w.recoilPitch * 0.35, -1.25, 1.25);
  }

  private switchSlot(slot: number): void {
    const idx = this.weapons.findIndex((w) => w.def.slot === slot);
    if (idx >= 0) {
      this.active = idx;
      this.scoped = false;
    }
  }
}

function lerpToward(value: number, target: number, step: number): number {
  if (value > target) return Math.max(target, value - step);
  return Math.min(target, value + step);
}
