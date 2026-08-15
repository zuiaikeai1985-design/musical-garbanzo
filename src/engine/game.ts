import { PATH_BUDGET_PER_TICK } from "./constants";
import type { Command } from "./commands";
import { GameStatus, type Difficulty, type EntityId } from "./types";
import { World } from "./world";
import { movementSystem } from "./systems/movement";
import { applyOrder, giveOrder, orderSystem } from "./systems/orders";
import { powerSystem } from "./systems/power";
import { victorySystem } from "./systems/victory";
import type { MissionDef } from "../maps/types";

/**
 * Owns the simulation and advances it one fixed tick at a time.
 *
 * `Game` has no notion of frames, canvases or React — the app calls `tick()` from an accumulator
 * loop, and `tests/sim/` calls it in a plain `for` loop.
 */
export class Game {
  readonly world: World;
  readonly mission: MissionDef;

  constructor(mission: MissionDef, difficulty: Difficulty, seed = mission.seed) {
    this.mission = mission;
    this.world = new World(mission.width, mission.height, seed, difficulty);
    this.world.players.soviet.credits = mission.startCredits.soviet;
    this.world.players.allied.credits = mission.startCredits.allied;
    mission.build(this.world);
    // Establish the initial power balance so nothing spends its first tick browned out.
    powerSystem(this.world);
  }

  get status(): GameStatus {
    return this.world.status;
  }

  /** Queues a command; it is applied at the start of the next tick. */
  dispatch(command: Command): void {
    this.world.commands.push(command);
  }

  tick(): void {
    const world = this.world;
    if (world.status !== GameStatus.Playing) return;

    world.tick++;
    world.pathBudget = PATH_BUDGET_PER_TICK;

    // Snapshot positions so the renderer can interpolate between ticks.
    for (const u of world.units) {
      u.px = u.x;
      u.py = u.y;
    }

    this.processCommands();

    orderSystem(world);
    movementSystem(world);
    powerSystem(world);
    this.updateEffects();
    this.removeDead();
    victorySystem(world);
  }

  // ── Commands ──────────────────────────────────────────────────────────────

  private processCommands(): void {
    const world = this.world;
    const queue = world.commands;
    for (let i = 0; i < queue.length; i++) {
      const cmd = queue[i];
      switch (cmd.type) {
        case "select": {
          world.selection = new Set(cmd.ids.filter((id) => world.isAlive(id)));
          break;
        }
        case "order": {
          for (const id of cmd.ids) {
            const u = world.unit(id);
            if (!u || u.dead) continue;
            giveOrder(world, u, cmd.order, cmd.queue);
          }
          break;
        }
        case "setRally": {
          const s = world.structure(cmd.id);
          if (s && !s.dead) {
            s.rallyX = cmd.x;
            s.rallyY = cmd.y;
          }
          break;
        }
        case "cheatCredits": {
          world.addCredits(cmd.side, cmd.amount);
          break;
        }
        // Production, placement, selling, repair and the superweapon are handled by their own
        // systems, added in later phases.
        case "queueAdd":
        case "queueCancel":
        case "queueToggleHold":
        case "placeStructure":
        case "sellStructure":
        case "toggleRepair":
        case "launchNuke":
          break;
      }
    }
    queue.length = 0;
  }

  // ── Housekeeping ──────────────────────────────────────────────────────────

  private updateEffects(): void {
    const effects = this.world.effects;
    let write = 0;
    for (let read = 0; read < effects.length; read++) {
      const e = effects[read];
      e.age++;
      if (e.age < e.life) effects[write++] = e;
    }
    effects.length = write;
  }

  private removeDead(): void {
    const world = this.world;

    if (world.units.some((u) => u.dead)) {
      for (const u of world.units) {
        if (!u.dead) continue;
        world.unitById.delete(u.id);
        world.selection.delete(u.id);
        for (const group of world.controlGroups) group.delete(u.id);
      }
      let write = 0;
      for (const u of world.units) if (!u.dead) world.units[write++] = u;
      world.units.length = write;
    }

    if (world.structures.some((s) => s.dead)) {
      for (const s of world.structures) {
        if (!s.dead) continue;
        world.structureById.delete(s.id);
        world.selection.delete(s.id);
      }
      let write = 0;
      for (const s of world.structures) if (!s.dead) world.structures[write++] = s;
      world.structures.length = write;
    }

    if (world.projectiles.some((p) => p.dead)) {
      let write = 0;
      for (const p of world.projectiles) if (!p.dead) world.projectiles[write++] = p;
      world.projectiles.length = write;
    }
  }

  // ── Convenience helpers used by tests and the input layer ─────────────────

  orderUnits(ids: EntityId[], order: Parameters<typeof applyOrder>[2], queue = false): void {
    this.dispatch({ type: "order", ids, order, queue });
  }
}
