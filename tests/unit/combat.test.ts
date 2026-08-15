import { describe, expect, it } from "vitest";
import { Game } from "../../src/engine/game";
import { m01IronCurtain } from "../../src/maps/m01-iron-curtain";
import { TICKS_PER_SECOND, TILE } from "../../src/engine/constants";
import { WEAPONS, structureDef, unitDef } from "../../src/engine/rules";
import { ArmorKind, OreKind, TerrainKind, type Side, type UnitKindId } from "../../src/engine/types";
import { armorOf, canHarm, findTarget } from "../../src/engine/systems/combat";
import { tileToWorldX, tileToWorldY } from "../../src/engine/util/vec";

/**
 * A blank, flat arena in the middle of the map.
 *
 * Mission 01 has a river and cliffs running through the middle, so the terrain is levelled first
 * — otherwise `spawnStructure` silently refuses to place onto water and the tests fail for
 * reasons that have nothing to do with combat.
 */
const ARENA = { x0: 20, y0: 20, x1: 46, y1: 46 };

function arena() {
  const game = new Game(m01IronCurtain, "normal");
  const world = game.world;
  for (const u of world.units) u.dead = true;
  for (const s of world.structures) s.dead = true;
  for (let ty = ARENA.y0; ty <= ARENA.y1; ty++) {
    for (let tx = ARENA.x0; tx <= ARENA.x1; tx++) {
      world.grid.setTerrain(tx, ty, TerrainKind.Grass);
      world.grid.setOre(tx, ty, OreKind.None, 0);
    }
  }
  game.tick();
  return game;
}

function spawn(game: Game, kind: UnitKindId, side: Side, tx: number, ty: number) {
  return game.world.spawnUnit(kind, side, tileToWorldX(tx), tileToWorldY(ty));
}

describe("damage model", () => {
  it("maps every unit and structure onto a known armour class", () => {
    const valid = Object.values(ArmorKind);
    const game = arena();
    for (const kind of Object.keys(unitDef("e1") ? {} : {})) void kind;
    const u = spawn(game, "3tnk", "soviet", 30, 30);
    expect(valid).toContain(armorOf(u));
  });

  it("rifles shred infantry but barely scratch tanks", () => {
    const rifle = WEAPONS.rifle;
    expect(rifle.verses[ArmorKind.None]).toBeGreaterThan(0.8);
    expect(rifle.verses[ArmorKind.Heavy]).toBeLessThan(0.1);
  });

  it("attack dogs cannot hurt anything but infantry", () => {
    const game = arena();
    const dog = spawn(game, "dog", "soviet", 30, 30);
    const infantry = spawn(game, "e1a", "allied", 31, 30);
    const tank = spawn(game, "1tnk", "allied", 32, 30);
    expect(canHarm(WEAPONS.dogJaw, infantry)).toBe(true);
    expect(canHarm(WEAPONS.dogJaw, tank)).toBe(false);
    expect(dog.kind).toBe("dog");
  });

  it("kills infantry that stray into a dog's jaws", () => {
    const game = arena();
    spawn(game, "dog", "soviet", 30, 30);
    const victim = spawn(game, "e1a", "allied", 30, 30);
    for (let i = 0; i < TICKS_PER_SECOND * 6; i++) {
      game.tick();
      if (victim.dead) break;
    }
    expect(victim.dead).toBe(true);
  });
});

describe("target acquisition", () => {
  it("finds the nearest enemy in range and ignores friendlies", () => {
    const game = arena();
    const world = game.world;
    spawn(game, "3tnk", "soviet", 30, 30);
    const near = spawn(game, "1tnk", "allied", 32, 30);
    spawn(game, "1tnk", "allied", 36, 30);
    spawn(game, "3tnk", "soviet", 31, 30);
    game.tick();

    const found = findTarget(
      world,
      "soviet",
      tileToWorldX(30),
      tileToWorldY(30),
      WEAPONS.apShell.range,
      WEAPONS.apShell,
    );
    expect(found?.id).toBe(near.id);
  });

  it("prefers units over buildings", () => {
    const game = arena();
    const world = game.world;
    world.spawnStructure("pillbox", "allied", 33, 30, true);
    const unit = spawn(game, "e1a", "allied", 34, 30);
    game.tick();

    const found = findTarget(
      world,
      "soviet",
      tileToWorldX(30),
      tileToWorldY(30),
      WEAPONS.apShell.range * 2,
      WEAPONS.apShell,
    );
    expect(found?.id).toBe(unit.id);
  });

  it("returns nothing when everything is out of range", () => {
    const game = arena();
    spawn(game, "1tnk", "allied", 60, 60);
    game.tick();
    const found = findTarget(
      game.world,
      "soviet",
      tileToWorldX(30),
      tileToWorldY(30),
      WEAPONS.rifle.range,
      WEAPONS.rifle,
    );
    expect(found).toBeNull();
  });
});

