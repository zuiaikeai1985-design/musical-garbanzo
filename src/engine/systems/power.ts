import { MIN_POWER_FACTOR } from "../constants";
import { structureDef } from "../rules";
import type { Side } from "../types";
import { clamp } from "../util/vec";
import type { World } from "../world";

/** Sides are re-evaluated every tick — it is a handful of additions over the structure list. */
const SIDES: readonly Side[] = ["soviet", "allied"];

/**
 * Recomputes each player's power balance and decides which structures are running.
 *
 * In a brownout, defensive structures and the radar shut down first (as in the original) while
 * production merely slows, so losing your power plants is painful but not instantly fatal.
 */
export function powerSystem(world: World): void {
  for (const side of SIDES) {
    const player = world.players[side];
    let produced = 0;
    let consumed = 0;

    for (const s of world.structures) {
      if (s.side !== side || s.dead) continue;
      const def = structureDef(s.kind);
      if (s.buildProgress < 1) continue;
      // A damaged power plant produces proportionally less, like RA.
      const health = clamp(s.hp / def.hp, 0.25, 1);
      produced += def.powerProduced * health;
      consumed += def.powerConsumed;
    }

    player.powerProduced = Math.round(produced);
    player.powerConsumed = consumed;
    const factor = consumed <= 0 ? 1 : clamp(produced / consumed, 0, 1);
    player.powerFactor = factor;

    const brownout = factor < 1;
    for (const s of world.structures) {
      if (s.side !== side || s.dead) continue;
      const def = structureDef(s.kind);
      const needsPower = def.powerConsumed > 0;
      const isCritical = def.weapon !== null || def.providesRadar;
      s.online = !brownout || !needsPower || !isCritical;
    }
  }
}

/** Production speed multiplier for a side: 1 at full power, floored during a blackout. */
export function productionFactor(world: World, side: Side): number {
  return clamp(world.players[side].powerFactor, MIN_POWER_FACTOR, 1);
}

/** Does this side have a working radar (powered Radar Dome)? */
export function hasRadar(world: World, side: Side): boolean {
  for (const s of world.structures) {
    if (s.side !== side || s.dead || s.buildProgress < 1) continue;
    if (structureDef(s.kind).providesRadar && s.online) return true;
  }
  return false;
}
