import { describe, expect, it } from "vitest";
import { Game } from "../../src/engine/game";
import { m01IronCurtain } from "../../src/maps/m01-iron-curtain";
import { STRUCTURES, UNITS, structureDef, unitDef } from "../../src/engine/rules";
import { buildOptions, canBuildStructure, canBuildUnit } from "../../src/engine/queries";
import { QueueKind, QueueStatus, type StructureKindId } from "../../src/engine/types";
import { WEAPONS } from "../../src/engine/rules";

/**
 * Credits are deliberately set below storage capacity: `addCredits` caps at capacity, so a test
 * that starts at the cap would silently lose refunds and make the assertions meaningless.
 */
function newGame() {
  const game = new Game(m01IronCurtain, "normal");
  game.world.players.soviet.credits = Math.floor(game.world.storageCapacity("soviet") * 0.7);
  return game;
}

/** Runs the sim until `predicate` holds, or fails after `limit` ticks. */
function runUntil(game: Game, predicate: () => boolean, limit = 3000): boolean {
  for (let i = 0; i < limit; i++) {
    game.tick();
    if (predicate()) return true;
  }
  return false;
}

describe("rules data integrity", () => {
  it("every unit weapon exists", () => {
    for (const def of Object.values(UNITS)) {
      if (def.weapon) expect(WEAPONS[def.weapon], `${def.id} weapon`).toBeDefined();
      if (def.weapon2) expect(WEAPONS[def.weapon2], `${def.id} weapon2`).toBeDefined();
    }
  });

  it("every structure weapon exists", () => {
    for (const def of Object.values(STRUCTURES)) {
      if (def.weapon) expect(WEAPONS[def.weapon], `${def.id} weapon`).toBeDefined();
    }
  });

  it("every prerequisite refers to a real structure", () => {
    for (const def of Object.values(UNITS)) {
      for (const req of def.requires) expect(STRUCTURES[req], `${def.id} requires ${req}`).toBeDefined();
      if (def.producedBy) expect(STRUCTURES[def.producedBy]).toBeDefined();
    }
    for (const def of Object.values(STRUCTURES)) {
      for (const req of def.requires) expect(STRUCTURES[req], `${def.id} requires ${req}`).toBeDefined();
    }
  });

  it("has no cyclic or self-referential prerequisites", () => {
    const resolve = (id: StructureKindId, seen: Set<string>): void => {
      expect(seen.has(id), `cycle through ${id}`).toBe(false);
      seen.add(id);
      for (const req of structureDef(id).requires) resolve(req, new Set(seen));
    };
    for (const def of Object.values(STRUCTURES)) resolve(def.id, new Set());
  });

  it("gives every buildable a positive cost and build time", () => {
    for (const def of [...Object.values(UNITS), ...Object.values(STRUCTURES)]) {
      expect(def.cost, `${def.id} cost`).toBeGreaterThan(0);
      expect(def.buildTime, `${def.id} build time`).toBeGreaterThan(0);
    }
  });
});

describe("tech tree", () => {
  it("locks the refinery behind a power plant and the war factory behind a refinery", () => {
    const game = newGame();
    const world = game.world;

    // Mission 01 starts with a conyard, two plants and a refinery.
    expect(canBuildStructure(world, "soviet", "power")).toBe(true);
    expect(canBuildStructure(world, "soviet", "warfactory")).toBe(true);
    expect(canBuildStructure(world, "soviet", "tesla")).toBe(false); // needs a radar dome

    for (const s of world.structures) {
      if (s.side === "soviet" && s.kind === "refinery") s.dead = true;
    }
    game.tick();
    expect(canBuildStructure(world, "soviet", "warfactory")).toBe(false);
  });

  it("locks units behind their production structure", () => {
    const game = newGame();
    const world = game.world;
    expect(canBuildUnit(world, "soviet", "e1")).toBe(false);

    const conyard = world.structures.find((s) => s.kind === "conyard")!;
    world.spawnStructure("barracks", "soviet", conyard.tx + 9, conyard.ty, true);
    game.tick();
    expect(canBuildUnit(world, "soviet", "e1")).toBe(true);
    expect(canBuildUnit(world, "soviet", "dog")).toBe(false); // needs the kennel
  });

  it("reports locked options rather than hiding them", () => {
    const world = newGame().world;
    const options = buildOptions(world, "soviet");
    const tesla = options.find((o) => o.id === "tesla")!;
    expect(tesla).toBeDefined();
    expect(tesla.unlocked).toBe(false);
    const power = options.find((o) => o.id === "power")!;
    expect(power.unlocked).toBe(true);
    expect(power.affordable).toBe(true);
  });

  it("marks options unaffordable when the treasury is empty", () => {
    const game = newGame();
    game.world.players.soviet.credits = 10;
    const options = buildOptions(game.world, "soviet");
    expect(options.find((o) => o.id === "power")!.affordable).toBe(false);
  });
});

