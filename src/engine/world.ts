import { BASE_STORAGE, BUILDUP_TICKS, TILE } from "./constants";
import type { Command } from "./commands";
import type { EngineEvent, SoundCue } from "./events";
import { Grid } from "./grid";
import { Pathfinder } from "./pathfinding";
import { structureDef, unitDef } from "./rules";
import { Rng } from "./util/rng";
import { SpatialHash } from "./util/spatial";
import { tileToWorldX, tileToWorldY } from "./util/vec";
import {
  GameStatus,
  HarvestState,
  OreKind,
  QueueKind,
  QueueStatus,
  type Difficulty,
  type Effect,
  type EffectKind,
  type EntityId,
  type EvaEntry,
  type EvaKey,
  type Player,
  type Projectile,
  type Side,
  type Structure,
  type StructureKindId,
  type Unit,
  type UnitKindId,
} from "./types";

/** Per-tile visibility for the human player. */
export const Visibility = {
  Unexplored: 0,
  Fogged: 1,
  Visible: 2,
} as const;
export type Visibility = (typeof Visibility)[keyof typeof Visibility];

export interface PendingNuke {
  x: number;
  y: number;
  /** Tick at which the warhead lands. */
  impactTick: number;
  side: Side;
}

export class World {
  readonly grid: Grid;
  readonly rng: Rng;
  readonly pathfinder: Pathfinder;
  readonly unitHash: SpatialHash;

  tick = 0;
  status: GameStatus = GameStatus.Playing;
  readonly difficulty: Difficulty;
  /** The side the local human plays. */
  readonly humanSide: Side = "soviet";

  readonly units: Unit[] = [];
  readonly structures: Structure[] = [];
  readonly projectiles: Projectile[] = [];
  readonly effects: Effect[] = [];

  readonly unitById = new Map<EntityId, Unit>();
  readonly structureById = new Map<EntityId, Structure>();

  readonly players: Record<Side, Player>;

  /** Local player's current selection. */
  selection = new Set<EntityId>();
  /** Control groups 1..9 (index 0 unused). */
  readonly controlGroups: Set<EntityId>[] = Array.from({ length: 10 }, () => new Set<EntityId>());

  /** Per-tile visibility for `humanSide`. */
  readonly visibility: Uint8Array;

  readonly commands: Command[] = [];
  readonly events: EngineEvent[] = [];
  readonly evaLog: EvaEntry[] = [];

  /**
   * Tiles whose appearance changed this tick (ore mined, crater, structure placed).
   * The renderer drains this to re-bake only the affected terrain chunks.
   */
  readonly dirtyTiles: number[] = [];

  /** Tick of the last "our base is under attack" warning, used to rate-limit it. */
  lastAttackWarningTick = -9999;

  pendingNuke: PendingNuke | null = null;
  /** Set while a Missile Silo is charged and the player is choosing a target. */
  nukeReadySilo: EntityId = 0;

  /** Remaining A* requests allowed this tick; refilled by `Game.tick()`. */
  pathBudget = 0;

  private nextId = 1;
  private nextEvaId = 1;

  constructor(width: number, height: number, seed: number, difficulty: Difficulty) {
    this.grid = new Grid(width, height);
    this.rng = new Rng(seed);
    this.pathfinder = new Pathfinder(this.grid);
    this.unitHash = new SpatialHash(width * TILE, height * TILE);
    this.difficulty = difficulty;
    this.visibility = new Uint8Array(width * height);
    this.players = {
      soviet: makePlayer("soviet", true),
      allied: makePlayer("allied", false),
    };
  }

  allocId(): EntityId {
    return this.nextId++;
  }

  // ── Entity creation ───────────────────────────────────────────────────────

