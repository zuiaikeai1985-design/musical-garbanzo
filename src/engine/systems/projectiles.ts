import { TILE } from "../constants";
import { weaponDef } from "../rules";
import { EffectKind, ProjectileKind, type Projectile, type Structure } from "../types";
import { dist, turnToward } from "../util/vec";
import type { World } from "../world";
import { applyAreaDamage, applyDamage } from "./combat";

/** Distance at which a projectile counts as having reached its aim point. */
const HIT_EPS = 4;
/** How sharply a missile can steer, in radians per tick. */
const MISSILE_TURN = 0.14;

/**
 * Moves projectiles and resolves impacts.
 *
 * Shells and grenades fly to a fixed point (so you can dodge artillery), while rockets home in
 * on their target — the same distinction the original made, and the reason V2s are devastating
 * against buildings but poor against moving armour.
 */
export function projectileSystem(world: World): void {
  for (const p of world.projectiles) {
    if (p.dead) continue;
    const weapon = weaponDef(p.weapon);
    p.px = p.x;
    p.py = p.y;
    p.age++;

    if (p.age > p.life) {
      detonate(world, p, false);
      continue;
    }

    if (weapon.projectile === ProjectileKind.Missile && p.targetId !== 0) {
      const target = world.entity(p.targetId);
      if (target && !target.dead) {
        const centre = world.entityCenter(target);
        p.tx = centre.x;
        p.ty = centre.y;
      }
      const desired = Math.atan2(p.ty - p.y, p.tx - p.x);
      const heading = turnToward(Math.atan2(p.vy, p.vx), desired, MISSILE_TURN);
      p.vx = Math.cos(heading) * weapon.speed;
      p.vy = Math.sin(heading) * weapon.speed;
      // Rockets leave a smoke trail.
      if (p.age % 2 === 0) world.spawnEffect(EffectKind.Smoke, p.x, p.y, 16, { scale: 0.4 });
    } else if (weapon.projectile === ProjectileKind.Flame) {
      if (p.age % 2 === 0) world.spawnEffect(EffectKind.Fire, p.x, p.y, 10, { scale: 0.5 });
    }

    // Detonate *before* stepping when the remaining distance is under one step: otherwise a fast
    // projectile can jump straight over its aim point and never register a hit.
    if (dist(p.x, p.y, p.tx, p.ty) <= Math.max(HIT_EPS, weapon.speed)) {
      p.x = p.tx;
      p.y = p.ty;
      detonate(world, p, true);
      continue;
    }

    p.x += p.vx;
    p.y += p.vy;

    // Direct-fire rounds also detonate on anything solid they run into. The struck building is
    // passed through explicitly: the shell stops at the wall it hits, which can be a tile or more
    // from the building's centre — far outside a tank shell's splash radius.
    if (weapon.projectile === ProjectileKind.Ballistic) {
      const struck = world.grid.structureIdAt(Math.floor(p.x / TILE), Math.floor(p.y / TILE));
      if (struck !== 0) {
        const structure = world.structure(struck);
        if (structure && !structure.dead && structure.side !== p.side) {
          detonate(world, p, true, structure);
        }
      }
    }
  }

  let write = 0;
  for (const p of world.projectiles) if (!p.dead) world.projectiles[write++] = p;
  world.projectiles.length = write;
}

function detonate(
  world: World,
  p: Projectile,
  hit: boolean,
  directTarget?: Structure,
): void {
  p.dead = true;
  const weapon = weaponDef(p.weapon);

  if (hit) {
    if (directTarget) {
      applyDamage(world, directTarget, weapon, p.side, p.ownerId);
      if (weapon.spread > 0) applyAreaDamage(world, p.x, p.y, weapon, p.side, p.ownerId);
    } else if (weapon.spread > 0) {
      applyAreaDamage(world, p.x, p.y, weapon, p.side, p.ownerId);
    } else {
      const target = world.entity(p.targetId);
      if (target && !target.dead) {
        applyDamage(world, target, weapon, p.side, p.ownerId);
      } else {
        // Aimed at a point rather than an entity: hit whatever is standing there.
        applyAreaDamage(world, p.x, p.y, { ...weapon, spread: TILE * 0.4 }, p.side, p.ownerId);
      }
    }
  }

  const big = weapon.damage >= 60 || weapon.spread >= TILE;
  if (weapon.projectile === ProjectileKind.Flame) {
    world.spawnEffect(EffectKind.Fire, p.x, p.y, 40, { scale: 0.9 });
    world.emitSound("flame", p.x, p.y, p.side);
  } else {
    world.spawnEffect(big ? EffectKind.Explosion : EffectKind.SmallExplosion, p.x, p.y, big ? 24 : 14);
    world.emitSound(big ? "explosionMedium" : "explosionSmall", p.x, p.y, p.side);
  }
  if (big) {
    world.events.push({ type: "screenShake", magnitude: 3, x: p.x, y: p.y });
  }
}
