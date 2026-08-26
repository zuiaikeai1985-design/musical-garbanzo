import { ACQUIRE_INTERVAL, TILE } from "../constants";
import { structureDef, unitDef, weaponDef } from "../rules";
import {
  ArmorKind,
  EffectKind,
  ProjectileKind,
  UnitClass,
  type EntityId,
  type Side,
  type Structure,
  type Unit,
  type WeaponDef,
} from "../types";
import { angleDelta, dist, turnToward } from "../util/vec";
import type { World } from "../world";
import { notifyAiThreat } from "./ai";
import { destroyStructure } from "./production";

/** How closely a gun must be pointed at its target before it will fire, in radians. */
const AIM_TOLERANCE = 0.16;
/** Extra range granted when deciding whether to keep shooting at the current target. */
const RANGE_HYSTERESIS = TILE * 0.75;
/** Minimum ticks between "our base is under attack" warnings. */
const ATTACK_WARNING_COOLDOWN = 30 * 20;

export type Combatant = Unit | Structure;

function isStructure(e: Combatant): e is Structure {
  return "tx" in e;
}

export function armorOf(e: Combatant): ArmorKind {
  return isStructure(e) ? structureDef(e.kind).armor : unitDef(e.kind).armor;
}

/** A weapon with a zero multiplier against an armour class simply cannot hurt it. */
export function canHarm(weapon: WeaponDef, target: Combatant): boolean {
  return weapon.verses[armorOf(target)] > 0;
}

/**
 * Combat: acquire targets, rotate turrets, fire, and resolve deaths.
 *
 * Structures and units share this code path — a Tesla Coil is simply a combatant that cannot
 * move — which keeps the aiming and cooldown rules identical everywhere.
 */
export function combatSystem(world: World): void {
  for (const u of world.units) {
    if (u.dead) continue;
    updateUnitCombat(world, u);
  }
  for (const s of world.structures) {
    if (s.dead || s.buildProgress < 1) continue;
    updateStructureCombat(world, s);
  }
  applySelfHealing(world);
}

// ── Units ───────────────────────────────────────────────────────────────────

function updateUnitCombat(world: World, u: Unit): void {
  const def = unitDef(u.kind);
  if (!def.weapon) return;

  if (u.cooldown > 0) u.cooldown--;
  if (u.burstCooldown > 0) u.burstCooldown--;

  // Finish a burst even if the target has since died — the shots are already committed.
  if (u.burstLeft > 0 && u.burstCooldown <= 0) {
    const target = world.entity(u.targetId);
    if (target && !target.dead) {
      fireOnce(world, u, target, chooseWeapon(u, target));
      u.burstLeft--;
      u.burstCooldown = chooseWeapon(u, target).burstDelay;
      return;
    }
    u.burstLeft = 0;
  }

  const target = resolveTarget(world, u);
  if (!target) return;

  const weapon = chooseWeapon(u, target);
  const centre = world.entityCenter(target);
  const reach = weapon.range + world.entityRadius(target) * 0.6 + RANGE_HYSTERESIS;
  const d = dist(u.x, u.y, centre.x, centre.y);
  if (d > reach) return;

  const desired = Math.atan2(centre.y - u.y, centre.x - u.x);
  const moving = u.pathIndex < u.path.length;

  if (def.hasTurret) {
    u.turret = turnToward(u.turret, desired, def.turretTurnRate);
    if (Math.abs(angleDelta(u.turret, desired)) > AIM_TOLERANCE) return;
  } else {
    // Turretless units must physically point at the target, and artillery must stop first.
    if (moving && def.cls === UnitClass.Vehicle) return;
    u.facing = turnToward(u.facing, desired, def.turnRate);
    u.turret = u.facing;
    if (Math.abs(angleDelta(u.facing, desired)) > AIM_TOLERANCE) return;
  }

  if (u.cooldown > 0) return;

  fireOnce(world, u, target, weapon);
  u.cooldown = weapon.rof;
  u.burstLeft = weapon.burst - 1;
  u.burstCooldown = weapon.burstDelay;
}

/** Mammoths carry rockets for soft targets and cannons for everything else. */
function chooseWeapon(u: Unit, target: Combatant): WeaponDef {
  const def = unitDef(u.kind);
  const primary = weaponDef(def.weapon!);
  if (!def.weapon2) return primary;
  const secondary = weaponDef(def.weapon2);
  const armor = armorOf(target);
  return secondary.verses[armor] > primary.verses[armor] ? secondary : primary;
}

