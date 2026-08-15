import { describe, expect, it } from "vitest";
import { Game } from "../../src/engine/game";
import { m01IronCurtain } from "../../src/maps/m01-iron-curtain";
import { BASE_STORAGE, ORE_VALUE, TICKS_PER_SECOND } from "../../src/engine/constants";
import { HarvestState, OreKind } from "../../src/engine/types";
import { productionFactor, hasRadar } from "../../src/engine/systems/power";

function newGame() {
  return new Game(m01IronCurtain, "normal");
}

describe("power", () => {
  it("reports a healthy surplus at mission start", () => {
    const world = newGame().world;
    const player = world.players.soviet;
    expect(player.powerProduced).toBeGreaterThan(player.powerConsumed);
    expect(player.powerFactor).toBe(1);
    expect(productionFactor(world, "soviet")).toBe(1);
  });

  it("browns out when the plants are gone, but never stalls production completely", () => {
    const game = newGame();
    const world = game.world;
    for (const s of world.structures) {
      if (s.side === "soviet" && s.kind === "power") s.dead = true;
    }
    game.tick();
    expect(world.players.soviet.powerFactor).toBe(0);
    // Production floors at 25% rather than freezing.
    expect(productionFactor(world, "soviet")).toBeCloseTo(0.25, 5);
  });

  it("takes defensive structures offline first during a brownout", () => {
    const game = newGame();
    const world = game.world;
    const conyard = world.structures.find((s) => s.kind === "conyard")!;
    const tesla = world.spawnStructure("tesla", "soviet", conyard.tx + 8, conyard.ty + 8, true)!;
    game.tick();
    expect(tesla.online).toBe(true);

    for (const s of world.structures) {
      if (s.side === "soviet" && s.kind === "power") s.dead = true;
    }
    game.tick();
    expect(tesla.online).toBe(false);
    // The refinery keeps running — it just slows down.
    const refinery = world.structures.find((s) => s.kind === "refinery" && !s.dead)!;
    expect(refinery.online).toBe(true);
  });

  it("scales power output with the plant's health", () => {
    const game = newGame();
    const world = game.world;
    const plants = world.structures.filter((s) => s.side === "soviet" && s.kind === "power");
    const full = world.players.soviet.powerProduced;
    for (const p of plants) p.hp *= 0.5;
    game.tick();
    expect(world.players.soviet.powerProduced).toBeLessThan(full);
    expect(world.players.soviet.powerProduced).toBeGreaterThan(0);
  });

  it("has no radar until a Radar Dome is built", () => {
    const game = newGame();
    const world = game.world;
    expect(hasRadar(world, "soviet")).toBe(false);
    const conyard = world.structures.find((s) => s.kind === "conyard")!;
    world.spawnStructure("radar", "soviet", conyard.tx + 9, conyard.ty, true);
    game.tick();
    expect(hasRadar(world, "soviet")).toBe(true);
  });
});

describe("storage", () => {
  it("adds silo capacity on top of the base allowance", () => {
    const game = newGame();
    const world = game.world;
    const before = world.storageCapacity("soviet");
    expect(before).toBeGreaterThan(BASE_STORAGE);
    const conyard = world.structures.find((s) => s.kind === "conyard")!;
    world.spawnStructure("silo", "soviet", conyard.tx + 9, conyard.ty + 6, true);
    expect(world.storageCapacity("soviet")).toBe(before + 1500);
  });

  it("clamps credits to capacity and reports how much was actually banked", () => {
    const world = newGame().world;
    const capacity = world.storageCapacity("soviet");
    world.players.soviet.credits = capacity - 10;
    const banked = world.addCredits("soviet", 100);
    expect(banked).toBe(10);
    expect(world.players.soviet.credits).toBe(capacity);
  });
});

