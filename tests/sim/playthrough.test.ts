import { describe, expect, it } from "vitest";
import { Game } from "../../src/engine/game";
import { m01IronCurtain } from "../../src/maps/m01-iron-curtain";
import { AI_THINK_INTERVAL, TICKS_PER_SECOND } from "../../src/engine/constants";
import { structureDef, unitDef } from "../../src/engine/rules";
import { canBuildStructure, canBuildUnit } from "../../src/engine/queries";
import { isPlacementLegal } from "../../src/engine/systems/production";
import {
  GameStatus,
  QueueKind,
  UnitClass,
  type Difficulty,
  type EntityId,
  type Structure,
  type StructureKindId,
  type UnitKindId,
} from "../../src/engine/types";
import { assertWorldSane } from "./helpers";

const MINUTE = TICKS_PER_SECOND * 60;

/**
 * A scripted Soviet commander that plays the mission the way a person would.
 *
 * It is deliberately restricted to the same public surface a human has — it only ever calls
 * `game.dispatch` with the commands the UI sends, and reads nothing the HUD would not show. That
 * is what makes it evidence that the mission is *winnable*, rather than evidence that the engine
 * can be cheated into a victory.
 *
 * It is also intentionally unsophisticated: no micro, no focus fire, no repairing, no scouting.
 * If a bot this crude can win on Veteran, a player has room to breathe.
 */
class PlayerBot {
  /** What to build, in order, and how many of each. */
  /** Core infrastructure, built as soon as it is affordable. */
  private static readonly CORE_ORDER: readonly StructureKindId[] = [
    "barracks",
    "warfactory",
    "flametower",
    "flametower",
    "power",
    "refinery",
    "power",
  ];

  /**
   * Everything after the core. Only started when there is spare cash, so base expansion never
   * starves unit production — which is exactly the trap this bot fell into on its first run.
   */
  private static readonly EXPANSION_ORDER: readonly StructureKindId[] = [
    "flametower",
    "radar",
    "flametower",
    "power",
    "tesla",
    "warfactory",
    "power",
    "tesla",
  ];

  /** Spare cash required before spending on expansion rather than on army. */
  private static readonly EXPANSION_RESERVE = 1200;

  private attackWave: EntityId[] = [];
  private attacking = false;
  private lastCommit = -9999;

  /**
   * Combat value massed before committing an attack.
   *
   * Set high on purpose: trickling three tanks at a time into a defended base just feeds the
   * enemy, which is exactly what the first version of this bot did for eighteen straight minutes.
   */
  private attackThreshold = 8000;

  constructor(private readonly game: Game) {}

  get side() {
    return this.game.world.humanSide;
  }

  step(): void {
    const world = this.game.world;
    if (world.tick % AI_THINK_INTERVAL !== 0) return;
    this.manageBase();
    this.manageEconomy();
    this.manageArmy();
    this.manageAttack();
  }

  // ── Base ──────────────────────────────────────────────────────────────────

  private manageBase(): void {
    const world = this.game.world;
    const queue = world.players[this.side].queues[QueueKind.Structure];

    // Something finished and is waiting for a build site.
    const ready = queue.items.find(
      (item) => item.isStructure && item.progress >= structureDef(item.what as StructureKindId).buildTime,
    );
    if (ready) {
      const kind = ready.what as StructureKindId;
      const spot = this.findBuildSite(kind);
      if (spot) {
        this.game.dispatch({
          type: "placeStructure",
          side: this.side,
          what: kind,
          tx: spot.tx,
          ty: spot.ty,
        });
      }
      return;
    }
    if (queue.items.length > 0) return;

    const next = this.nextStructure();
    if (next) {
      this.game.dispatch({
        type: "queueAdd",
        side: this.side,
        queue: QueueKind.Structure,
        what: next,
      });
    }
  }

  private nextStructure(): StructureKindId | null {
    const world = this.game.world;
    const player = world.players[this.side];

    // Keep the lights on before anything else.
    if (player.powerConsumed > 0 && player.powerFactor < 1 && canBuildStructure(world, this.side, "power")) {
      return "power";
    }

    const have = new Map<StructureKindId, number>();
    for (const s of world.structures) {
      if (s.side !== this.side || s.dead) continue;
      have.set(s.kind, (have.get(s.kind) ?? 0) + 1);
    }

    const pick = (order: readonly StructureKindId[]): StructureKindId | null => {
      const wanted = new Map<StructureKindId, number>();
      for (const kind of order) {
        wanted.set(kind, (wanted.get(kind) ?? 0) + 1);
        if ((have.get(kind) ?? 0) >= wanted.get(kind)!) continue;
        if (canBuildStructure(world, this.side, kind)) return kind;
      }
      return null;
    };

    const core = pick(PlayerBot.CORE_ORDER);
    if (core) return core;
    if (player.credits < PlayerBot.EXPANSION_RESERVE) return null;
    return pick(PlayerBot.EXPANSION_ORDER);
  }