/**
 * Works out what a unit should be shooting at: an explicit attack order, or — when idle,
 * guarding or attack-moving — the best enemy that wandered into range.
 */
function resolveTarget(world: World, u: Unit): Combatant | null {
  const def = unitDef(u.kind);
  const weapon = weaponDef(def.weapon!);

  if (u.order.type === "attack") {
    const explicit = world.entity(u.order.targetId);
    if (explicit && !explicit.dead && canHarm(weapon, explicit)) {
      u.targetId = explicit.id;
      return explicit;
    }
  }

  // Keep hitting the current target while it stays alive and in range.
  const current = world.entity(u.targetId);
  if (current && !current.dead && canHarm(weapon, current)) {
    const centre = world.entityCenter(current);
    if (dist(u.x, u.y, centre.x, centre.y) <= weapon.range + RANGE_HYSTERESIS * 2) return current;
  }

  // A plain move order suppresses auto-acquisition so units actually go where they are told.
  if (u.order.type === "move") {
    u.targetId = 0;
    return null;
  }

  // Stagger scans across units so a big army does not scan on the same tick.
  if ((world.tick + u.id) % ACQUIRE_INTERVAL !== 0) return null;

  const found = findTarget(world, u.side, u.x, u.y, weapon.range, weapon);
  u.targetId = found?.id ?? 0;
  return found;
}

/** Nearest harmable enemy within `range`, preferring units over buildings. */
export function findTarget(
  world: World,
  side: Side,
  x: number,
  y: number,
  range: number,
  weapon: WeaponDef,
): Combatant | null {
  let best: Combatant | null = null;
  let bestScore = Infinity;

  world.unitHash.query(x, y, range + TILE, (id) => {
    const other = world.unitById.get(id);
    if (!other || other.dead || other.side === side) return;
    if (!canHarm(weapon, other)) return;
    const d = dist(x, y, other.x, other.y);
    if (d > range) return;
    if (d < bestScore) {
      bestScore = d;
      best = other;
    }
  });

  if (best) return best;

  for (const s of world.structures) {
    if (s.dead || s.side === side) continue;
    if (!canHarm(weapon, s)) continue;
    const centre = world.structureCenter(s);
    const d = dist(x, y, centre.x, centre.y) - world.entityRadius(s) * 0.5;
    if (d > range) continue;
    // Buildings are a last resort while enemy units are around.
    const score = d + TILE * 4;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }

  return best;
}

// ── Structures ──────────────────────────────────────────────────────────────

function updateStructureCombat(world: World, s: Structure): void {
  const def = structureDef(s.kind);
  if (!def.weapon || !s.online) return;

  if (s.cooldown > 0) s.cooldown--;
  if (s.burstCooldown > 0) s.burstCooldown--;

  const weapon = weaponDef(def.weapon);
  const centre = world.structureCenter(s);

  if (s.burstLeft > 0 && s.burstCooldown <= 0) {
    const target = world.entity(s.targetId);
    if (target && !target.dead) {
      fireFrom(world, s.side, centre.x, centre.y, s.id, target, weapon, s.turret);
      s.burstLeft--;
      s.burstCooldown = weapon.burstDelay;
      return;
    }
    s.burstLeft = 0;
  }

  let target = world.entity(s.targetId);
  const stillValid =
    target &&
    !target.dead &&
    target.side !== s.side &&
    canHarm(weapon, target) &&
    dist(centre.x, centre.y, world.entityCenter(target).x, world.entityCenter(target).y) <=
      weapon.range + RANGE_HYSTERESIS;

  if (!stillValid) {
    if ((world.tick + s.id) % ACQUIRE_INTERVAL !== 0) return;
    target = findTarget(world, s.side, centre.x, centre.y, weapon.range, weapon) ?? undefined;
    s.targetId = target?.id ?? 0;
  }
  if (!target) return;

  const aim = world.entityCenter(target);
  const desired = Math.atan2(aim.y - centre.y, aim.x - centre.x);
  if (def.hasTurret) {
    s.turret = turnToward(s.turret, desired, def.turretTurnRate);
    if (Math.abs(angleDelta(s.turret, desired)) > AIM_TOLERANCE) return;
  } else {
    s.turret = desired;
  }

  if (s.cooldown > 0) return;
  fireFrom(world, s.side, centre.x, centre.y, s.id, target, weapon, s.turret);
  s.cooldown = weapon.rof;
  s.burstLeft = weapon.burst - 1;
  s.burstCooldown = weapon.burstDelay;
}

