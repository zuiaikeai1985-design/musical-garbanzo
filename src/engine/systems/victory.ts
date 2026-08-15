import { unitDef } from "../rules";
import { GameStatus, type Side } from "../types";
import type { World } from "../world";

/**
 * A side is beaten once it has no buildings and nothing left that could fight back or rebuild.
 *
 * A surviving Ore Truck deliberately does *not* count: letting a lone harvester keep a wiped-out
 * player "alive" turns the endgame into an unwinnable hide-and-seek across seventy tiles.
 */
function isEliminated(world: World, side: Side): boolean {
  for (const s of world.structures) {
    if (s.side === side && !s.dead) return false;
  }
  for (const u of world.units) {
    if (u.side !== side || u.dead) continue;
    const def = unitDef(u.kind);
    if (def.weapon !== null || u.kind === "mcv") return false;
  }
  return true;
}

export function victorySystem(world: World): void {
  if (world.status !== GameStatus.Playing) return;
  // Give the map a moment to settle before evaluating (structures spawn on tick 0).
  if (world.tick < 30) return;

  const enemy: Side = world.humanSide === "soviet" ? "allied" : "soviet";

  if (isEliminated(world, enemy)) {
    world.status = GameStatus.Victory;
    world.players[enemy].defeated = true;
    world.emitEva("missionAccomplished", world.humanSide);
    world.emitSound("victory");
    world.events.push({ type: "gameOver", victory: true });
    return;
  }

  if (isEliminated(world, world.humanSide)) {
    world.status = GameStatus.Defeat;
    world.players[world.humanSide].defeated = true;
    world.emitEva("missionFailed", world.humanSide);
    world.emitSound("defeat");
    world.events.push({ type: "gameOver", victory: false });
  }
}