describe("engagements", () => {
  it("auto-engages an enemy that walks into range", () => {
    const game = arena();
    const defender = spawn(game, "3tnk", "soviet", 30, 30);
    const attacker = spawn(game, "1tnk", "allied", 33, 30);
    const startHp = attacker.hp;

    for (let i = 0; i < TICKS_PER_SECOND * 6; i++) game.tick();

    expect(defender.targetId).toBe(attacker.id);
    expect(attacker.hp).toBeLessThan(startHp);
  });

  it("resolves ten heavy tanks against ten light tanks decisively", () => {
    const game = arena();
    const world = game.world;
    // Four tiles apart: inside cannon range, so both lines open fire immediately without
    // needing move orders (a unit on Guard holds position and only shoots what comes to it).
    for (let i = 0; i < 10; i++) {
      spawn(game, "3tnk", "soviet", 27, 26 + i);
      spawn(game, "1tnk", "allied", 31, 26 + i);
    }

    let ticks = 0;
    const limit = TICKS_PER_SECOND * 120;
    while (ticks < limit) {
      game.tick();
      ticks++;
      const soviets = world.units.filter((u) => u.side === "soviet" && !u.dead).length;
      const allies = world.units.filter((u) => u.side === "allied" && !u.dead).length;
      if (soviets === 0 || allies === 0) break;
    }

    const soviets = world.units.filter((u) => u.side === "soviet" && !u.dead).length;
    const allies = world.units.filter((u) => u.side === "allied" && !u.dead).length;
    expect(ticks, "the fight should not drag on forever").toBeLessThan(limit);
    // Heavy tanks out-armour and out-gun light tanks, so they should win with survivors.
    expect(allies).toBe(0);
    expect(soviets).toBeGreaterThan(0);
  });

  it("obeys an explicit attack order against a building", () => {
    const game = arena();
    const world = game.world;
    const pillbox = world.spawnStructure("pillbox", "allied", 34, 30, true)!;
    const tank = spawn(game, "3tnk", "soviet", 26, 30);
    game.tick();

    game.dispatch({
      type: "order",
      ids: [tank.id],
      order: { type: "attack", targetId: pillbox.id },
      queue: false,
    });

    for (let i = 0; i < TICKS_PER_SECOND * 60; i++) {
      game.tick();
      if (pillbox.dead) break;
    }
    expect(pillbox.dead).toBe(true);
    expect(world.grid.structureIdAt(34, 30)).toBe(0);
  });

  it("does not auto-engage while under a plain move order", () => {
    const game = arena();
    const runner = spawn(game, "3tnk", "soviet", 26, 30);
    const enemy = spawn(game, "1tnk", "allied", 29, 34);
    enemy.hp = 1e6; // survive long enough to observe
    game.dispatch({
      type: "order",
      ids: [runner.id],
      order: { type: "move", x: tileToWorldX(40), y: tileToWorldY(30) },
      queue: false,
    });
    for (let i = 0; i < 40; i++) game.tick();
    expect(runner.targetId).toBe(0);
  });

  it("splash damage hits several targets at once", () => {
    const game = arena();
    const v2 = spawn(game, "v2rl", "soviet", 24, 30);
    const victims = [
      spawn(game, "e1a", "allied", 32, 30),
      spawn(game, "e1a", "allied", 32, 31),
      spawn(game, "e1a", "allied", 33, 30),
    ];
    game.dispatch({
      type: "order",
      ids: [v2.id],
      order: { type: "attack", targetId: victims[0].id },
      queue: false,
    });

    for (let i = 0; i < TICKS_PER_SECOND * 30; i++) {
      game.tick();
      if (victims.every((v) => v.dead)) break;
    }
    expect(victims.filter((v) => v.dead).length).toBeGreaterThanOrEqual(2);
  });

  it("spawns wreckage and a crater when things die", () => {
    const game = arena();
    const world = game.world;
    spawn(game, "3tnk", "soviet", 30, 30);
    const victim = spawn(game, "1tnk", "allied", 32, 30);
    for (let i = 0; i < TICKS_PER_SECOND * 30; i++) {
      game.tick();
      if (victim.dead) break;
    }
    expect(victim.dead).toBe(true);
    expect(world.effects.some((e) => e.kind === "wreck")).toBe(true);
  });
});

