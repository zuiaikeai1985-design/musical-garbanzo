import * as THREE from "three";
import { moveAxisAligned, rayBox, rayBoxes, tryStepUp } from "../world/collision";
import type { DifficultyProfile, HitPart, HitResult } from "../core/types";
import type { Effects } from "./effects";
import type { AudioEngine } from "../core/audio";
import { markerTexture } from "../world/textures";

export interface BotWorld {
  colliders: readonly THREE.Box3[];
  coverPoints: readonly THREE.Vector3[];
  effects: Effects;
  audio: AudioEngine;
  profile: DifficultyProfile;
  player: {
    alive: boolean;
    /** Feet position. */
    position: THREE.Vector3;
    eye: THREE.Vector3;
    box: THREE.Box3;
  };
  /** Camera position, used for stereo panning of bot gunfire. */
  listener: THREE.Object3D;
  /** Draws a marker above bots that currently have eyes on the player. */
  showMarkers: boolean;
  damagePlayer: (amount: number, from: THREE.Vector3, botName: string) => void;
}

type BotState = "idle" | "hunt" | "engage" | "reposition" | "dead";

const BOT_NAMES = [
  "Viktor",
  "Sergei",
  "Rashid",
  "Marek",
  "Tariq",
  "Andrei",
  "Bogdan",
  "Yusuf",
  "Dragan",
  "Kirill",
  "Emir",
  "Nikola",
];

const HALF_EXTENTS = new THREE.Vector3(0.32, 0.9, 0.32);
const EYE_HEIGHT = 1.55;
/** Bots ignore the player beyond this range, so long sightlines stay playable. */
const VISION_RANGE = 48;

const SKIN = new THREE.MeshStandardMaterial({ color: 0xc79a6c, roughness: 0.85 });
const SHIRT = new THREE.MeshStandardMaterial({ color: 0x7d3b34, roughness: 0.9 });
const VEST = new THREE.MeshStandardMaterial({ color: 0x33302a, roughness: 0.8, metalness: 0.15 });
const PANTS = new THREE.MeshStandardMaterial({ color: 0x4a4636, roughness: 0.95 });
const BOOT = new THREE.MeshStandardMaterial({ color: 0x22201c, roughness: 0.95 });
const GUN = new THREE.MeshStandardMaterial({ color: 0x23262a, roughness: 0.5, metalness: 0.6 });
const BERET = new THREE.MeshStandardMaterial({ color: 0xa8231f, roughness: 0.85 });