// ── Firing ──────────────────────────────────────────────────────────────────

function fireOnce(world: World, u: Unit, target: Combatant, weapon: WeaponDef): void {
  const def = unitDef(u.kind);
  const angle = def.hasTurret ? u.turret : u.facing;
  const muzzle = def.cls === UnitClass.Infantry ? 6 : unitDef(u.kind).radius + 4;
  fireFrom(
    world,
    u.side,
    u.x + Math.cos(angle) * muzzle,
    u.y + Math.sin(angle) * muzzle,
    u.id,
    target,
    weapon,
    angle,
  );
}

function fireFrom(
  world: World,
  side: Side,
  x: number,
  y: number,
  ownerId: EntityId,
  target: Combatant,
  weapon: WeaponDef,
  angle: number,
): void {
  const aim = world.entityCenter(target);

  world.spawnEffect(EffectKind.MuzzleFlash, x, y, 4, { rot: angle, side });
  world.emitSound(soundForWeapon(weapon.id), x, y, side);

  if (weapon.projectile === ProjectileKind.Instant) {
    world.spawnEffect(weapon.id === "tesla" ? EffectKind.TeslaArc : EffectKind.Tracer, x, y, 6, {
      x2: aim.x,
      y2: aim.y,
      side,
    });
    if (weapon.spread > 0) {
      applyAreaDamage(world, aim.x, aim.y, weapon, side, ownerId);
    } else {
      applyDamage(world, target, weapon, side, ownerId);
    }
    world.spawnEffect(EffectKind.Spark, aim.x, aim.y, 8, { side });
    return;
  }

  // Launch along the exact vector to the aim point, not the turret's angle. The turret is only
  // aligned to within AIM_TOLERANCE, and over five tiles that slop is enough to make almost every
  // shell sail past its target without ever reaching the impact test.
  const travel = Math.atan2(aim.y - y, aim.x - x);

  world.projectiles.push({
    id: world.allocId(),
    weapon: weapon.id,
    side,
    ownerId,
    x,
    y,
    px: x,
    py: y,
    tx: aim.x,
    ty: aim.y,
    targetId: weapon.projectile === ProjectileKind.Missile ? target.id : 0,
    vx: Math.cos(travel) * weapon.speed,
    vy: Math.sin(travel) * weapon.speed,
    age: 0,
    life: Math.ceil((dist(x, y, aim.x, aim.y) / Math.max(0.5, weapon.speed)) * 2.5) + 20,
    dead: false,
  });
}

function soundForWeapon(id: string) {
  switch (id) {
    case "rifle":
      return "rifle" as const;
    case "mg":
      return "mg" as const;
    case "apShell":
    case "apShellLight":
    case "turretGun":
      return "cannon" as const;
    case "apShellHeavy":
      return "cannonHeavy" as const;
    case "rocket":
    case "mammothTusk":
    case "v2rocket":
      return "rocketLaunch" as const;
    case "grenade":
    case "artillery":
      return "grenade" as const;
    case "flame":
      return "flame" as const;
    case "tesla":
      return "tesla" as const;
    case "dogJaw":
      return "dogBark" as const;
    default:
      return "rifle" as const;
  }
}

// ── Damage ──────────────────────────────────────────────────────────────────

export function applyDamage(
  world: World,
  target: Combatant,
  weapon: WeaponDef,
  attacker: Side,
  attackerId: EntityId,
  scale = 1,
): void {
  if (target.dead) return;
  const amount = weapon.damage * weapon.verses[armorOf(target)] * scale;
  if (amount <= 0) return;

  target.hp -= amount;

  if (isStructure(target)) {
    warnBaseUnderAttack(world, target);
  }
  // Let the computer opponent know it is being shot at so it can recall defenders.
  if (world.ai && target.side === world.ai.side) {
    const centre = world.entityCenter(target);
    notifyAiThreat(world, target.side, centre.x, centre.y);
  }

  if (target.hp > 0) return;
  killEntity(world, target, attacker, attackerId);
}

