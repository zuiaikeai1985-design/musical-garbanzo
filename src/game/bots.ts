import * as THREE from "three";
import { aabbFromFoot, length2, normalize2, rayAABB, resolveCapsule } from "./math";
import type { AABB, Team, WeaponState } from "./types";
import { createWeaponState, currentSpread, tickWeapon, canFire, consumeShot } from "./weapons";
import { findPath, nearestWaypoint, type WorldData } from "./world";
import { PLAYER_HEIGHT, PLAYER_RADIUS } from "./player";

const T_NAMES = ["Cliffe", "Whistler", "Rebel", "Shark", "Gunner"];
const CT_NAMES = ["Crash", "Teammate", "Quill", "Stone", "Vidal"];

export class Bot {
  readonly mesh: THREE.Group;
  readonly team: Team;
  readonly name: string;
  readonly id: string;
  pos = { x: 0, y: 0, z: 0 };
  vel = { x: 0, y: 0, z: 0 };
  yaw = 0;
  health = 100;
  armor = 50;
  hasHelmet = true;
  alive = true;
  kills = 0;
  deaths = 0;
  weapon: WeaponState;
  path: string[] = [];
  goalId = "mid";
  strafe = 1;
  shootTimer = 0;
  retarget = 0;
  deathT = 0;
  respawnT = 0;
  lastSeen: { x: number; z: number } | null = null;
  grounded = true;

  constructor(id: string, team: Team, name: string) {
    this.id = id;
    this.team = team;
    this.name = name;
    this.weapon = createWeaponState(team === "T" ? "ak47" : "m4a4");
    this.mesh = createSoldier(team);
  }

  get eye() {
    return { x: this.pos.x, y: this.pos.y + 1.58, z: this.pos.z };
  }

  bodyAABB(): AABB {
    return aabbFromFoot(this.pos.x, this.pos.y, this.pos.z, 0.32, 1.45);
  }

  headCenter() {
    return { x: this.pos.x, y: this.pos.y + 1.6, z: this.pos.z };
  }

  spawnAt(x: number, z: number, yaw: number): void {
    this.pos = { x, y: 0, z };
    this.vel = { x: 0, y: 0, z: 0 };
    this.yaw = yaw;
    this.health = 100;
    this.armor = 50;
    this.hasHelmet = true;
    this.alive = true;
    this.deathT = 0;
    this.mesh.visible = true;
    this.mesh.rotation.x = 0;
    this.weapon = createWeaponState(this.team === "T" ? "ak47" : "m4a4");
  }

  update(
    dt: number,
    world: WorldData,
    target: { x: number; y: number; z: number; alive: boolean; team: Team },
    allies: Array<{ x: number; z: number }>,
    colliders: AABB[],
  ): { shot: boolean; dir: THREE.Vector3 | null } {
    tickWeapon(this.weapon, dt);
    if (!this.alive) {
      this.deathT += dt;
      this.mesh.rotation.x = Math.min(1.4, this.deathT * 4);
      this.respawnT -= dt;
      return { shot: false, dir: null };
    }

    this.retarget -= dt;
    this.shootTimer -= dt;
    const toTarget = { x: target.x - this.pos.x, z: target.z - this.pos.z };
    const dist = length2(toTarget.x, toTarget.z);
    const sees =
      target.alive &&
      target.team !== this.team &&
      dist < 42 &&
      hasLineOfSight(this.eye, { x: target.x, y: target.y + 1.5, z: target.z }, colliders);

    if (sees) this.lastSeen = { x: target.x, z: target.z };

    if (this.retarget <= 0) {
      this.retarget = 2.4 + Math.random() * 2.2;
      this.strafe *= -1;
      if (sees && this.lastSeen) {
        this.goalId = nearestWaypoint(world.waypoints, { x: this.lastSeen.x, y: 0, z: this.lastSeen.z }).id;
      } else {
        const roam = world.waypoints[Math.floor(Math.random() * world.waypoints.length)];
        this.goalId = roam.id;
      }
      const from = nearestWaypoint(world.waypoints, this.pos);
      this.path = findPath(world.waypoints, from.id, this.goalId).slice(1);
    }

    let wishX = 0;
    let wishZ = 0;
    if (sees && dist < 18) {
      const n = normalize2(toTarget.x, toTarget.z);
      wishX = n.x * 0.15 + -n.z * this.strafe;
      wishZ = n.z * 0.15 + n.x * this.strafe;
      if (dist < 7) {
        wishX -= n.x * 0.8;
        wishZ -= n.z * 0.8;
      }
    } else if (this.path.length) {
      const map = new Map(world.waypoints.map((w) => [w.id, w]));
      const next = map.get(this.path[0]);
      if (next) {
        const dx = next.pos.x - this.pos.x;
        const dz = next.pos.z - this.pos.z;
        if (length2(dx, dz) < 1.4) this.path.shift();
        const n = normalize2(dx, dz);
        wishX = n.x;
        wishZ = n.z;
      }
    }

    for (const a of allies) {
      const dx = this.pos.x - a.x;
      const dz = this.pos.z - a.z;
      const d = length2(dx, dz);
      if (d > 0.05 && d < 1.3) {
        const n = normalize2(dx, dz);
        wishX += n.x * 0.6;
        wishZ += n.z * 0.6;
      }
    }

    const nWish = normalize2(wishX, wishZ);
    const speed = sees ? 4.6 : 5.4;
    this.vel.x = nWish.x * speed;
    this.vel.z = nWish.z * speed;
    this.vel.y -= 20 * dt;
    const stepped = resolveCapsule(
      this.pos,
      { x: this.vel.x * dt, y: this.vel.y * dt, z: this.vel.z * dt },
      PLAYER_RADIUS,
      PLAYER_HEIGHT,
      colliders,
    );
    this.pos = stepped.pos;
    this.vel.y = stepped.vel.y / dt || 0;
    this.grounded = stepped.grounded;

    if (sees) this.yaw = Math.atan2(-(target.x - this.pos.x), -(target.z - this.pos.z));
    else if (nWish.x || nWish.z) this.yaw = Math.atan2(-nWish.x, -nWish.z);

    this.mesh.position.set(this.pos.x, this.pos.y, this.pos.z);
    this.mesh.rotation.y = this.yaw;

    let shot = false;
    let dir: THREE.Vector3 | null = null;
    if (sees && canFire(this.weapon) && this.shootTimer <= 0) {
      const aim = new THREE.Vector3(target.x - this.pos.x, target.y + 1.45 - this.eye.y, target.z - this.pos.z);
      aim.normalize();
      const spread = currentSpread(this.weapon, true, false, false, 3) + 0.018;
      aim.x += (Math.random() * 2 - 1) * spread;
      aim.y += (Math.random() * 2 - 1) * spread * 0.6;
      aim.z += (Math.random() * 2 - 1) * spread;
      aim.normalize();
      if (consumeShot(this.weapon)) {
        shot = true;
        dir = aim;
        this.shootTimer = 0.09 + Math.random() * 0.12;
      }
    }
    return { shot, dir };
  }
}