function part(
  w: number,
  h: number,
  d: number,
  material: THREE.Material,
  x: number,
  y: number,
  z: number,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

let nameCursor = Math.floor(Math.random() * BOT_NAMES.length);

export class Bot {
  readonly group = new THREE.Group();
  readonly name: string;
  readonly position = new THREE.Vector3();
  readonly velocity = new THREE.Vector3();

  health: number;
  armor = 50;
  alive = true;
  removeMe = false;
  /** True while this bot has line of sight on the player. */
  spotted = false;

  private state: BotState = "idle";
  private stateTimer = 0;
  private yaw = 0;
  private grounded = false;
  private target = new THREE.Vector3();
  private lastKnownPlayer = new THREE.Vector3();
  private hasLastKnown = false;
  private reactionTimer = 0;
  private sawPlayer = false;
  private burstTimer = 0;
  private restTimer = 0;
  private shotsInBurst = 0;
  private fireCooldown = 0;
  private strafeDir = 1;
  private strafeTimer = 0;
  private deathTimer = 0;
  private sinkOffset = 0;
  private walkPhase = 0;
  private repathTimer = 0;

  private readonly headBox = new THREE.Box3();
  private readonly chestBox = new THREE.Box3();
  private readonly stomachBox = new THREE.Box3();
  private readonly legsBox = new THREE.Box3();

  private readonly torso: THREE.Group;
  private readonly leftLeg: THREE.Mesh;
  private readonly rightLeg: THREE.Mesh;
  private readonly leftArm: THREE.Mesh;
  private readonly muzzle = new THREE.Object3D();
  private readonly marker: THREE.Sprite;

  constructor(spawn: THREE.Vector3, private readonly profile: DifficultyProfile) {
    this.name = BOT_NAMES[nameCursor++ % BOT_NAMES.length];
    this.health = profile.botHealth;
    this.position.copy(spawn);
    this.position.y += HALF_EXTENTS.y;

    this.torso = new THREE.Group();
    this.torso.add(part(0.5, 0.58, 0.28, SHIRT, 0, 1.16, 0));
    this.torso.add(part(0.54, 0.4, 0.32, VEST, 0, 1.24, 0));
    this.torso.add(part(0.24, 0.24, 0.24, SKIN, 0, 1.58, 0));
    this.torso.add(part(0.26, 0.1, 0.26, VEST, 0, 1.71, 0));
    this.torso.add(part(0.42, 0.22, 0.3, PANTS, 0, 0.82, 0));

    this.leftArm = part(0.15, 0.5, 0.16, SHIRT, -0.32, 1.14, 0.06);
    const rightArm = part(0.15, 0.5, 0.16, SHIRT, 0.32, 1.14, 0.06);
    rightArm.rotation.x = -1.35;
    this.leftArm.rotation.x = -1.5;
    this.torso.add(this.leftArm, rightArm);

    const weapon = part(0.09, 0.12, 0.75, GUN, 0.16, 1.12, -0.3);
    this.torso.add(weapon);
    this.muzzle.position.set(0.16, 1.12, -0.68);
    this.torso.add(this.muzzle);

    this.leftLeg = part(0.19, 0.72, 0.2, PANTS, -0.13, 0.36, 0);
    this.rightLeg = part(0.19, 0.72, 0.2, PANTS, 0.13, 0.36, 0);
    this.group.add(this.leftLeg, this.rightLeg);
    this.group.add(part(0.21, 0.1, 0.3, BOOT, -0.13, 0.05, 0.03));
    this.group.add(part(0.21, 0.1, 0.3, BOOT, 0.13, 0.05, 0.03));
    this.group.add(this.torso);
    // Red beret keeps enemies readable against the sand.
    this.torso.add(part(0.27, 0.08, 0.27, BERET, 0, 1.72, 0));

    this.marker = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: markerTexture(), transparent: true, depthWrite: false }),
    );
    this.marker.scale.set(0.45, 0.45, 0.45);
    this.marker.position.set(0, 2.16, 0);
    this.marker.visible = false;
    this.group.add(this.marker);

    this.syncTransform();
    this.updateHitboxes();
  }

  get eye(): THREE.Vector3 {
    return new THREE.Vector3(this.position.x, this.feetY + EYE_HEIGHT, this.position.z);
  }

  private get feetY(): number {
    return this.position.y - HALF_EXTENTS.y;
  }

  get hitboxes(): THREE.Box3[] {
    return [this.headBox, this.chestBox, this.stomachBox, this.legsBox];
  }

  private syncTransform(): void {
    this.group.position.set(this.position.x, this.feetY, this.position.z);
    this.group.rotation.y = this.yaw;
  }

  private updateHitboxes(): void {
    const x = this.position.x;
    const z = this.position.z;
    const y = this.feetY;
    this.headBox.min.set(x - 0.15, y + 1.45, z - 0.15);
    this.headBox.max.set(x + 0.15, y + 1.76, z + 0.15);
    this.chestBox.min.set(x - 0.3, y + 1.05, z - 0.2);
    this.chestBox.max.set(x + 0.3, y + 1.45, z + 0.2);
    this.stomachBox.min.set(x - 0.28, y + 0.72, z - 0.18);
    this.stomachBox.max.set(x + 0.28, y + 1.05, z + 0.18);
    this.legsBox.min.set(x - 0.26, y, z - 0.18);
    this.legsBox.max.set(x + 0.26, y + 0.72, z + 0.18);
  }

  /** Ray/hitbox test used by the player's hitscan weapons. */
  raycast(origin: THREE.Vector3, dir: THREE.Vector3, maxDistance: number): HitResult | null {
    if (!this.alive) return null;
    const parts: Array<[HitPart, THREE.Box3]> = [
      ["head", this.headBox],
      ["chest", this.chestBox],
      ["stomach", this.stomachBox],
      ["legs", this.legsBox],
    ];
    let best: HitResult | null = null;
    for (const [name, box] of parts) {
      const hit = rayBox(origin, dir, box, maxDistance);
      if (hit && (!best || hit.distance < best.distance)) {
        best = { part: name, point: hit.point, normal: hit.normal, distance: hit.distance };
      }
    }
    return best;
  }

  takeDamage(amount: number, armorPenetration: number): boolean {
    if (!this.alive) return false;
    let damage = amount;
    if (this.armor > 0) {
      const absorbed = damage * (1 - armorPenetration) * 0.5;
      this.armor = Math.max(0, this.armor - absorbed * 0.9);
      damage -= absorbed;
    }
    this.health -= damage;
    if (this.health <= 0) {
      this.alive = false;
      this.state = "dead";
      this.deathTimer = 0;
      return true;
    }
    return false;
  }

  alertTo(position: THREE.Vector3): void {
    if (!this.alive) return;
    this.lastKnownPlayer.copy(position);
    this.hasLastKnown = true;
    if (this.state === "idle") {
      this.state = "hunt";
      this.target.copy(position);
    }
  }

  private canSee(world: BotWorld): boolean {
    if (!world.player.alive) return false;
    const eye = this.eye;
    const to = world.player.eye.clone().sub(eye);
    const distance = to.length();
    if (distance > VISION_RANGE) return false;
    to.normalize();

    const forward = new THREE.Vector3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
    const flat = new THREE.Vector3(to.x, 0, to.z).normalize();
    // Bots have a wide but not omniscient field of view.
    if (forward.dot(flat) < -0.15 && distance > 6) return false;

    const blocked = rayBoxes(eye, to, world.colliders, distance - 0.35);
    return blocked === null;
  }

  private pickCover(world: BotWorld): void {
    const playerPos = this.hasLastKnown ? this.lastKnownPlayer : world.player.position;
    let best: THREE.Vector3 | null = null;
    let bestScore = -Infinity;
    for (const point of world.coverPoints) {
      const distanceToMe = point.distanceTo(this.position);
      const distanceToPlayer = point.distanceTo(playerPos);
      if (distanceToMe > 26) continue;
      const score = -distanceToMe * 0.6 - Math.abs(distanceToPlayer - 12) * 0.8 + Math.random() * 6;
      if (score > bestScore) {
        bestScore = score;
        best = point;
      }
    }
    if (best) this.target.copy(best);
  }

  /**
   * Simple whisker steering: try the direct route first and fan out sideways
   * until a direction is clear. Cheap, and good enough for close quarters.
   */
  private steer(desired: THREE.Vector3, world: BotWorld): THREE.Vector3 {
    const origin = new THREE.Vector3(this.position.x, this.feetY + 0.9, this.position.z);
    const angles = [0, 0.35, -0.35, 0.75, -0.75, 1.2, -1.2, 1.9, -1.9];
    for (const angle of angles) {
      const dir = desired.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), angle).normalize();
      const hit = rayBoxes(origin, dir, world.colliders, 2.2);
      const low = rayBoxes(
        new THREE.Vector3(this.position.x, this.feetY + 0.3, this.position.z),
        dir,
        world.colliders,
        1.4,
      );
      if (!hit && !low) return dir;
    }
    return desired;
  }

  private fire(world: BotWorld): void {
    const origin = this.muzzle.getWorldPosition(new THREE.Vector3());
    const aimPoint = world.player.eye.clone();
    aimPoint.y -= 0.25 + Math.random() * 0.3;
    const dir = aimPoint.sub(origin);
    const distance = dir.length();
    dir.normalize();

    // Accuracy degrades through a burst, the way recoil does for the player,
    // and with range so that long sightlines are survivable.
    const burstPenalty = 1 + Math.min(this.shotsInBurst, 6) * 0.32;
    const rangePenalty = 1 + Math.max(0, distance - 10) / 22;
    const spreadRad = THREE.MathUtils.degToRad(
      this.profile.aimSpread * burstPenalty * rangePenalty,
    );
    this.shotsInBurst++;
    dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), (Math.random() - 0.5) * spreadRad * 2);
    dir.applyAxisAngle(
      new THREE.Vector3(1, 0, 0).cross(dir).normalize().negate(),
      (Math.random() - 0.5) * spreadRad * 2,
    );
    dir.normalize();

    const maxDistance = 90;
    const worldHit = rayBoxes(origin, dir, world.colliders, maxDistance);
    const playerHit = world.player.alive
      ? rayBox(origin, dir, world.player.box, maxDistance)
      : null;

    let end = origin.clone().addScaledVector(dir, maxDistance);
    if (playerHit && (!worldHit || playerHit.distance < worldHit.distance)) {
      end = playerHit.point;
      const falloff = THREE.MathUtils.clamp(1 - (distance - 18) / 60, 0.45, 1);
      const damage = (22 + Math.random() * 12) * this.profile.damageScale * falloff;
      world.damagePlayer(damage, this.position, this.name);
    } else if (worldHit) {
      end = worldHit.point;
      world.effects.impact(worldHit.point, worldHit.normal, "world");
    }

    world.effects.tracer(origin, end, 0.7);

    const listenerPos = world.listener.getWorldPosition(new THREE.Vector3());
    const listenerDistance = listenerPos.distanceTo(origin);
    const right = new THREE.Vector3(1, 0, 0).applyQuaternion(world.listener.quaternion);
    const pan = THREE.MathUtils.clamp(
      origin.clone().sub(listenerPos).normalize().dot(right),
      -1,
      1,
    );
    const volume = THREE.MathUtils.clamp(1 - listenerDistance / 60, 0.12, 1);
    if (listenerDistance > 26) world.audio.distantShot(volume * 0.5, pan);
    else world.audio.gunshot("rifle", volume * 0.55, pan);
  }

  update(dt: number, world: BotWorld): void {
    if (!this.alive) {
      this.marker.visible = false;
      this.spotted = false;
      this.deathTimer += dt;
      // Topple over, then sink into the ground and disappear.
      const fall = Math.min(1, this.deathTimer / 0.5);
      this.group.rotation.x = -fall * Math.PI * 0.48;
      if (this.deathTimer > 3.2) {
        this.sinkOffset += dt * 0.6;
        if (this.deathTimer > 5) this.removeMe = true;
      }
      this.group.position.y = this.feetY - fall * 0.1 - this.sinkOffset;
      return;
    }

    const visible = this.canSee(world);
    this.spotted = visible;
    this.marker.visible = world.showMarkers && visible;
    if (visible) {
      this.lastKnownPlayer.copy(world.player.position);
      this.hasLastKnown = true;
      if (!this.sawPlayer) {
        this.sawPlayer = true;
        const [lo, hi] = this.profile.reactionTime;
        const distance = this.position.distanceTo(world.player.position);
        // Spotting someone far away takes longer.
        this.reactionTimer =
          lo + Math.random() * (hi - lo) + Math.max(0, distance - 12) * 0.035;
      }
      this.state = "engage";
    } else {
      this.sawPlayer = false;
      if (this.state === "engage") {
        this.state = "hunt";
        this.stateTimer = 0;
      }
    }

    this.stateTimer += dt;
    this.repathTimer -= dt;
    this.fireCooldown = Math.max(0, this.fireCooldown - dt);

    const move = new THREE.Vector3();
    const toPlayer = world.player.position.clone().sub(this.position);
    toPlayer.y = 0;
    const distanceToPlayer = toPlayer.length();

    switch (this.state) {
      case "idle": {
        if (this.stateTimer > 1.5 + Math.random()) {
          this.state = "hunt";
          this.stateTimer = 0;
          this.pickCover(world);
        }
        break;
      }
      case "hunt": {
        const goal = this.hasLastKnown ? this.lastKnownPlayer : world.player.position;
        if (this.repathTimer <= 0) {
          this.target.copy(goal);
          this.repathTimer = 0.6;
        }
        const toTarget = this.target.clone().sub(this.position);
        toTarget.y = 0;
        if (toTarget.length() < 1.6) {
          this.hasLastKnown = false;
          this.state = "reposition";
          this.stateTimer = 0;
          this.pickCover(world);
        } else {
          move.copy(this.steer(toTarget.normalize(), world));
        }
        break;
      }
      case "reposition": {
        const toTarget = this.target.clone().sub(this.position);
        toTarget.y = 0;
        if (toTarget.length() < 1.4 || this.stateTimer > 6) {
          this.state = "idle";
          this.stateTimer = 0;
        } else {
          move.copy(this.steer(toTarget.normalize(), world));
        }
        break;
      }
      case "engage": {
        this.strafeTimer -= dt;
        if (this.strafeTimer <= 0) {
          this.strafeTimer = 0.6 + Math.random() * 1.1;
          this.strafeDir = Math.random() < 0.5 ? -1 : 1;
        }
        const forward = toPlayer.clone().normalize();
        const side = new THREE.Vector3(-forward.z, 0, forward.x).multiplyScalar(this.strafeDir);
        const desired = side.clone();
        // Close the gap when far, back off when uncomfortably close.
        if (distanceToPlayer > 16) desired.addScaledVector(forward, 1.1);
        else if (distanceToPlayer < 5) desired.addScaledVector(forward, -0.9);
        else desired.addScaledVector(forward, 0.25);
        move.copy(this.steer(desired.normalize(), world));
        break;
      }
      default:
        break;
    }

    // Face the player while engaging, otherwise face where we are going.
    const faceDir =
      this.state === "engage" || (this.hasLastKnown && distanceToPlayer < 30)
        ? new THREE.Vector3(
            world.player.position.x - this.position.x,
            0,
            world.player.position.z - this.position.z,
          )
        : move;
    if (faceDir.lengthSq() > 1e-4) {
      const wanted = Math.atan2(-faceDir.x, -faceDir.z);
      let delta = wanted - this.yaw;
      while (delta > Math.PI) delta -= Math.PI * 2;
      while (delta < -Math.PI) delta += Math.PI * 2;
      this.yaw += THREE.MathUtils.clamp(delta, -7 * dt, 7 * dt);
    }

    const speed = this.profile.botSpeed * (this.state === "engage" ? 0.85 : 1);
    const wish = move.lengthSq() > 1e-4 ? move.normalize().multiplyScalar(speed) : new THREE.Vector3();
    this.velocity.x = THREE.MathUtils.damp(this.velocity.x, wish.x, 12, dt);
    this.velocity.z = THREE.MathUtils.damp(this.velocity.z, wish.z, 12, dt);
    this.velocity.y -= 22 * dt;

    const before = this.position.clone();
    const result = moveAxisAligned(this.position, this.velocity, HALF_EXTENTS, world.colliders, dt);
    this.grounded = result.grounded || this.position.y - HALF_EXTENTS.y <= 0.001;
    if (this.grounded) this.velocity.y = Math.max(0, this.velocity.y);

    const travelled = new THREE.Vector3(
      this.position.x - before.x,
      0,
      this.position.z - before.z,
    ).length();
    if (travelled < 0.4 * speed * dt && wish.lengthSq() > 0.01 && this.grounded) {
      const desired = wish.clone().multiplyScalar(dt * 2.2);
      desired.y = 0;
      tryStepUp(this.position, HALF_EXTENTS, world.colliders, desired, 0.62);
    }

    this.walkPhase += travelled * 6.5;
    const swing = Math.sin(this.walkPhase) * 0.55;
    this.leftLeg.rotation.x = swing;
    this.rightLeg.rotation.x = -swing;
    this.leftArm.rotation.x = -1.5 + swing * 0.12;

    // Aim the torso up/down at the player.
    const heightDelta = world.player.eye.y - (this.feetY + 1.2);
    this.torso.rotation.x = THREE.MathUtils.clamp(
      -Math.atan2(heightDelta, Math.max(1, distanceToPlayer)),
      -0.6,
      0.6,
    );

    this.syncTransform();
    this.updateHitboxes();

    // Shooting.
    if (visible && world.player.alive) {
      this.reactionTimer -= dt;
      if (this.reactionTimer <= 0) {
        if (this.burstTimer > 0) {
          this.burstTimer -= dt;
          if (this.fireCooldown <= 0) {
            this.fire(world);
            this.fireCooldown = 0.1;
          }
          if (this.burstTimer <= 0) {
            const [rl, rh] = this.profile.restBetweenBursts;
            this.restTimer = rl + Math.random() * (rh - rl);
          }
        } else if (this.restTimer > 0) {
          this.restTimer -= dt;
        } else {
          const [bl, bh] = this.profile.burst;
          this.burstTimer = bl + Math.random() * (bh - bl);
          this.shotsInBurst = 0;
          // Fire the first round of the burst immediately.
          this.fire(world);
          this.fireCooldown = 0.1;
        }
      }
    }
  }
}
