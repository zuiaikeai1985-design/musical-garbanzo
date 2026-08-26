import { describe, expect, it } from "vitest";
import { Game } from "../../src/engine/game";
import { m01IronCurtain } from "../../src/maps/m01-iron-curtain";
import { NUKE_COUNTDOWN_TICKS } from "../../src/engine/constants";
import { structureDef } from "../../src/engine/rules";
import { launchNuke } from "../../src/engine/systems/superweapon";
import { OreKind, TerrainKind } from "../../src/engine/types";
import { tileToWorldX, tileToWorldY } from "../../src/engine/util/vec";

/**
 * Flat ground so structures can be placed, plus one surviving unit per side.
 *
 * Without the keep-alive units the victory system declares a winner on tick 30 and the whole
 * simulation freezes, which silently invalidates any long-running test.
 */
function arena() {
  const game = new Game(m01IronCurtain, "normal");
  const world = game.world;
  for (const u of world.units) u.dead = true;
  for (const s of world.structures) s.dead = true;
  for (let ty = 18; ty <= 52; ty++) {
    for (let tx = 18; tx <= 52; tx++) {
      world.grid.setTerrain(tx, ty, TerrainKind.Grass);
      world.grid.setOre(tx, ty, OreKind.None, 0);
    }
  }
  world.spawnUnit("e1", "soviet", tileToWorldX(19), tileToWorldY(19));
  world.spawnUnit("e1a", "allied", tileToWorldX(19), tileToWorldY(51));
  game.tick();
  return game;
}

/** A silo plus enough generation to keep it running. */
function buildSilo(game: Game, tx = 24, ty = 24, powered = true) {
  if (powered) {
    game.world.spawnStructure("power", "soviet", tx + 3, ty, true);
    game.world.spawnStructure("power", "soviet", tx + 3, ty + 3, true);
  }
  return game.world.spawnStructure("nukesilo", "soviet", tx, ty, true)!;
}

describe("missile silo", () => {
  it("charges over time and announces when it is ready", () => {
    const game = arena();
    const silo = buildSilo(game);
    const total = structureDef("nukesilo").superweaponCharge;
    expect(total).toBeGreaterThan(0);

    for (let i = 0; i < total + 10; i++) game.tick();

    expect(silo.charge).toBeGreaterThanOrEqual(total);
    expect(game.world.nukeReadySilo).toBe(silo.id);
    expect(game.world.evaLog.some((e) => e.key === "nuclearWeaponAvailable")).toBe(true);
  });

  it("does not charge while unpowered", () => {
    const game = arena();
    // No power plants at all, so the grid cannot run a 150-power silo.
    const silo = buildSilo(game, 24, 24, false);
    for (let i = 0; i < 600; i++) game.tick();
    expect(silo.online).toBe(false);
    expect(silo.charge).toBe(0);
  });

  it("refuses to launch before it is charged", () => {
    const game = arena();
    const silo = buildSilo(game);
    expect(launchNuke(game.world, silo.id, tileToWorldX(40), tileToWorldY(40))).toBe(false);
    expect(game.world.pendingNuke).toBeNull();
  });

  it("launches, counts down and flattens the target area", () => {
    const game = arena();
    const world = game.world;
    const silo = buildSilo(game);
    silo.charge = structureDef("nukesilo").superweaponCharge;

    // A cluster of enemy buildings and units at the aim point.
    const targetTx = 40;
    const targetTy = 40;
    const victimStructure = world.spawnStructure("barracks_a", "allied", targetTx, targetTy, true)!;
    const victims = [0, 1, 2].map((i) =>
      world.spawnUnit("2tnk", "allied", tileToWorldX(targetTx + i), tileToWorldY(targetTy + 2)),
    );
    // A unit well outside the blast radius must survive.
    const survivor = world.spawnUnit("2tnk", "allied", tileToWorldX(22), tileToWorldY(48));

    const aimX = tileToWorldX(targetTx);
    const aimY = tileToWorldY(targetTy);
    expect(launchNuke(world, silo.id, aimX, aimY)).toBe(true);
    expect(world.pendingNuke).not.toBeNull();
    expect(silo.charge).toBe(0);
    expect(world.evaLog.some((e) => e.key === "nuclearWeaponLaunched")).toBe(true);

    // Nothing happens until the countdown expires.
    for (let i = 0; i < NUKE_COUNTDOWN_TICKS - 5; i++) game.tick();
    expect(victimStructure.dead).toBe(false);
    expect(world.pendingNuke).not.toBeNull();

    for (let i = 0; i < 20; i++) game.tick();

    expect(world.pendingNuke).toBeNull();
    expect(victimStructure.dead).toBe(true);
    expect(victims.every((v) => v.dead)).toBe(true);
    expect(survivor.dead, "targets outside the blast radius should survive").toBe(false);
    expect(world.effects.some((e) => e.kind === "nuke")).toBe(true);
    expect(world.effects.some((e) => e.kind === "shockwave")).toBe(true);
  });

  it("allows only one warhead in the air at a time", () => {
    const game = arena();
    const world = game.world;
    const a = buildSilo(game, 24, 24);
    const b = buildSilo(game, 34, 24);
    a.charge = structureDef("nukesilo").superweaponCharge;
    b.charge = structureDef("nukesilo").superweaponCharge;

    expect(launchNuke(world, a.id, tileToWorldX(40), tileToWorldY(40))).toBe(true);
    expect(launchNuke(world, b.id, tileToWorldX(44), tileToWorldY(44))).toBe(false);
    expect(b.charge).toBe(structureDef("nukesilo").superweaponCharge);
  });

  it("clears the ready flag when the silo is destroyed", () => {
    const game = arena();
    const silo = buildSilo(game);
    silo.charge = structureDef("nukesilo").superweaponCharge;
    game.tick();
    expect(game.world.nukeReadySilo).toBe(silo.id);

    silo.dead = true;
    game.tick();
    game.tick();
    expect(game.world.nukeReadySilo).toBe(0);
  });
});
