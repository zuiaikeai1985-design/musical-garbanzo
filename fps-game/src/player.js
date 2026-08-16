import * as THREE from "three";
import { clamp, lerp, moveWithCollisions, DEG } from "./utils.js";

const STAND_HEIGHT = 1.72;
const CROUCH_HEIGHT = 1.2;
const STAND_EYE = 1.62;
const CROUCH_EYE = 1.08;
const RADIUS = 0.35;
const GRAVITY = 15;
const JUMP_SPEED = 5.4;
const RUN_SPEED = 6.4;
const WALK_SPEED = 3.0;
const CROUCH_SPEED = 2.6;
const MOUSE_SENS = 0.0021;
const ARROW_LOOK_SPEED = 3.0;
const ARROW_TAP_NUDGE = 0.07; // 轻点方向键的即时转角（低帧率兜底）

export class Player {
  constructor(camera, world, audio) {
    this.camera = camera;
    this.world = world;
    this.audio = audio;
    this.pos = new THREE.Vector3();
    this.vel = new THREE.Vector3();
    this.yaw = 0;
    this.pitch = 0;
    this.onGround = true;
    this.crouching = false;
    this.height = STAND_HEIGHT;
    this.eye = STAND_EYE;
    this.hp = 100;
    this.armor = 0;
    this.alive = true;
    this.footTimer = 0;
    this.moveSpeed2D = 0;
    this.speedScale = 1; // 武器重量影响
    this.onDamaged = null;
  }

  reset(spawn) {
    this.pos.copy(spawn.pos);
    this.vel.set(0, 0, 0);
    this.yaw = spawn.yaw;
    this.pitch = 0;
    this.hp = 100;
    this.alive = true;
    this.crouching = false;
    this.height = STAND_HEIGHT;
    this.eye = STAND_EYE;
    this.syncCamera();
  }

  get eyePos() {
    return new THREE.Vector3(this.pos.x, this.pos.y + this.eye, this.pos.z);
  }

  forwardDir() {
    return new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  aimDir() {
    const cp = Math.cos(this.pitch);
    return new THREE.Vector3(-Math.sin(this.yaw) * cp, Math.sin(this.pitch), -Math.cos(this.yaw) * cp).normalize();
  }

  update(dt, input, movementLocked) {
    // 视角
    this.yaw -= input.mouseDX * MOUSE_SENS;
    this.pitch -= input.mouseDY * MOUSE_SENS;
    if (input.isDown("ArrowLeft")) this.yaw += ARROW_LOOK_SPEED * dt;
    if (input.isDown("ArrowRight")) this.yaw -= ARROW_LOOK_SPEED * dt;
    if (input.isDown("ArrowUp")) this.pitch += ARROW_LOOK_SPEED * 0.7 * dt;
    if (input.isDown("ArrowDown")) this.pitch -= ARROW_LOOK_SPEED * 0.7 * dt;
    // 轻点方向键也保证有明显转动（低帧率下 isDown 可能捕捉不到）
    if (input.wasPressed("ArrowLeft")) this.yaw += ARROW_TAP_NUDGE;
    if (input.wasPressed("ArrowRight")) this.yaw -= ARROW_TAP_NUDGE;
    if (input.wasPressed("ArrowUp")) this.pitch += ARROW_TAP_NUDGE * 0.7;
    if (input.wasPressed("ArrowDown")) this.pitch -= ARROW_TAP_NUDGE * 0.7;
    this.pitch = clamp(this.pitch, -89 * DEG, 89 * DEG);

    // 蹲下
    const wantCrouch = input.isDown("ControlLeft") || input.isDown("KeyC");
    if (wantCrouch !== this.crouching) {
      if (wantCrouch) {
        this.crouching = true;
      } else {
        // 站起前检查头顶空间
        const head = this.pos.clone();
        head.y += STAND_HEIGHT;
        let blocked = false;
        for (const c of this.world.colliders) {
          if (
            head.x + RADIUS > c.min.x &&
            head.x - RADIUS < c.max.x &&
            head.z + RADIUS > c.min.z &&
            head.z - RADIUS < c.max.z &&
            head.y > c.min.y &&
            this.pos.y + CROUCH_HEIGHT < c.max.y + STAND_HEIGHT
          ) {
            if (this.pos.y + STAND_HEIGHT > c.min.y && this.pos.y < c.max.y) blocked = true;
          }
        }
        if (!blocked) this.crouching = false;
      }
    }
    this.height = this.crouching ? CROUCH_HEIGHT : STAND_HEIGHT;
    this.eye = lerp(this.eye, this.crouching ? CROUCH_EYE : STAND_EYE, Math.min(1, dt * 12));

    // 移动
    let ix = 0;
    let iz = 0;
    if (!movementLocked && this.alive) {
      if (input.isDown("KeyW")) iz += 1;
      if (input.isDown("KeyS")) iz -= 1;
      if (input.isDown("KeyA")) ix -= 1;
      if (input.isDown("KeyD")) ix += 1;
    }
    const walking = input.isDown("ShiftLeft") || input.isDown("ShiftRight");
    let speed = this.crouching ? CROUCH_SPEED : walking ? WALK_SPEED : RUN_SPEED;
    speed *= this.speedScale;

    const fwd = this.forwardDir();
    const right = new THREE.Vector3(-fwd.z, 0, fwd.x);
    const wish = new THREE.Vector3();
    if (ix !== 0 || iz !== 0) {
      wish.addScaledVector(fwd, iz).addScaledVector(right, ix).normalize().multiplyScalar(speed);
    }

    const accel = this.onGround ? 14 : 3.5;
    this.vel.x = lerp(this.vel.x, wish.x, Math.min(1, accel * dt));
    this.vel.z = lerp(this.vel.z, wish.z, Math.min(1, accel * dt));

    if (!movementLocked && this.alive && input.isDown("Space") && this.onGround) {
      this.vel.y = JUMP_SPEED;
      this.onGround = false;
    }
    this.vel.y -= GRAVITY * dt;

    const res = moveWithCollisions(this.pos, this.vel, dt, RADIUS, this.height, this.world.colliders);
    this.onGround = res.onGround;

    // 脚步声
    this.moveSpeed2D = Math.hypot(this.vel.x, this.vel.z);
    if (this.onGround && this.moveSpeed2D > 3.4) {
      this.footTimer -= dt;
      if (this.footTimer <= 0) {
        this.footTimer = 2.2 / this.moveSpeed2D;
        this.audio.footstep(this.moveSpeed2D > 5 ? 0.14 : 0.07);
      }
    } else {
      this.footTimer = 0.1;
    }

    this.syncCamera();
  }

  syncCamera(recoilPitch = 0, recoilYaw = 0) {
    this.camera.position.set(this.pos.x, this.pos.y + this.eye, this.pos.z);
    this.camera.rotation.set(0, 0, 0);
    this.camera.rotateY(this.yaw + recoilYaw);
    this.camera.rotateX(this.pitch + recoilPitch);
  }

  takeDamage(dmg, fromPos) {
    if (!this.alive) return;
    let realDmg = dmg;
    if (this.armor > 0) {
      const absorbed = Math.min(this.armor, dmg * 0.5);
      this.armor = Math.round(this.armor - absorbed);
      realDmg = dmg - absorbed;
    }
    this.hp = Math.max(0, Math.round(this.hp - realDmg));
    this.audio.hurt();
    if (this.onDamaged) this.onDamaged(realDmg, fromPos);
    if (this.hp <= 0) this.alive = false;
  }
}
