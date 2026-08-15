import { describe, expect, it } from "vitest";
import { Game } from "../../src/engine/game";
import { m01IronCurtain } from "../../src/maps/m01-iron-curtain";
import { Visibility } from "../../src/engine/world";
import { isExplored, isVisible, revealAll } from "../../src/engine/systems/shroud";
import { tileToWorldX, tileToWorldY } from "../../src/engine/util/vec";
import { unitDef } from "../../src/engine/rules";
import { computeScore } from "../../src/ui/screens/ResultScreen";
import { TICKS_PER_SECOND } from "../../src/engine/constants";

function newGame() {
  return new Game(m01IronCurtain, "normal");
}

describe("shroud", () => {
  it("starts with most of the map unexplored", () => {
    const game = newGame();
    for (let i = 0; i < 10; i++) game.tick();
    const vis = game.world.visibility;
    let unexplored = 0;
    for (let i = 0; i < vis.length; i++) if (vis[i] === Visibility.Unexplored) unexplored++;
    expect(unexplored / vis.length).toBeGreaterThan(0.8);
  });

  it("reveals the area around the player's own base", () => {
    const game = newGame();
    for (let i = 0; i < 10; i++) game.tick();
    const conyard = game.world.structures.find((s) => s.side === "soviet" && s.kind === "conyard")!;
    const centre = game.world.structureCenter(conyard);
    expect(isVisible(game.world, centre.x, centre.y)).toBe(true);
  });

  it("does not reveal the enemy base at the start", () => {
    const game = newGame();
    for (let i = 0; i < 10; i++) game.tick();
    const enemy = game.world.structures.find((s) => s.side === "allied" && s.kind === "conyard_a")!;
    const centre = game.world.structureCenter(enemy);
    expect(isExplored(game.world, centre.x, centre.y)).toBe(false);
  });

  it("remembers ground a scout has walked over", () => {
    const game = newGame();
    const world = game.world;
    const scout = world.units.find((u) => u.side === "soviet" && u.kind === "e1")!;
    const target = { tx: 30, ty: 60 };

    game.dispatch({
      type: "order",
      ids: [scout.id],
      order: { type: "move", x: tileToWorldX(target.tx), y: tileToWorldY(target.ty) },
      queue: false,
    });
    for (let i = 0; i < TICKS_PER_SECOND * 90; i++) {
      game.tick();
      if (isVisible(world, tileToWorldX(target.tx), tileToWorldY(target.ty))) break;
    }
    expect(isVisible(world, tileToWorldX(target.tx), tileToWorldY(target.ty))).toBe(true);

    // Walk back home; the tile should downgrade to remembered, not to unexplored.
    game.dispatch({
      type: "order",
      ids: [scout.id],
      order: { type: "move", x: scout.x, y: scout.y + 24 * 8 },
      queue: false,
    });
    for (let i = 0; i < TICKS_PER_SECOND * 90; i++) game.tick();

    const state = world.visibility[world.grid.index(target.tx, target.ty)];
    expect(state === Visibility.Fogged || state === Visibility.Visible).toBe(true);
  });

  it("reveal radius matches the unit's sight stat", () => {
    const game = newGame();
    const world = game.world;
    // Isolate a scout out in unexplored territory.
    for (const u of world.units) u.dead = true;
    for (const s of world.structures) s.dead = true;
    game.tick();
    world.visibility.fill(Visibility.Unexplored);

    const scout = world.spawnUnit("e1", "soviet", tileToWorldX(40), tileToWorldY(60));
    const sight = unitDef("e1").sight;
    for (let i = 0; i < 10; i++) game.tick();

    expect(isVisible(world, tileToWorldX(40), tileToWorldY(60))).toBe(true);
    expect(isVisible(world, tileToWorldX(40 + sight - 1), tileToWorldY(60))).toBe(true);
    expect(isVisible(world, tileToWorldX(40 + sight + 3), tileToWorldY(60))).toBe(false);
    expect(scout.dead).toBe(false);
  });

  it("revealAll lifts the fog everywhere", () => {
    const game = newGame();
    for (let i = 0; i < 10; i++) game.tick();
    revealAll(game.world);
    const vis = game.world.visibility;
    for (let i = 0; i < vis.length; i++) expect(vis[i]).toBe(Visibility.Visible);
  });
});

describe("score", () => {
  const stats = {
    unitsBuilt: 20,
    unitsLost: 3,
    structuresBuilt: 8,
    structuresLost: 1,
    enemiesDestroyed: 25,
    oreHarvested: 9000,
  };

  it("rewards a fast, clean victory over a slow one", () => {
    const fast = computeScore(stats, TICKS_PER_SECOND * 60 * 10, true);
    const slow = computeScore(stats, TICKS_PER_SECOND * 60 * 35, true);
    expect(fast).toBeGreaterThan(slow);
  });

  it("gives no speed bonus for a defeat", () => {
    const win = computeScore(stats, TICKS_PER_SECOND * 60 * 10, true);
    const loss = computeScore(stats, TICKS_PER_SECOND * 60 * 10, false);
    expect(win).toBeGreaterThan(loss);
  });

  it("never goes negative", () => {
    const disaster = {
      unitsBuilt: 0,
      unitsLost: 40,
      structuresBuilt: 0,
      structuresLost: 20,
      enemiesDestroyed: 0,
      oreHarvested: 0,
    };
    expect(computeScore(disaster, TICKS_PER_SECOND * 60 * 30, false)).toBe(0);
  });
});
