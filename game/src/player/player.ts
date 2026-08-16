import * as THREE from "three";
import { moveAxisAligned, tryStepUp } from "../world/collision";
import type { Input } from "../core/input";
import type { AudioEngine } from "../core/audio";

const STAND_HALF = 0.9;
const CROUCH_HALF = 0.66;
const STAND_EYE = 1.62;
const CROUCH_EYE = 1.15;
const RADIUS = 0.34;

const GRAVITY = 20.5;
const JUMP_SPEED = 6.4;
const GROUND_ACCEL = 11;
const AIR_ACCEL = 22;
const FRICTION = 7.2;

export interface PlayerMoveState {
  speed: number;
  grounded: boolean;
  moving: boolean;
  crouching: boolean;
  walking: boolean;
}

export class Player {
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();

  yaw = 0;
  pitch = 0;
  punchPitch = 0;
  punchYaw = 0;

  health = 100;
  armor = 100;
  alive = true;

  grounded = false;
  crouching = false;
  private halfHeight = STAND_HALF;
  private eyeHeight = STAND_EYE;
  private stepDistance = 0;
  private landDip = 0;
  private fallSpeed = 0;
  private wasGrounded = true;

  readonly box = new THREE.Box3();

  constructor(spawn: THREE.Vector3, yaw: number) {
    this.reset(spawn, yaw);
  }

  reset(spawn: THREE.Vector3, yaw: number): void {
    this.position.set(spawn.x, spawn.y + STAND_HALF, spawn.z);
    this.velocity.set(0, 0, 0);
    this.yaw = yaw;
    this.pitch = 0;
    this.punchPitch = 0;
    this.punchYaw = 0;
    this.health = 100;
    this.armor = 100;
    this.alive = true;
    this.crouching = false;
    this.halfHeight = STAND_HALF;
    this.eyeHeight = STAND_EYE;
    this.updateBox();
  }

  get feetY(): number {
    return this.position.y - this.halfHeight;
  }

  get eyePosition(): THREE.Vector3 {
    return new THREE.Vector3(
      this.position.x,
      this.feetY + this.eyeHeight - this.landDip,
      this.position.z,
    );
  }

  get horizontalSpeed(): number {
    return Math.hypot(this.velocity.x, this.velocity.z);
  }

  get aimPitch(): number {
    return THREE.MathUtils.clamp(this.pitch + this.punchPitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  }

  get aimYaw(): number {
    return this.yaw + this.punchYaw;
  }

  getAimDirection(target = new THREE.Vector3()): THREE.Vector3 {
    const pitch = this.aimPitch;
    const yaw = this.aimYaw;
    return target
      .set(-Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))
      .normalize();
  }

  addRecoil(pitchAmount: number, yawAmount: number): void {
    this.punchPitch += pitchAmount;
    this.punchYaw += yawAmount;
  }