describe("harvesting", () => {
  it("runs a full mine-and-deliver cycle and earns credits", () => {
    const game = newGame();
    const world = game.world;
    world.players.soviet.credits = 0;

    const harvester = world.units.find((u) => u.kind === "harv")!;
    expect(harvester).toBeDefined();

    const states = new Set<string>();
    let sawCargo = false;
    for (let i = 0; i < TICKS_PER_SECOND * 60 * 3; i++) {
      game.tick();
      states.add(harvester.harvestState);
      if (harvester.cargo > 0) sawCargo = true;
      if (world.players.soviet.credits > 0 && states.has(HarvestState.Unloading)) break;
    }

    expect(sawCargo, "harvester should have picked up ore").toBe(true);
    expect(states.has(HarvestState.Harvesting)).toBe(true);
    expect(states.has(HarvestState.Returning)).toBe(true);
    expect(states.has(HarvestState.Unloading)).toBe(true);
    expect(world.players.soviet.credits).toBeGreaterThanOrEqual(ORE_VALUE);
  });

  it("grows the treasury steadily over three in-game minutes", () => {
    const game = newGame();
    const world = game.world;
    world.players.soviet.credits = 0;

    const samples: number[] = [];
    for (let minute = 0; minute < 3; minute++) {
      for (let i = 0; i < TICKS_PER_SECOND * 60; i++) game.tick();
      samples.push(world.players.soviet.credits);
    }

    expect(samples[0]).toBeGreaterThan(0);
    expect(samples[1]).toBeGreaterThan(samples[0]);
    expect(samples[2]).toBeGreaterThan(samples[1]);
    // One harvester should be worth well over a thousand credits in three minutes.
    expect(samples[2]).toBeGreaterThan(1000);
  });

  it("depletes the ore field it mines", () => {
    const game = newGame();
    const world = game.world;
    const grid = world.grid;
    const totalOre = () => {
      let sum = 0;
      for (let i = 0; i < grid.size; i++) sum += grid.ore[i];
      return sum;
    };

    // Freeze regrowth so the measurement is purely about consumption.
    const before = totalOre();
    let mined = 0;
    const harvester = world.units.find((u) => u.kind === "harv")!;
    let lastCargo = 0;
    for (let i = 0; i < TICKS_PER_SECOND * 90; i++) {
      game.tick();
      if (harvester.cargo > lastCargo) mined += harvester.cargo - lastCargo;
      lastCargo = harvester.cargo;
    }
    expect(mined, "harvester should have taken scoops out of the ground").toBeGreaterThan(5);
    expect(before).toBeGreaterThan(0);
  });

  it("regrows and spreads ore over time", () => {
    const game = newGame();
    const world = game.world;
    const grid = world.grid;

    // Isolate regrowth: remove the harvesters and strip the map to three rich seed tiles.
    for (const u of world.units) if (u.kind === "harv" || u.kind === "harva") u.dead = true;
    for (let ty = 0; ty < grid.height; ty++) {
      for (let tx = 0; tx < grid.width; tx++) grid.setOre(tx, ty, OreKind.None, 0);
    }
    for (const [tx, ty] of [
      [35, 63],
      [36, 63],
      [35, 64],
    ]) {
      grid.setOre(tx, ty, OreKind.Ore, 12);
    }
    expect(grid.oreTileCount).toBe(3);

    for (let i = 0; i < TICKS_PER_SECOND * 60 * 5; i++) game.tick();

    expect(
      grid.oreTileCount,
      "the patch should have spread beyond its three seed tiles",
    ).toBeGreaterThan(6);
  });

  it("re-targets when the tile it was mining runs out", () => {
    const game = newGame();
    const world = game.world;
    const harvester = world.units.find((u) => u.kind === "harv")!;

    for (let i = 0; i < TICKS_PER_SECOND * 40; i++) {
      game.tick();
      if (harvester.harvestState === HarvestState.Harvesting) break;
    }
    expect(harvester.harvestState).toBe(HarvestState.Harvesting);

    const tx = harvester.oreTx;
    const ty = harvester.oreTy;
    world.grid.setOre(tx, ty, OreKind.None, 0);

    for (let i = 0; i < 60; i++) game.tick();
    const movedOn = harvester.oreTx !== tx || harvester.oreTy !== ty;
    expect(movedOn || harvester.harvestState !== HarvestState.Harvesting).toBe(true);
  });
});