/** Splash damage with linear falloff from the centre. */
export function applyAreaDamage(
  world: World,
  x: number,
  y: number,
  weapon: WeaponDef,
  attacker: Side,
  attackerId: EntityId,
): void {
  const radius = Math.max(weapon.spread, 1);

  const hits: Combatant[] = [];
  world.unitHash.query(x, y, radius + TILE, (id) => {
    const u = world.unitById.get(id);
    if (u && !u.dead) hits.push(u);
  });
  for (const s of world.structures) {
    if (!s.dead) hits.push(s);
  }

  for (const target of hits) {
    const centre = world.entityCenter(target);
    const d = dist(x, y, centre.x, centre.y) - world.entityRadius(target) * 0.5;
    if (d > radius) continue;
    const falloff = Math.max(0.25, 1 - Math.max(0, d) / radius);
    applyDamage(world, target, weapon, attacker, attackerId, falloff);
  }
}

function warnBaseUnderAttack(world: World, s: Structure): void {
  if (s.side !== world.humanSide) return;
  const last = world.lastAttackWarningTick;
  if (world.tick - last < ATTACK_WARNING_COOLDOWN) return;
  world.lastAttackWarningTick = world.tick;
  const centre = world.structureCenter(s);
  world.emitEva("ourBaseIsUnderAttack", s.side, centre.x, centre.y);
  world.emitSound("klaxon", centre.x, centre.y, s.side);
}

// ── Death ───────────────────────────────────────────────────────────────────

export function killEntity(
  world: World,
  target: Combatant,
  attacker: Side,
  attackerId: EntityId,
): void {
  if (target.dead) return;
  target.hp = 0;

  const killer = world.unit(attackerId);
  if (killer) killer.kills++;
  if (target.side !== attacker) world.players[attacker].stats.enemiesDestroyed++;

  if (isStructure(target)) {
    killStructure(world, target);
  } else {
    killUnit(world, target);
  }
}

function killUnit(world: World, u: Unit): void {
  const def = unitDef(u.kind);
  u.dead = true;
  world.players[u.side].stats.unitsLost++;

  if (def.cls === UnitClass.Infantry) {
    world.spawnEffect(EffectKind.Corpse, u.x, u.y, 30 * 20, { rot: u.facing, side: u.side });
    world.spawnEffect(EffectKind.SmallExplosion, u.x, u.y, 12);
    world.emitSound("infantryDie", u.x, u.y, u.side);
  } else {
    world.spawnEffect(EffectKind.Explosion, u.x, u.y, 22);
    world.spawnEffect(EffectKind.Wreck, u.x, u.y, 30 * 25, { rot: u.facing, side: u.side });
    world.spawnEffect(EffectKind.Smoke, u.x, u.y, 30 * 8);
    world.emitSound("explosionMedium", u.x, u.y, u.side);
    world.events.push({ type: "screenShake", magnitude: 2, x: u.x, y: u.y });
  }

  world.events.push({ type: "unitDestroyed", id: u.id, kind: u.kind, side: u.side, x: u.x, y: u.y });
  if (u.side === world.humanSide) world.emitEva("unitLost", u.side, u.x, u.y);
}

function killStructure(world: World, s: Structure): void {
  const def = structureDef(s.kind);
  const centre = world.structureCenter(s);

  // A cluster of blasts across the footprint reads much better than one big puff.
  const spread = Math.max(def.w, def.h) * TILE * 0.4;
  world.spawnEffect(EffectKind.BigExplosion, centre.x, centre.y, 34);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    world.spawnEffect(
      EffectKind.Explosion,
      centre.x + Math.cos(angle) * spread,
      centre.y + Math.sin(angle) * spread,
      20 + i * 4,
    );
  }
  for (let i = 0; i < def.w * def.h; i++) {
    const fx = s.tx * TILE + (i % def.w) * TILE + TILE / 2;
    const fy = s.ty * TILE + Math.floor(i / def.w) * TILE + TILE / 2;
    world.spawnEffect(EffectKind.Fire, fx, fy, 30 * 14);
  }
  world.spawnEffect(EffectKind.Crater, centre.x, centre.y, 30 * 60, {
    scale: Math.max(def.w, def.h),
  });

  world.emitSound("structureExplode", centre.x, centre.y, s.side);
  world.events.push({ type: "screenShake", magnitude: 6, x: centre.x, y: centre.y });
  if (s.side === world.humanSide) world.emitEva("structureLost", s.side, centre.x, centre.y);

  destroyStructure(world, s, true);
}

// ── Self-repair ─────────────────────────────────────────────────────────────

function applySelfHealing(world: World): void {
  for (const u of world.units) {
    if (u.dead) continue;
    const def = unitDef(u.kind);
    if (def.selfHeal <= 0 || u.hp >= def.hp) continue;
    u.hp = Math.min(def.hp, u.hp + def.selfHeal);
  }
}