export function createBots(playerTeam: Team, scene: THREE.Scene): Bot[] {
  const bots: Bot[] = [];
  for (let i = 0; i < 4; i++) {
    const bot = new Bot(`ally-${i}`, playerTeam, (playerTeam === "T" ? T_NAMES : CT_NAMES)[i] ?? `Ally${i}`);
    scene.add(bot.mesh);
    bots.push(bot);
  }
  const enemyTeam: Team = playerTeam === "T" ? "CT" : "T";
  for (let i = 0; i < 5; i++) {
    const bot = new Bot(`enemy-${i}`, enemyTeam, (enemyTeam === "T" ? T_NAMES : CT_NAMES)[i] ?? `Bot${i}`);
    scene.add(bot.mesh);
    bots.push(bot);
  }
  return bots;
}

function hasLineOfSight(from: { x: number; y: number; z: number }, to: { x: number; y: number; z: number }, boxes: AABB[]): boolean {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const dz = to.z - from.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.01) return true;
  const dir = { x: dx / len, y: dy / len, z: dz / len };
  for (const box of boxes) {
    if (box.maxY < 1.2) continue;
    const t = rayAABB(from, dir, box);
    if (t !== null && t > 0.15 && t < len - 0.2) return false;
  }
  return true;
}

function createSoldier(team: Team): THREE.Group {
  const g = new THREE.Group();
  const shirt = new THREE.MeshStandardMaterial({
    color: team === "T" ? 0xb8862c : 0x3d5c88,
    roughness: 0.72,
    metalness: 0.08,
  });
  const vest = new THREE.MeshStandardMaterial({
    color: team === "T" ? 0x6b5428 : 0x243044,
    roughness: 0.62,
    metalness: 0.18,
  });
  const pants = new THREE.MeshStandardMaterial({
    color: team === "T" ? 0x5a4328 : 0x2c3340,
    roughness: 0.8,
  });
  const skin = new THREE.MeshStandardMaterial({ color: 0xc9a07a, roughness: 0.55 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1c2026, roughness: 0.4, metalness: 0.45 });
  const steel = new THREE.MeshStandardMaterial({ color: 0x6a7076, roughness: 0.3, metalness: 0.8 });

  const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.7, 0.2), pants);
  lLeg.position.set(-0.1, 0.35, 0);
  const rLeg = lLeg.clone();
  rLeg.position.x = 0.1;
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.48, 0.24), shirt);
  body.position.y = 1.02;
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.36, 0.1), vest);
  plate.position.set(0, 1.04, 0.1);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 10), skin);
  head.position.y = 1.56;
  const helm = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), dark);
  helm.scale.set(1, 0.58, 1.05);
  helm.position.y = 1.64;
  const visor = new THREE.Mesh(
    new THREE.BoxGeometry(0.18, 0.04, 0.08),
    new THREE.MeshStandardMaterial({ color: 0x111318, metalness: 0.7, roughness: 0.2 }),
  );
  visor.position.set(0, 1.58, 0.12);
  const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.5, 0.11), shirt);
  lArm.position.set(-0.28, 1.0, 0.1);
  lArm.rotation.x = -0.7;
  const rArm = lArm.clone();
  rArm.position.x = 0.28;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.06, 0.38), dark);
  gun.position.set(0.16, 1.02, -0.26);
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.16, 8), steel);
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0.16, 1.04, -0.5);
  g.add(lLeg, rLeg, body, plate, head, helm, visor, lArm, rArm, gun, barrel);
  g.traverse((o) => {
    if (o instanceof THREE.Mesh) {
      o.castShadow = true;
      o.receiveShadow = true;
    }
  });
  return g;
}
