import { NUKE_COUNTDOWN_TICKS, TILE } from "../constants";
import { structureDef, weaponDef } from "../rules";
import { EffectKind, type EntityId, type Side } from "../types";
import type { World } from "../world";
import { applyAreaDamage } from "./combat";
import { revealArea } from "./shroud";

/**
 * The Missile Silo.
 *
 * Charges only while powered — losing the grid stalls the countdown, which is what makes a
 * strike on the enemy's power plants worthwhile even late in a match.
 */
export function superweaponSystem(world: World): void {
  chargeSilos(world);
  resolvePendingNuke(world);
}

function chargeSilos(world: World): void {
  for (const s of world.structures) {
    if (s.dead || s.buildProgress < 1) continue;
    const def = structureDef(s.kind);
    if (def.superweaponCharge <= 0) continue;
    if (!s.online) continue;

    if (s.charge >= def.superweaponCharge) {
      if (s.side === world.humanSide && world.nukeReadySilo !== s.id) {
        world.nukeReadySilo = s.id;
        world.emitEva("nuclearWeaponAvailable", s.side);
        world.emitSound("radarOn", 0, 0, s.side);
      }
      continue;
    }

    s.charge++;
    if (s.charge >= def.superweaponCharge && s.side !== world.humanSide) {
      // The AI fires as soon as it is able.
      const target = pickAiNukeTarget(world, s.side);
      if (target) launchNuke(world, s.id, target.x, target.y);
    }
  }

  // Forget a ready silo that has since been destroyed or lost power.
  if (world.nukeReadySilo !== 0) {
    const silo = world.structure(world.nukeReadySilo);
    if (!silo || silo.dead || silo.charge < structureDef(silo.kind).superweaponCharge) {
      world.nukeReadySilo = 0;
    }
  }
}

/** Returns true when the launch was accepted. */
export function launchNuke(world: World, siloId: EntityId, x: number, y: number): boolean {
  const silo = world.structure(siloId);
  if (!silo || silo.dead) return false;
  const def = structureDef(silo.kind);
  if (def.superweaponCharge <= 0 || silo.charge < def.superweaponCharge) return false;
  // One warhead in the air at a time keeps the countdown UI unambiguous.
  if (world.pendingNuke) return false;

  silo.charge = 0;
  if (world.nukeReadySilo === siloId) world.nukeReadySilo = 0;

  world.pendingNuke = {
    x,
    y,
    impactTick: world.tick + NUKE_COUNTDOWN_TICKS,
    side: silo.side,
  };

  world.emitEva("nuclearWeaponLaunched", silo.side, x, y);
  world.emitSound("nukeLaunch", 0, 0, silo.side);
  world.emitSound("klaxon", 0, 0, silo.side);
  return true;
}

function resolvePendingNuke(world: World): void {
  const pending = world.pendingNuke;
  if (!pending) return;
  if (world.tick < pending.impactTick) return;

  world.pendingNuke = null;
  const weapon = weaponDef("nuke");
  const { x, y, side } = pending;

  applyAreaDamage(world, x, y, weapon, side, 0);
  // A nuclear flash lights up the whole area regardless of who was watching.
  revealArea(world, x, y, weapon.spread / TILE + 6);

  world.spawnEffect(EffectKind.Nuke, x, y, 150);
  world.spawnEffect(EffectKind.Shockwave, x, y, 60, { scale: 14 });
  world.spawnEffect(EffectKind.Crater, x, y, 30 * 120, { scale: 7 });

  // Ring the blast with fires and scorch marks.
  for (let i = 0; i < 18; i++) {
    const angle = (i / 18) * Math.PI * 2;
    const radius = TILE * (1.5 + (i % 4) * 1.4);
    world.spawnEffect(
      EffectKind.Fire,
      x + Math.cos(angle) * radius,
      y + Math.sin(angle) * radius,
      30 * (18 + (i % 5) * 4),
      { scale: 1.4 },
    );
  }
  world.spawnEffect(EffectKind.Smoke, x, y, 30 * 20, { scale: 4 });

  world.emitSound("nukeImpact", 0, 0, side);
  world.events.push({ type: "screenShake", magnitude: 22, x, y });
}

/** The AI aims at the densest cluster of enemy buildings it knows about. */
function pickAiNukeTarget(world: World, side: Side): { x: number; y: number } | null {
  const enemy: Side = side === "soviet" ? "allied" : "soviet";
  const targets = world.structures.filter((s) => s.side === enemy && !s.dead);
  if (targets.length === 0) return null;

  let best = null as { x: number; y: number } | null;
  let bestScore = -1;
  const blastRadius = weaponDef("nuke").spread;

  for (const candidate of targets) {
    const centre = world.structureCenter(candidate);
    let score = 0;
    for (const other of targets) {
      const c = other === candidate ? centre : world.structureCenter(other);
      if (Math.hypot(c.x - centre.x, c.y - centre.y) <= blastRadius) {
        score += structureDef(other.kind).cost;
      }
    }
    if (score > bestScore) {
      bestScore = score;
      best = centre;
    }
  }
  return best;
}