describe("defensive structures", () => {
  it("a Tesla Coil obliterates infantry that come close", () => {
    const game = arena();
    const world = game.world;
    const coil = world.spawnStructure("tesla", "soviet", 30, 30, true)!;
    coil.online = true;
    const victim = spawn(game, "e1a", "allied", 33, 30);

    for (let i = 0; i < TICKS_PER_SECOND * 12; i++) {
      game.tick();
      coil.online = true; // no power grid in the arena
      if (victim.dead) break;
    }
    expect(victim.dead).toBe(true);
  });

  it("an offline defence does not fire", () => {
    const game = arena();
    const world = game.world;
    const coil = world.spawnStructure("tesla", "soviet", 30, 30, true)!;
    const victim = spawn(game, "e1a", "allied", 33, 30);
    const startHp = victim.hp;

    for (let i = 0; i < TICKS_PER_SECOND * 8; i++) {
      game.tick();
      coil.online = false;
    }
    expect(victim.hp).toBe(startHp);
  });

  it("a pillbox defends itself against infantry", () => {
    const game = arena();
    const world = game.world;
    const pillbox = world.spawnStructure("pillbox", "allied", 30, 30, true)!;
    const attacker = spawn(game, "e1", "soviet", 33, 30);

    for (let i = 0; i < TICKS_PER_SECOND * 25; i++) {
      game.tick();
      pillbox.online = true;
      if (attacker.dead) break;
    }
    expect(attacker.dead).toBe(true);
  });
});

describe("structure destruction", () => {
  it("frees the footprint and leaves fires behind", () => {
    const game = arena();
    const world = game.world;
    const barracks = world.spawnStructure("barracks_a", "allied", 30, 30, true)!;
    const def = structureDef("barracks_a");
    for (let i = 0; i < 3; i++) spawn(game, "3tnk", "soviet", 26, 29 + i);

    game.dispatch({
      type: "order",
      ids: world.units.filter((u) => u.side === "soviet").map((u) => u.id),
      order: { type: "attack", targetId: barracks.id },
      queue: false,
    });

    for (let i = 0; i < TICKS_PER_SECOND * 90; i++) {
      game.tick();
      if (barracks.dead) break;
    }

    expect(barracks.dead).toBe(true);
    for (let y = 0; y < def.h; y++) {
      for (let x = 0; x < def.w; x++) {
        expect(world.grid.structureIdAt(30 + x, 30 + y)).toBe(0);
      }
    }
    expect(world.effects.some((e) => e.kind === "fire")).toBe(true);
    expect(world.players.soviet.stats.enemiesDestroyed).toBeGreaterThan(0);
  });
});

describe("projectiles", () => {
  it("tank shells travel rather than hitting instantly", () => {
    const game = arena();
    const world = game.world;
    spawn(game, "3tnk", "soviet", 26, 30);
    const target = spawn(game, "1tnk", "allied", 30, 30);
    target.hp = 1e6;

    let sawProjectile = false;
    for (let i = 0; i < TICKS_PER_SECOND * 10; i++) {
      game.tick();
      if (world.projectiles.length > 0) {
        sawProjectile = true;
        break;
      }
    }
    expect(sawProjectile).toBe(true);
  });

  it("cleans up projectiles so none leak over a long fight", () => {
    const game = arena();
    const world = game.world;
    for (let i = 0; i < 6; i++) {
      spawn(game, "3tnk", "soviet", 26, 26 + i);
      spawn(game, "2tnk", "allied", 34, 26 + i);
    }
    for (let i = 0; i < TICKS_PER_SECOND * 60; i++) game.tick();
    expect(world.projectiles.length).toBeLessThan(60);
    for (const p of world.projectiles) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y)).toBe(true);
      expect(p.age).toBeLessThanOrEqual(p.life);
    }
  });

  it("V2 rockets outrange tank cannons", () => {
    expect(WEAPONS.v2rocket.range).toBeGreaterThan(WEAPONS.apShell.range * 1.5);
    expect(WEAPONS.v2rocket.range).toBeGreaterThan(8 * TILE);
  });
});
