import type { AABB, HitZone, Vec3 } from "./types";
import { applyDamage, rayAABB, raySphere } from "./math";
import type { Bot } from "./bots";
import type { Player } from "./player";
import { PLAYER_RADIUS } from "./player";

export interface HitTarget {
  kind: "bot" | "player";
  bot?: Bot;
  zone: HitZone;
  point: Vec3;
  distance: number;
}

export interface WorldHit {
  point: Vec3;
  distance: number;
}

export function traceShot(
  origin: Vec3,
  dir: Vec3,
  bots: Bot[],
  player: Player,
  colliders: AABB[],
  skipPlayer: boolean,
  skipBotId?: string,
): { target: HitTarget | null; world: WorldHit | null } {
  const hit: { target: HitTarget | null; world: WorldHit | null } = {
    target: null,
    world: null,
  };

  for (const bot of bots) {
    if (!bot.alive || bot.id === skipBotId) continue;
    const headT = raySphere(origin, dir, bot.headCenter(), 0.18);
    const bodyT = rayAABB(origin, dir, bot.bodyAABB());
    const legsBox = {
      minX: bot.pos.x - 0.28,
      maxX: bot.pos.x + 0.28,
      minY: bot.pos.y,
      maxY: bot.pos.y + 0.7,
      minZ: bot.pos.z - 0.22,
      maxZ: bot.pos.z + 0.22,
    };
    const legsT = rayAABB(origin, dir, legsBox);
    consider(headT, "head", bot);
    consider(bodyT, "body", bot);
    consider(legsT, "legs", bot);
  }

  if (!skipPlayer && player.alive) {
    const head = { x: player.pos.x, y: player.eyeY, z: player.pos.z };
    const headT = raySphere(origin, dir, head, 0.16);
    const body = {
      minX: player.pos.x - PLAYER_RADIUS,
      maxX: player.pos.x + PLAYER_RADIUS,
      minY: player.pos.y + 0.7,
      maxY: player.pos.y + player.height,
      minZ: player.pos.z - PLAYER_RADIUS,
      maxZ: player.pos.z + PLAYER_RADIUS,
    };
    const legs = {
      minX: player.pos.x - PLAYER_RADIUS,
      maxX: player.pos.x + PLAYER_RADIUS,
      minY: player.pos.y,
      maxY: player.pos.y + 0.7,
      minZ: player.pos.z - PLAYER_RADIUS,
      maxZ: player.pos.z + PLAYER_RADIUS,
    };
    const bodyT = rayAABB(origin, dir, body);
    const legsT = rayAABB(origin, dir, legs);
    if (headT !== null) considerPlayer(headT, "head");
    if (bodyT !== null) considerPlayer(bodyT, "body");
    if (legsT !== null) considerPlayer(legsT, "legs");
  }

  for (const box of colliders) {
    const t = rayAABB(origin, dir, box);
    if (t === null || t < 0.05) continue;
    if (!hit.world || t < hit.world.distance) {
      hit.world = {
        distance: t,
        point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
      };
    }
  }

  if (hit.target && hit.world && hit.world.distance < hit.target.distance) {
    return { target: null, world: hit.world };
  }
  return hit;

  function consider(t: number | null, zone: HitZone, bot: Bot): void {
    if (t === null || t < 0.05) return;
    if (hit.target && t >= hit.target.distance) return;
    hit.target = {
      kind: "bot",
      bot,
      zone,
      distance: t,
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
    };
  }

  function considerPlayer(t: number, zone: HitZone): void {
    if (t < 0.05) return;
    if (hit.target && t >= hit.target.distance) return;
    hit.target = {
      kind: "player",
      zone,
      distance: t,
      point: { x: origin.x + dir.x * t, y: origin.y + dir.y * t, z: origin.z + dir.z * t },
    };
  }
}

export function damageActor(
  health: number,
  armor: number,
  hasHelmet: boolean,
  base: number,
  armorPen: number,
  zone: HitZone,
): { health: number; armor: number; dealt: number; killed: boolean } {
  const result = applyDamage(health, armor, base, armorPen, zone, hasHelmet);
  return { ...result, killed: result.health <= 0 };
}