  spawnUnit(kind: UnitKindId, side: Side, x: number, y: number, facing = 0): Unit {
    const def = unitDef(kind);
    const unit: Unit = {
      id: this.allocId(),
      kind,
      side,
      x,
      y,
      px: x,
      py: y,
      facing,
      turret: facing,
      hp: def.hp,
      order: { type: "guard" },
      queued: [],
      path: [],
      pathIndex: 0,
      destTx: -1,
      destTy: -1,
      pathPending: false,
      cooldown: 0,
      burstLeft: 0,
      burstCooldown: 0,
      targetId: 0,
      cargo: 0,
      cargoKind: OreKind.None,
      harvestState: HarvestState.Seeking,
      homeRefinery: 0,
      oreTx: -1,
      oreTy: -1,
      blockedTicks: 0,
      actionTimer: 0,
      dead: false,
      age: 0,
      repathCooldown: 0,
      kills: 0,
    };
    this.units.push(unit);
    this.unitById.set(unit.id, unit);
    this.events.push({ type: "unitCreated", id: unit.id, kind, side });
    return unit;
  }

  /**
   * Places a structure. Returns null when the footprint is not free.
   * `instant` skips the build-up animation (used for the initial map layout).
   */
  spawnStructure(
    kind: StructureKindId,
    side: Side,
    tx: number,
    ty: number,
    instant = false,
  ): Structure | null {
    const def = structureDef(kind);
    if (!this.footprintFree(tx, ty, def.w, def.h)) return null;

    const exitX = def.exit ? tileToWorldX(tx + def.exit.tx) : tileToWorldX(tx + def.w / 2 - 0.5);
    const exitY = def.exit ? tileToWorldY(ty + def.exit.ty) : tileToWorldY(ty + def.h + 0.5);

    const structure: Structure = {
      id: this.allocId(),
      kind,
      side,
      tx,
      ty,
      hp: def.hp,
      buildProgress: instant ? 1 : 0,
      turret: Math.PI / 2,
      cooldown: 0,
      burstLeft: 0,
      burstCooldown: 0,
      targetId: 0,
      rallyX: exitX,
      rallyY: exitY,
      online: true,
      charge: 0,
      dead: false,
      age: 0,
      dockedUnit: 0,
      repairing: false,
    };
    this.structures.push(structure);
    this.structureById.set(structure.id, structure);
    this.grid.occupy(tx, ty, def.w, def.h, structure.id);
    this.markTilesDirty(tx, ty, def.w, def.h);
    this.events.push({ type: "structureCreated", id: structure.id, kind, side, tx, ty });
    return structure;
  }