describe("production queue", () => {
  it("charges as it builds and completes a structure into the ready state", () => {
    const game = newGame();
    const world = game.world;
    const before = world.players.soviet.credits;

    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Structure, what: "power" });
    game.tick();
    expect(world.players.soviet.queues[QueueKind.Structure].items).toHaveLength(1);

    // Partway through, only part of the cost has been taken.
    for (let i = 0; i < Math.floor(structureDef("power").buildTime / 2); i++) game.tick();
    const spentHalfway = before - world.players.soviet.credits;
    expect(spentHalfway).toBeGreaterThan(0);
    expect(spentHalfway).toBeLessThan(structureDef("power").cost);

    const done = runUntil(
      game,
      () => world.players.soviet.queues[QueueKind.Structure].status === QueueStatus.Ready,
    );
    expect(done).toBe(true);
    expect(before - world.players.soviet.credits).toBeCloseTo(structureDef("power").cost, 0);
  });

  it("refunds exactly what was paid when a part-built item is cancelled", () => {
    const game = newGame();
    const world = game.world;
    const before = world.players.soviet.credits;

    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Structure, what: "power" });
    for (let i = 0; i < 30; i++) game.tick();
    expect(world.players.soviet.credits).toBeLessThan(before);

    game.dispatch({
      type: "queueCancel",
      side: "soviet",
      queue: QueueKind.Structure,
      what: "power",
    });
    game.tick();

    expect(world.players.soviet.credits).toBeCloseTo(before, 4);
    expect(world.players.soviet.queues[QueueKind.Structure].items).toHaveLength(0);
  });

  it("refuses to queue something the tech tree does not allow", () => {
    const game = newGame();
    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Structure, what: "tesla" });
    game.tick();
    expect(game.world.players.soviet.queues[QueueKind.Structure].items).toHaveLength(0);
  });

  it("stalls instead of going into debt when the treasury runs dry", () => {
    const game = newGame();
    const world = game.world;
    world.players.soviet.credits = 40;

    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Structure, what: "power" });
    for (let i = 0; i < 400; i++) game.tick();

    const item = world.players.soviet.queues[QueueKind.Structure].items[0];
    expect(item).toBeDefined();
    expect(world.players.soviet.credits).toBeGreaterThanOrEqual(0);
    expect(item.progress).toBeLessThan(structureDef("power").buildTime);
  });

  it("holds and resumes a queue", () => {
    const game = newGame();
    const world = game.world;
    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Structure, what: "power" });
    for (let i = 0; i < 20; i++) game.tick();
    game.dispatch({ type: "queueToggleHold", side: "soviet", queue: QueueKind.Structure });
    game.tick();

    const frozen = world.players.soviet.queues[QueueKind.Structure].items[0].progress;
    for (let i = 0; i < 60; i++) game.tick();
    expect(world.players.soviet.queues[QueueKind.Structure].items[0].progress).toBe(frozen);

    game.dispatch({ type: "queueToggleHold", side: "soviet", queue: QueueKind.Structure });
    for (let i = 0; i < 30; i++) game.tick();
    expect(world.players.soviet.queues[QueueKind.Structure].items[0].progress).toBeGreaterThan(
      frozen,
    );
  });

  it("builds slower during a brownout", () => {
    const measure = (killPower: boolean) => {
      const game = newGame();
      const world = game.world;
      if (killPower) {
        for (const s of world.structures) {
          if (s.side === "soviet" && s.kind === "power") s.dead = true;
        }
      }
      game.dispatch({
        type: "queueAdd",
        side: "soviet",
        queue: QueueKind.Structure,
        what: "silo",
      });
      for (let i = 0; i < 60; i++) game.tick();
      return world.players.soviet.queues[QueueKind.Structure].items[0]?.progress ?? Infinity;
    };
    expect(measure(true)).toBeLessThan(measure(false));
  });
});