  look(dx: number, dy: number, sensitivity: number): void {
    const scale = 0.00022 * sensitivity * 10;
    this.yaw -= dx * scale;
    this.pitch -= dy * scale;
    this.pitch = THREE.MathUtils.clamp(this.pitch, -Math.PI / 2 + 0.02, Math.PI / 2 - 0.02);
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    let damage = amount;
    if (this.armor > 0) {
      const absorbed = damage * 0.5;
      const used = Math.min(this.armor, absorbed);
      this.armor -= used;
      damage -= used;
    }
    this.health -= damage;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
    }
  }

  private updateBox(): void {
    this.box.min.set(
      this.position.x - RADIUS,
      this.position.y - this.halfHeight,
      this.position.z - RADIUS,
    );
    this.box.max.set(
      this.position.x + RADIUS,
      this.position.y + this.halfHeight,
      this.position.z + RADIUS,
    );
  }

  private canStand(colliders: readonly THREE.Box3[]): boolean {
    const feet = this.feetY;
    const test = new THREE.Box3(
      new THREE.Vector3(this.position.x - RADIUS, feet + 0.05, this.position.z - RADIUS),
      new THREE.Vector3(this.position.x + RADIUS, feet + STAND_HALF * 2, this.position.z + RADIUS),
    );
    for (const collider of colliders) {
      if (test.intersectsBox(collider)) return false;
    }
    return true;
  }

  update(
    dt: number,
    input: Input,
    colliders: readonly THREE.Box3[],
    audio: AudioEngine,
    options: { speedFactor: number; frozen: boolean },
  ): PlayerMoveState {
    const wantCrouch = input.isDown("ControlLeft") || input.isDown("ControlRight") || input.isDown("KeyC");
    const walking = input.isDown("ShiftLeft") || input.isDown("ShiftRight");

    const feetBefore = this.feetY;
    if (wantCrouch && !this.crouching) {
      this.crouching = true;
      this.halfHeight = CROUCH_HALF;
      this.position.y = feetBefore + this.halfHeight;
    } else if (!wantCrouch && this.crouching && this.canStand(colliders)) {
      this.crouching = false;
      this.halfHeight = STAND_HALF;
      this.position.y = feetBefore + this.halfHeight;
    }
    const targetEye = this.crouching ? CROUCH_EYE : STAND_EYE;
    this.eyeHeight = THREE.MathUtils.damp(this.eyeHeight, targetEye, 14, dt);

    // ----- wish direction -----
    let forward = 0;
    let strafe = 0;
    if (!options.frozen && this.alive) {
      if (input.isDown("KeyW") || input.isDown("ArrowUp")) forward += 1;
      if (input.isDown("KeyS") || input.isDown("ArrowDown")) forward -= 1;
      if (input.isDown("KeyD") || input.isDown("ArrowRight")) strafe += 1;
      if (input.isDown("KeyA") || input.isDown("ArrowLeft")) strafe -= 1;
    }

    const yaw = this.yaw;
    const wishDir = new THREE.Vector3(
      -Math.sin(yaw) * forward + Math.cos(yaw) * strafe,
      0,
      -Math.cos(yaw) * forward - Math.sin(yaw) * strafe,
    );
    const moving = wishDir.lengthSq() > 1e-5;
    if (moving) wishDir.normalize();

    let maxSpeed = 5.4 * options.speedFactor;
    if (this.crouching) maxSpeed = 2.5;
    else if (walking) maxSpeed = 2.9;

    // ----- friction & acceleration (Quake/CS style) -----
    if (this.grounded) {
      const speed = this.horizontalSpeed;
      if (speed > 0.01) {
        const control = Math.max(speed, 3.2);
        const drop = control * FRICTION * dt;
        const newSpeed = Math.max(0, speed - drop) / speed;
        this.velocity.x *= newSpeed;
        this.velocity.z *= newSpeed;
      } else {
        this.velocity.x = 0;
        this.velocity.z = 0;
      }
    }

    if (moving) {
      const accel = this.grounded ? GROUND_ACCEL : AIR_ACCEL;
      const wishSpeed = this.grounded ? maxSpeed : Math.min(maxSpeed, 1.1);
      const current = this.velocity.x * wishDir.x + this.velocity.z * wishDir.z;
      const addSpeed = wishSpeed - current;
      if (addSpeed > 0) {
        const accelSpeed = Math.min(accel * maxSpeed * dt, addSpeed);
        this.velocity.x += wishDir.x * accelSpeed;
        this.velocity.z += wishDir.z * accelSpeed;
      }
    }

    if (
      !options.frozen &&
      this.alive &&
      this.grounded &&
      (input.isDown("Space") || input.wasPressed("Space"))
    ) {
      this.velocity.y = JUMP_SPEED;
      this.grounded = false;
      audio.jump();
    }

    this.velocity.y -= GRAVITY * dt;
    this.fallSpeed = this.velocity.y;

    const half = new THREE.Vector3(RADIUS, this.halfHeight, RADIUS);
    const before = this.position.clone();
    const result = moveAxisAligned(this.position, this.velocity, half, colliders, dt);
    this.grounded = result.grounded;

    // Step onto low ledges when horizontal movement was blocked.
    const travelled = Math.hypot(this.position.x - before.x, this.position.z - before.z);
    const wanted = this.horizontalSpeed * dt;
    if (this.grounded && moving && wanted > 0.001 && travelled < wanted * 0.55) {
      const desired = new THREE.Vector3(wishDir.x, 0, wishDir.z).multiplyScalar(
        Math.max(0.12, wanted * 1.6),
      );
      tryStepUp(this.position, half, colliders, desired, 0.55);
    }

    if (this.grounded && !this.wasGrounded) {
      const impact = Math.min(1, Math.abs(this.fallSpeed) / 14);
      this.landDip = 0.16 * impact;
      audio.footstep(0.12 + impact * 0.2);
      if (impact > 0.72) this.takeDamage((impact - 0.72) * 60);
    }
    this.wasGrounded = this.grounded;
    this.landDip = THREE.MathUtils.damp(this.landDip, 0, 9, dt);

    // ----- footsteps -----
    const speed = this.horizontalSpeed;
    if (this.grounded && speed > 0.6) {
      this.stepDistance += speed * dt;
      const stride = this.crouching || walking ? 2.6 : 1.95;
      if (this.stepDistance > stride) {
        this.stepDistance = 0;
        audio.footstep(walking || this.crouching ? 0.07 : 0.2);
      }
    } else {
      this.stepDistance = 0;
    }

    // ----- recoil recovery -----
    this.punchPitch = THREE.MathUtils.damp(this.punchPitch, 0, 6.5, dt);
    this.punchYaw = THREE.MathUtils.damp(this.punchYaw, 0, 6.5, dt);

    this.updateBox();

    return {
      speed,
      grounded: this.grounded,
      moving: moving && speed > 0.5,
      crouching: this.crouching,
      walking,
    };
  }

  applyToCamera(camera: THREE.PerspectiveCamera, tilt: number): void {
    camera.position.copy(this.eyePosition);
    camera.rotation.set(0, 0, 0);
    camera.rotateY(this.aimYaw);
    camera.rotateX(this.aimPitch);
    camera.rotateZ(tilt);
  }
}