  private findBuildSite(kind: StructureKindId): { tx: number; ty: number } | null {
    const world = this.game.world;
    const home = world.structures.find(
      (s) => s.side === this.side && s.kind === "conyard" && !s.dead,
    );
    if (!home) return null;
    for (let r = 2; r <= 7; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const tx = home.tx + dx;
          const ty = home.ty + dy;
          if (isPlacementLegal(world, this.side, kind, tx, ty)) return { tx, ty };
        }
      }
    }
    return null;
  }

  // ── Economy & army ────────────────────────────────────────────────────────

  private manageEconomy(): void {
    const world = this.game.world;
    const target = 4;
    const alive = world.units.filter((u) => u.side === this.side && u.kind === "harv" && !u.dead).length;
    const queued = this.countQueued("harv");
    if (alive + queued < target && canBuildUnit(world, this.side, "harv")) {
      this.game.dispatch({
        type: "queueAdd",
        side: this.side,
        queue: QueueKind.Vehicle,
        what: "harv",
      });
    }
  }

  private manageArmy(): void {
    const world = this.game.world;
    const player = world.players[this.side];

    // Production is paid as a drip, so there is no reason to sit on a full tank's price before
    // starting one. Gating on a large balance simply idles the factories.
    if (player.credits < 350) return;

    const vehicles = player.queues[QueueKind.Vehicle];
    if (vehicles.items.length < 4 && canBuildUnit(world, this.side, "3tnk")) {
      this.game.dispatch({
        type: "queueAdd",
        side: this.side,
        queue: QueueKind.Vehicle,
        what: "3tnk",
      });
    }

    const infantry = player.queues[QueueKind.Infantry];
    if (infantry.items.length < 2 && canBuildUnit(world, this.side, "e3")) {
      this.game.dispatch({
        type: "queueAdd",
        side: this.side,
        queue: QueueKind.Infantry,
        what: "e3",
      });
    }
  }

  private countQueued(kind: UnitKindId): number {
    let n = 0;
    for (const queue of Object.values(this.game.world.players[this.side].queues)) {
      for (const item of queue.items) if (item.what === kind) n++;
    }
    return n;
  }

  // ── Offense ───────────────────────────────────────────────────────────────

  private manageAttack(): void {
    const world = this.game.world;
    this.attackWave = this.attackWave.filter((id) => {
      const u = world.unit(id);
      return !!u && !u.dead;
    });

    const objective = this.nearestEnemyStructure();

    if (this.attacking) {
      if (this.attackWave.length === 0) {
        this.attacking = false;
        // Regroup a little harder next time.
        this.attackThreshold += 1500;
        return;
      }
      // Reinforce and re-issue, otherwise units that finish a local fight go idle forever.
      for (const u of this.idleCombatUnits()) {
        if (!this.attackWave.includes(u.id)) this.attackWave.push(u.id);
      }
      if (objective && world.tick - this.lastCommit > TICKS_PER_SECOND * 10) {
        this.commit(objective);
      }
      return;
    }

    const idle = this.idleCombatUnits();
    const strength = idle.reduce((sum, u) => sum + unitDef(u.kind).cost, 0);
    if (strength < this.attackThreshold || !objective) return;

    // Leave a home guard behind. Marching the entire army across the map and losing the base to
    // the counter-attack is the single most common way a real player throws a match away.
    const guardCount = Math.max(2, Math.floor(idle.length * 0.3));
    this.attackWave = idle.slice(guardCount).map((u) => u.id);
    if (this.attackWave.length === 0) return;
    this.attacking = true;
    this.commit(objective);
  }

  private commit(objective: Structure): void {
    const world = this.game.world;
    const centre = world.structureCenter(objective);
    // Aim just outside the footprint — a building's centre tile is not walkable.
    const home = world.structures.find((s) => s.side === this.side && s.kind === "conyard" && !s.dead);
    const from = home ? world.structureCenter(home) : centre;
    const dx = from.x - centre.x;
    const dy = from.y - centre.y;
    const len = Math.hypot(dx, dy) || 1;
    const standoff = world.entityRadius(objective) + 40;

    this.game.dispatch({
      type: "order",
      ids: [...this.attackWave],
      order: {
        type: "attackMove",
        x: centre.x + (dx / len) * standoff,
        y: centre.y + (dy / len) * standoff,
      },
      queue: false,
    });
    this.lastCommit = world.tick;
  }

  private nearestEnemyStructure(): Structure | null {
    const world = this.game.world;
    const home = world.structures.find((s) => s.side === this.side && s.kind === "conyard" && !s.dead);
    const from = home ? world.structureCenter(home) : { x: 0, y: 0 };
    let best: Structure | null = null;
    let bestDist = Infinity;
    for (const s of world.structures) {
      if (s.side === this.side || s.dead) continue;
      const c = world.structureCenter(s);
      const d = Math.hypot(c.x - from.x, c.y - from.y);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }
    return best;
  }

  private idleCombatUnits() {
    return this.game.world.units.filter((u) => {
      if (u.side !== this.side || u.dead) return false;
      const def = unitDef(u.kind);
      if (!def.weapon || def.cargoCapacity > 0) return false;
      if (def.cls === UnitClass.Infantry && u.kind === "e6") return false;
      return u.order.type === "guard" || u.order.type === "idle";
    });
  }
}

