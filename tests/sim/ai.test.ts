import { describe, expect, it } from "vitest";
import { Game } from "../../src/engine/game";
import { m01IronCurtain } from "../../src/maps/m01-iron-curtain";
import { TICKS_PER_SECOND } from "../../src/engine/constants";
import { GameStatus, type Difficulty, type Side } from "../../src/engine/types";
import { unitDef } from "../../src/engine/rules";
import { assertWorldSane } from "./helpers";

const MINUTE = TICKS_PER_SECOND * 60;

function run(game: Game, ticks: number, onTick?: (tick: number) => void): void {
  for (let i = 0; i < ticks; i++) {
    game.tick();
    onTick?.(i);
    if (game.status !== GameStatus.Playing) break;
  }
}

function armyValue(game: Game, side: Side): number {
  let value = 0;
  for (const u of game.world.units) {
    if (u.side !== side || u.dead) continue;
    const def = unitDef(u.kind);
    if (!def.weapon || def.cargoCapacity > 0) continue;
    value += def.cost;
  }
  return value;
}

function structureCount(game: Game, side: Side): number {
  return game.world.structures.filter((s) => s.side === side && !s.dead).length;
}

describe("allied AI", () => {
  it("expands its base and builds an army while the player sits still", () => {
    const game = new Game(m01IronCurtain, "normal");
    const before = structureCount(game, "allied");

    run(game, MINUTE * 8);

    expect(structureCount(game, "allied"), "AI should expand").toBeGreaterThan(before);
    expect(armyValue(game, "allied"), "AI should build combat units").toBeGreaterThan(600);
    expect(
      game.world.units.filter((u) => u.side === "allied" && u.kind === "harva").length,
      "AI should keep harvesters alive",
    ).toBeGreaterThanOrEqual(1);
    assertWorldSane(game.world, "ai buildup");
  });

  it("builds the tech it needs in order", () => {
    const game = new Game(m01IronCurtain, "normal");
    run(game, MINUTE * 10);
    const kinds = new Set(
      game.world.structures.filter((s) => s.side === "allied" && !s.dead).map((s) => s.kind),
    );
    expect(kinds.has("barracks_a")).toBe(true);
    expect(kinds.has("warfactory_a")).toBe(true);
  });

  it("attacks and eventually destroys an idle player", () => {
    const game = new Game(m01IronCurtain, "normal");
    const world = game.world;
    const startingStructures = structureCount(game, "soviet");

    run(game, MINUTE * 30);

    const remaining = structureCount(game, "soviet");
    expect(
      remaining,
      "an idle player should be ground down by attack waves",
    ).toBeLessThan(startingStructures);
    expect(world.players.allied.stats.enemiesDestroyed).toBeGreaterThan(0);
  });

  it("is gentler on Recruit than on Commissar", () => {
    const damageAfter = (difficulty: Difficulty, ticks: number) => {
      const game = new Game(m01IronCurtain, difficulty);
      const before = game.world.players.soviet.stats.structuresLost;
      run(game, ticks);
      return {
        losses: game.world.players.soviet.stats.structuresLost - before,
        aiArmy: armyValue(game, "allied"),
      };
    };

    const easy = damageAfter("easy", MINUTE * 18);
    const hard = damageAfter("hard", MINUTE * 18);

    expect(hard.aiArmy, "Commissar should field a bigger army").toBeGreaterThan(easy.aiArmy);
    expect(hard.losses).toBeGreaterThanOrEqual(easy.losses);
  });

  it("recalls defenders when its base is attacked", () => {
    const game = new Game(m01IronCurtain, "normal");
    const world = game.world;
    run(game, MINUTE * 4);

    const alliedBase = world.structures.find((s) => s.side === "allied" && s.kind === "conyard_a")!;
    const centre = world.structureCenter(alliedBase);

    // Drop a raiding party right on top of the enemy base.
    const raiders = [0, 1, 2, 3].map((i) =>
      world.spawnUnit("3tnk", "soviet", centre.x - 140, centre.y + (i - 1.5) * 30),
    );
    game.dispatch({
      type: "order",
      ids: raiders.map((r) => r.id),
      order: { type: "attack", targetId: alliedBase.id },
      queue: false,
    });

    run(game, MINUTE * 3);

    expect(world.ai!.lastThreatTick).toBeGreaterThan(0);
    // Either the raid is being answered or the raiders are already dead.
    const defendersEngaged = world.units.some(
      (u) => u.side === "allied" && !u.dead && u.order.type === "attackMove",
    );
    const raidersDead = raiders.every((r) => r.dead);
    expect(defendersEngaged || raidersDead).toBe(true);
  });

  it("survives a full 30-minute match without exceptions or runaway entity counts", () => {
    const game = new Game(m01IronCurtain, "normal");
    let maxUnits = 0;
    let maxEffects = 0;

    run(game, MINUTE * 30, (i) => {
      maxUnits = Math.max(maxUnits, game.world.units.length);
      maxEffects = Math.max(maxEffects, game.world.effects.length);
      if (i % (MINUTE * 5) === 0) assertWorldSane(game.world, `minute ${i / MINUTE}`);
    });

    assertWorldSane(game.world, "final");
    expect(maxUnits, "unit count should stay bounded").toBeLessThan(400);
    expect(maxEffects, "effect count should stay bounded").toBeLessThan(4000);
    expect(game.world.projectiles.length).toBeLessThan(200);
  });

  it("keeps the tick budget affordable with a large battle in progress", () => {
    const game = new Game(m01IronCurtain, "hard");
    run(game, MINUTE * 5);

    // Add a serious force on both sides, then measure steady-state tick cost.
    const world = game.world;
    for (let i = 0; i < 60; i++) {
      world.spawnUnit("3tnk", "soviet", 24 * 30 + (i % 10) * 26, 24 * 40 + Math.floor(i / 10) * 26);
      world.spawnUnit("2tnk", "allied", 24 * 40 + (i % 10) * 26, 24 * 40 + Math.floor(i / 10) * 26);
    }

    const start = performance.now();
    const ticks = 600;
    for (let i = 0; i < ticks; i++) game.tick();
    const perTick = (performance.now() - start) / ticks;

    // The browser has 33ms per simulation tick; anything close to that is a problem.
    expect(perTick, `mean tick took ${perTick.toFixed(2)}ms`).toBeLessThan(8);
  });
});