describe("placement", () => {
  it("places a finished structure and consumes the queue slot", () => {
    const game = newGame();
    const world = game.world;
    const conyard = world.structures.find((s) => s.kind === "conyard")!;

    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Structure, what: "power" });
    runUntil(game, () => world.players.soviet.queues[QueueKind.Structure].status === QueueStatus.Ready);

    const tx = conyard.tx;
    const ty = conyard.ty + 8;
    const before = world.structures.filter((s) => s.kind === "power").length;
    game.dispatch({ type: "placeStructure", side: "soviet", what: "power", tx, ty });
    game.tick();

    expect(world.structures.filter((s) => s.kind === "power" && !s.dead).length).toBe(before + 1);
    expect(world.players.soviet.queues[QueueKind.Structure].items).toHaveLength(0);
    // Newly placed structures animate up from the ground.
    const placed = world.structures.find((s) => s.tx === tx && s.ty === ty)!;
    expect(placed.buildProgress).toBeGreaterThan(0);
    expect(placed.buildProgress).toBeLessThan(1);
    runUntil(game, () => placed.buildProgress >= 1, 120);
    expect(placed.buildProgress).toBe(1);
  });

  it("rejects placement outside the build radius", () => {
    const game = newGame();
    const world = game.world;
    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Structure, what: "power" });
    runUntil(game, () => world.players.soviet.queues[QueueKind.Structure].status === QueueStatus.Ready);

    const before = world.structures.length;
    game.dispatch({ type: "placeStructure", side: "soviet", what: "power", tx: 40, ty: 20 });
    game.tick();
    expect(world.structures.length).toBe(before);
    // The item is still waiting to be placed somewhere legal.
    expect(world.players.soviet.queues[QueueKind.Structure].status).toBe(QueueStatus.Ready);
  });

  it("rejects placement on top of another structure", () => {
    const game = newGame();
    const world = game.world;
    const conyard = world.structures.find((s) => s.kind === "conyard")!;
    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Structure, what: "power" });
    runUntil(game, () => world.players.soviet.queues[QueueKind.Structure].status === QueueStatus.Ready);

    const before = world.structures.length;
    game.dispatch({
      type: "placeStructure",
      side: "soviet",
      what: "power",
      tx: conyard.tx,
      ty: conyard.ty,
    });
    game.tick();
    expect(world.structures.length).toBe(before);
  });

  it("delivers a free harvester with every new refinery", () => {
    const game = newGame();
    const world = game.world;
    const conyard = world.structures.find((s) => s.kind === "conyard")!;
    const before = world.units.filter((u) => u.kind === "harv").length;

    game.dispatch({
      type: "queueAdd",
      side: "soviet",
      queue: QueueKind.Structure,
      what: "refinery",
    });
    runUntil(
      game,
      () => world.players.soviet.queues[QueueKind.Structure].status === QueueStatus.Ready,
      4000,
    );
    game.dispatch({
      type: "placeStructure",
      side: "soviet",
      what: "refinery",
      tx: conyard.tx + 6,
      ty: conyard.ty + 8,
    });
    game.tick();

    expect(world.units.filter((u) => u.kind === "harv").length).toBe(before + 1);
  });
});