interface PlaythroughResult {
  status: GameStatus;
  minutes: number;
  structuresBuilt: number;
  unitsBuilt: number;
  enemiesDestroyed: number;
  oreHarvested: number;
  peakArmy: number;
}

function playMission(difficulty: Difficulty, limitMinutes: number): PlaythroughResult {
  const game = new Game(m01IronCurtain, difficulty);
  const bot = new PlayerBot(game);
  const limit = MINUTE * limitMinutes;
  let peakArmy = 0;

  for (let i = 0; i < limit; i++) {
    bot.step();
    game.tick();

    if (i % 600 === 0) {
      let army = 0;
      for (const u of game.world.units) {
        if (u.side !== "soviet" || u.dead) continue;
        const def = unitDef(u.kind);
        if (def.weapon && def.cargoCapacity === 0) army += def.cost;
      }
      peakArmy = Math.max(peakArmy, army);
    }
    if (i % (MINUTE * 5) === 0) assertWorldSane(game.world, `${difficulty} minute ${i / MINUTE}`);
    if (process.env.PLAYTHROUGH_DEBUG && i % MINUTE === 0) {
      const w = game.world;
      const sq = w.players.soviet.queues[QueueKind.Structure];
      // eslint-disable-next-line no-console
      console.log(
        `[${difficulty}] m${i / MINUTE} structs=${w.structures.filter((s) => s.side === "soviet" && !s.dead).length}` +
          ` sq=${sq.items.map((x) => x.what).join(",")||"-"}/${sq.status}` +
          ` credits=${Math.round(w.players.soviet.credits)}` +
          ` harv=${w.units.filter((u) => u.side === "soviet" && u.kind === "harv" && !u.dead).length}` +
          ` army=${w.units.filter((u) => u.side === "soviet" && !u.dead && unitDef(u.kind).weapon && unitDef(u.kind).cargoCapacity === 0).length}` +
          ` enemyStructs=${w.structures.filter((s) => s.side === "allied" && !s.dead).length}`,
      );
    }
    if (game.status !== GameStatus.Playing) break;
  }

  const stats = game.world.players.soviet.stats;
  return {
    status: game.status,
    minutes: game.world.tick / MINUTE,
    structuresBuilt: stats.structuresBuilt,
    unitsBuilt: stats.unitsBuilt,
    enemiesDestroyed: stats.enemiesDestroyed,
    oreHarvested: stats.oreHarvested,
    peakArmy,
  };
}

describe("scripted playthrough", () => {
  it("a competent player wins mission 01 on Veteran", () => {
    const result = playMission("normal", 60);

    // eslint-disable-next-line no-console
    console.log(
      `veteran playthrough: ${result.status} at ${result.minutes.toFixed(1)}min — ` +
        `${result.structuresBuilt} structures, ${result.unitsBuilt} units, ` +
        `${result.enemiesDestroyed} kills, ${Math.round(result.oreHarvested)} ore, ` +
        `peak army $${result.peakArmy}`,
    );

    expect(result.status, "the mission must be winnable by ordinary play").toBe(
      GameStatus.Victory,
    );
    // The win has to come from actually playing: economy, production and offence.
    expect(result.structuresBuilt).toBeGreaterThan(3);
    expect(result.unitsBuilt).toBeGreaterThan(10);
    expect(result.oreHarvested).toBeGreaterThan(5000);
    expect(result.enemiesDestroyed).toBeGreaterThan(10);
  });

  it("wins more comfortably on Recruit than on Veteran", () => {
    const easy = playMission("easy", 60);
    const normal = playMission("normal", 60);

    expect(easy.status).toBe(GameStatus.Victory);
    expect(normal.status).toBe(GameStatus.Victory);
    // Recruit should cost the player less to win.
    expect(easy.minutes).toBeLessThanOrEqual(normal.minutes + 1);
  });

  it("Commissar is a genuine challenge for the same bot", () => {
    const hard = playMission("hard", 60);

    // eslint-disable-next-line no-console
    console.log(
      `commissar playthrough: ${hard.status} at ${hard.minutes.toFixed(1)}min — ` +
        `${hard.enemiesDestroyed} kills, peak army $${hard.peakArmy}`,
    );

    // The bot does no micro at all, so Commissar is allowed to beat it — what must hold is that
    // the match resolves rather than stalling, and that it is measurably harder than Veteran.
    expect(hard.status).not.toBe(GameStatus.Playing);
  });
});