  footprintFree(tx: number, ty: number, w: number, h: number): boolean {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (!this.grid.inBounds(x, y)) return false;
        if (!this.grid.terrainPassable(x, y)) return false;
        if (this.grid.structureIdAt(x, y) !== 0) return false;
      }
    }
    return true;
  }

  /** Flags a rectangle of tiles as visually stale so the renderer re-bakes its chunks. */
  markTilesDirty(tx: number, ty: number, w = 1, h = 1): void {
    for (let y = ty; y < ty + h; y++) {
      for (let x = tx; x < tx + w; x++) {
        if (this.grid.inBounds(x, y)) this.dirtyTiles.push(this.grid.index(x, y));
      }
    }
  }

  spawnEffect(
    kind: EffectKind,
    x: number,
    y: number,
    life: number,
    opts: Partial<Pick<Effect, "x2" | "y2" | "rot" | "scale" | "side">> = {},
  ): Effect {
    const effect: Effect = {
      id: this.allocId(),
      kind,
      x,
      y,
      x2: opts.x2 ?? x,
      y2: opts.y2 ?? y,
      age: 0,
      life,
      seed: this.rng.int(0, 0xffff),
      rot: opts.rot ?? 0,
      scale: opts.scale ?? 1,
      side: opts.side ?? null,
    };
    this.effects.push(effect);
    return effect;
  }

  // ── Lookups ───────────────────────────────────────────────────────────────

  unit(id: EntityId): Unit | undefined {
    return this.unitById.get(id);
  }

  structure(id: EntityId): Structure | undefined {
    return this.structureById.get(id);
  }

  /** Returns the live unit or structure with this id, whichever exists. */
  entity(id: EntityId): Unit | Structure | undefined {
    return this.unitById.get(id) ?? this.structureById.get(id);
  }

  structureCenter(s: Structure): { x: number; y: number } {
    const def = structureDef(s.kind);
    return {
      x: (s.tx + def.w / 2) * TILE,
      y: (s.ty + def.h / 2) * TILE,
    };
  }

  entityCenter(e: Unit | Structure): { x: number; y: number } {
    if ("tx" in e) return this.structureCenter(e);
    return { x: e.x, y: e.y };
  }

  /** Radius used for range checks: units use their collision radius, buildings their footprint. */
  entityRadius(e: Unit | Structure): number {
    if ("tx" in e) {
      const def = structureDef(e.kind);
      return (Math.max(def.w, def.h) * TILE) / 2;
    }
    return unitDef(e.kind).radius;
  }

  isAlive(id: EntityId): boolean {
    const u = this.unitById.get(id);
    if (u) return !u.dead;
    const s = this.structureById.get(id);
    return !!s && !s.dead;
  }

  ownStructures(side: Side): Structure[] {
    return this.structures.filter((s) => s.side === side && !s.dead);
  }

  hasOperational(side: Side, kind: StructureKindId): boolean {
    for (const s of this.structures) {
      if (s.side === side && s.kind === kind && !s.dead && s.buildProgress >= 1) return true;
    }
    return false;
  }

  // ── Events ────────────────────────────────────────────────────────────────

  emitSound(cue: SoundCue, x = 0, y = 0, side: Side | null = null): void {
    this.events.push({ type: "sound", cue, x, y, side });
  }

  emitEva(key: EvaKey, side: Side, x = 0, y = 0): void {
    this.events.push({ type: "eva", key, side, x, y });
    if (side === this.humanSide) {
      this.evaLog.push({ id: this.nextEvaId++, key, tick: this.tick, side, x, y });
      if (this.evaLog.length > 64) this.evaLog.shift();
    }
  }

  // ── Storage helpers ───────────────────────────────────────────────────────

  storageCapacity(side: Side): number {
    let cap = BASE_STORAGE;
    for (const s of this.structures) {
      if (s.side === side && !s.dead && s.buildProgress >= 1) {
        cap += structureDef(s.kind).storage;
      }
    }
    return cap;
  }

  /**
   * Adds credits, clamped to storage capacity. Returns the amount actually banked.
   *
   * Deliberately never *reduces* the balance: a player who is already over capacity (because a
   * silo was just sold or destroyed) should stop earning, not have money confiscated.
   */
  addCredits(side: Side, amount: number): number {
    const player = this.players[side];
    if (amount <= 0) {
      player.credits = Math.max(0, player.credits + amount);
      return amount;
    }
    const cap = this.storageCapacity(side);
    if (player.credits >= cap) return 0;
    const before = player.credits;
    player.credits = Math.min(cap, player.credits + amount);
    return player.credits - before;
  }

  buildupTicks(): number {
    return BUILDUP_TICKS;
  }
}

function makePlayer(side: Side, isHuman: boolean): Player {
  return {
    side,
    isHuman,
    credits: 0,
    storage: 0,
    powerProduced: 0,
    powerConsumed: 0,
    powerFactor: 1,
    queues: {
      [QueueKind.Structure]: { kind: QueueKind.Structure, items: [], status: QueueStatus.Empty },
      [QueueKind.Infantry]: { kind: QueueKind.Infantry, items: [], status: QueueStatus.Empty },
      [QueueKind.Vehicle]: { kind: QueueKind.Vehicle, items: [], status: QueueStatus.Empty },
    },
    primary: {},
    stats: {
      unitsBuilt: 0,
      unitsLost: 0,
      structuresBuilt: 0,
      structuresLost: 0,
      enemiesDestroyed: 0,
      oreHarvested: 0,
    },
    defeated: false,
  };
}