describe("unit production", () => {
  it("builds infantry from a barracks and sends them to the rally point", () => {
    const game = newGame();
    const world = game.world;
    const conyard = world.structures.find((s) => s.kind === "conyard")!;
    const barracks = world.spawnStructure("barracks", "soviet", conyard.tx + 9, conyard.ty, true)!;
    game.tick();

    const before = world.units.filter((u) => u.kind === "e1").length;
    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Infantry, what: "e1" });

    const built = runUntil(
      game,
      () => world.units.filter((u) => u.kind === "e1").length > before,
      unitDef("e1").buildTime + 200,
    );
    expect(built).toBe(true);
    expect(world.players.soviet.queues[QueueKind.Infantry].items).toHaveLength(0);
    expect(world.players.soviet.stats.unitsBuilt).toBeGreaterThan(0);

    const fresh = world.units.filter((u) => u.kind === "e1").at(-1)!;
    expect(Math.hypot(fresh.x - barracks.rallyX, fresh.y - barracks.rallyY)).toBeLessThan(400);
  });

  it("refunds and drops the item when the only factory is destroyed mid-build", () => {
    const game = newGame();
    const world = game.world;
    const conyard = world.structures.find((s) => s.kind === "conyard")!;
    const barracks = world.spawnStructure("barracks", "soviet", conyard.tx + 9, conyard.ty, true)!;
    game.tick();

    game.dispatch({ type: "queueAdd", side: "soviet", queue: QueueKind.Infantry, what: "e1" });
    for (let i = 0; i < 15; i++) game.tick();
    const midway = world.players.soviet.credits;

    barracks.dead = true;
    game.tick();
    game.tick();

    expect(world.players.soviet.queues[QueueKind.Infantry].items).toHaveLength(0);
    expect(world.players.soviet.credits).toBeGreaterThan(midway);
  });
});

describe("selling and repairing", () => {
  it("sells a structure for half its cost and frees the tiles", () => {
    const game = newGame();
    const world = game.world;
    const plant = world.structures.find((s) => s.side === "soviet" && s.kind === "power")!;
    const before = world.players.soviet.credits;

    game.dispatch({ type: "sellStructure", id: plant.id });
    game.tick();

    expect(world.structure(plant.id)).toBeUndefined();
    expect(world.players.soviet.credits - before).toBe(Math.floor(structureDef("power").cost * 0.5));
    expect(world.grid.structureIdAt(plant.tx, plant.ty)).toBe(0);
  });

  it("refuses to sell the last Construction Yard", () => {
    const game = newGame();
    const world = game.world;
    const conyard = world.structures.find((s) => s.side === "soviet" && s.kind === "conyard")!;
    game.dispatch({ type: "sellStructure", id: conyard.id });
    game.tick();
    expect(world.structure(conyard.id)).toBeDefined();
  });

  it("repairs a damaged structure for credits", () => {
    const game = newGame();
    const world = game.world;
    const plant = world.structures.find((s) => s.side === "soviet" && s.kind === "power")!;
    plant.hp = structureDef("power").hp * 0.3;
    const creditsBefore = world.players.soviet.credits;

    game.dispatch({ type: "toggleRepair", id: plant.id });
    for (let i = 0; i < 400; i++) game.tick();

    expect(plant.hp).toBeGreaterThan(structureDef("power").hp * 0.3);
    expect(world.players.soviet.credits).toBeLessThan(creditsBefore);
  });

  it("stops repairing once the structure is whole again", () => {
    const game = newGame();
    const world = game.world;
    const plant = world.structures.find((s) => s.side === "soviet" && s.kind === "power")!;
    plant.hp = structureDef("power").hp - 1;
    game.dispatch({ type: "toggleRepair", id: plant.id });
    for (let i = 0; i < 200; i++) game.tick();
    expect(plant.hp).toBe(structureDef("power").hp);
    expect(plant.repairing).toBe(false);
  });
});
