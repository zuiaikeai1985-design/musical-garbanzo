import { describe, expect, it } from "vitest";
import { Game } from "../../src/engine/game";
import { m01IronCurtain } from "../../src/maps/m01-iron-curtain";
import { TICKS_PER_SECOND } from "../../src/engine/constants";
import { GameStatus } from "../../src/engine/types";
import { assertWorldSane } from "./helpers";

describe("headless simulation", () => {
  it("builds mission 01 with two viable bases", () => {
    const game = new Game(m01IronCurtain, "normal");
    const world = game.world;

    expect(world.grid.width).toBe(72);
    expect(world.grid.height).toBe(72);

    const soviet = world.structures.filter((s) => s.side === "soviet");
    const allied = world.structures.filter((s) => s.side === "allied");
    expect(soviet.length).toBeGreaterThanOrEqual(4);
    expect(allied.length).toBeGreaterThanOrEqual(4);

    expect(world.hasOperational("soviet", "conyard")).toBe(true);
    expect(world.hasOperational("soviet", "refinery")).toBe(true);
    expect(world.hasOperational("allied", "conyard_a")).toBe(true);

    // Each side gets a harvester with its refinery.
    expect(world.units.filter((u) => u.kind === "harv").length).toBe(1);
    expect(world.units.filter((u) => u.kind === "harva").length).toBe(1);

    // Both bases must have power to spare at the start.
    expect(world.players.soviet.powerProduced).toBeGreaterThan(
      world.players.soviet.powerConsumed,
    );
    expect(world.players.allied.powerProduced).toBeGreaterThan(
      world.players.allied.powerConsumed,
    );
  });

  it("has a meaningful amount of harvestable ore", () => {
    const game = new Game(m01IronCurtain, "normal");
    const grid = game.world.grid;
    let oreTiles = 0;
    let total = 0;
    for (let i = 0; i < grid.size; i++) {
      if (grid.ore[i] > 0) {
        oreTiles++;
        total += grid.ore[i];
      }
    }
    // A full match needs enough ore for both sides to rebuild several times over.
    expect(oreTiles).toBeGreaterThan(500);
    expect(total).toBeGreaterThan(4000);
  });

  it("never places ore or a base on impassable terrain", () => {
    const game = new Game(m01IronCurtain, "normal");
    const grid = game.world.grid;
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) {
        if (grid.getOre(tx, ty) > 0) {
          expect(grid.terrainPassable(tx, ty), `ore on impassable tile ${tx},${ty}`).toBe(true);
        }
      }
    }
    for (const s of game.world.structures) {
      expect(grid.structureIdAt(s.tx, s.ty)).toBe(s.id);
    }
  });

  it("runs 10 in-game minutes without exceptions or NaN", () => {
    const game = new Game(m01IronCurtain, "normal");
    const ticks = TICKS_PER_SECOND * 60 * 10;
    for (let i = 0; i < ticks; i++) {
      game.tick();
      if (i % 900 === 0) assertWorldSane(game.world, `tick ${i}`);
    }
    assertWorldSane(game.world, "final");
    // The AI can legitimately finish off an idle player before the ten minutes are up, in which
    // case the clock stops — but it must be because the match ended, not because it wedged.
    if (game.world.tick < ticks) {
      expect(game.status).not.toBe(GameStatus.Playing);
    }
    expect(game.world.tick).toBeGreaterThan(TICKS_PER_SECOND * 60 * 3);
  });

  it("is deterministic: the same seed produces the same match", () => {
    const run = () => {
      const game = new Game(m01IronCurtain, "normal", 12345);
      for (let i = 0; i < 600; i++) game.tick();
      return game.world.units.map((u) => `${u.kind}:${u.x.toFixed(4)}:${u.y.toFixed(4)}`).join("|");
    };
    expect(run()).toBe(run());
  });

  it("moves an ordered unit across the map", () => {
    const game = new Game(m01IronCurtain, "normal");
    const world = game.world;
    const unit = world.units.find((u) => u.kind === "e1" && u.side === "soviet");
    expect(unit).toBeDefined();

    const startX = unit!.x;
    const startY = unit!.y;
    const targetX = startX + 24 * 10;
    const targetY = startY - 24 * 6;

    game.dispatch({
      type: "order",
      ids: [unit!.id],
      order: { type: "move", x: targetX, y: targetY },
      queue: false,
    });

    for (let i = 0; i < TICKS_PER_SECOND * 60; i++) {
      game.tick();
      if (Math.hypot(unit!.x - targetX, unit!.y - targetY) < 24) break;
    }

    const travelled = Math.hypot(unit!.x - startX, unit!.y - startY);
    expect(travelled, "unit should have travelled toward its destination").toBeGreaterThan(120);
    expect(Math.hypot(unit!.x - targetX, unit!.y - targetY)).toBeLessThan(40);
  });

  it("keeps a large group of units from stacking on one another", () => {
    const game = new Game(m01IronCurtain, "normal");
    const world = game.world;
    const ids: number[] = [];
    for (let i = 0; i < 12; i++) {
      const u = world.spawnUnit("3tnk", "soviet", 24 * 20 + i * 6, 24 * 62, 0);
      ids.push(u.id);
    }
    game.dispatch({
      type: "order",
      ids,
      order: { type: "move", x: 24 * 26, y: 24 * 62 },
      queue: false,
    });

    for (let i = 0; i < TICKS_PER_SECOND * 40; i++) game.tick();

    const tanks = ids.map((id) => world.unit(id)).filter((u) => u !== undefined);
    expect(tanks.length).toBe(12);
    for (let a = 0; a < tanks.length; a++) {
      for (let b = a + 1; b < tanks.length; b++) {
        const d = Math.hypot(tanks[a]!.x - tanks[b]!.x, tanks[a]!.y - tanks[b]!.y);
        expect(d, "tanks must not occupy the same spot").toBeGreaterThan(6);
      }
    }
  });
});
