import { AI_THINK_INTERVAL, TILE } from "../constants";
import { structureDef, unitDef } from "../rules";
import { canBuildStructure, canBuildUnit } from "../queries";
import {
  QueueKind,
  QueueStatus,
  UnitClass,
  type Difficulty,
  type EntityId,
  type Side,
  type Structure,
  type StructureKindId,
  type Unit,
  type UnitKindId,
} from "../types";
import { dist, tileToWorldX, tileToWorldY } from "../util/vec";
import type { World } from "../world";
import { giveOrder } from "./orders";
import { enqueue, isPlacementLegal, placeReadyStructure } from "./production";
import type { AiConfig } from "../../maps/types";

/** Per-difficulty tuning applied on top of the mission's own AI configuration. */
interface DifficultyTuning {
  income: number;
  waveInterval: number;
  waveStrength: number;
  harvesterBonus: number;
}

/**
 * Tuned against the headless "idle player" benchmark: on Recruit a passive player must still be
 * standing after ten minutes (so a newcomer has room to learn the build order), while on
 * Commissar the same passive player is finished well inside twenty-five.
 */
const TUNING: Record<Difficulty, DifficultyTuning> = {
  easy: { income: 0.45, waveInterval: 2.4, waveStrength: 0.5, harvesterBonus: -1 },
  normal: { income: 1, waveInterval: 1, waveStrength: 1, harvesterBonus: 0 },
  hard: { income: 1.7, waveInterval: 0.6, waveStrength: 1.5, harvesterBonus: 1 },
};

export const AiPosture = {
  /** Building up; units hold near the base. */
  Building: "building",
  /** Enough force assembled; units move to the staging point. */
  Massing: "massing",
  /** Wave committed and moving on the objective. */
  Attacking: "attacking",
} as const;
export type AiPosture = (typeof AiPosture)[keyof typeof AiPosture];

export interface AiState {
  readonly side: Side;
  readonly config: AiConfig;
  readonly tuning: DifficultyTuning;
  posture: AiPosture;
  /** Tick at which the next wave may launch. */
  nextWaveTick: number;
  waveNumber: number;
  /** Units earmarked for the current wave. */
  strikeForce: EntityId[];
  attackTarget: EntityId;
  /** Structure the AI is currently waiting to place. */
  pendingBuild: StructureKindId | null;
  /** Tick of the last time one of its buildings was hurt, for defensive reactions. */
  lastThreatTick: number;
  threatX: number;
  threatY: number;
  /** Tick the current wave was last given its orders. */
  lastCommitTick: number;
}

/** How often an in-progress wave is re-ordered onto its objective. */
const RECOMMIT_INTERVAL = 30 * 10;

export function createAiState(side: Side, config: AiConfig, difficulty: Difficulty): AiState {
  return {
    side,
    config,
    tuning: TUNING[difficulty],
    posture: AiPosture.Building,
    nextWaveTick: Math.round(config.waveInterval * TUNING[difficulty].waveInterval),
    waveNumber: 0,
    strikeForce: [],
    attackTarget: 0,
    pendingBuild: null,
    lastThreatTick: -9999,
    threatX: 0,
    threatY: 0,
    lastCommitTick: -9999,
  };
}

/**
 * The Allied commander.
 *
 * A small finite-state machine rather than a scripted timeline: it rebuilds what it loses, keeps
 * its economy staffed, masses a strike force whose size grows with the match clock, and pulls
 * defenders back when its own base is hit. That makes the difficulty curve emerge from the
 * player's own pressure instead of from a fixed script.
 */
export function aiSystem(world: World): void {
  const ai = world.ai;
  if (!ai) return;
  if (world.tick % AI_THINK_INTERVAL !== 0) return;

  applyIncomeBonus(world, ai);
  manageEconomy(world, ai);
  manageBase(world, ai);
  manageArmy(world, ai);
  manageWaves(world, ai);
  manageDefence(world, ai);
}

// ── Economy ─────────────────────────────────────────────────────────────────

/**
 * A flat credit trickle standing in for the AI's off-screen logistics.
 *
 * Without it the AI is hostage to the same harvester round-trips as the player but with none of
 * the micro-management, and difficulty becomes impossible to tune.
 */
function applyIncomeBonus(world: World, ai: AiState): void {
  const bonus = 2 * ai.config.incomeMultiplier * ai.tuning.income * (AI_THINK_INTERVAL / 30);
  world.addCredits(ai.side, bonus);
}

function manageEconomy(world: World, ai: AiState): void {
  const harvesterKind: UnitKindId = ai.side === "allied" ? "harva" : "harv";
  const target = Math.max(1, ai.config.maxHarvesters + ai.tuning.harvesterBonus);
  const alive = world.units.filter((u) => u.side === ai.side && u.kind === harvesterKind).length;
  const queued = countQueued(world, ai.side, harvesterKind);

  if (alive + queued < target && canBuildUnit(world, ai.side, harvesterKind)) {
    enqueue(world, ai.side, harvesterKind);
  }
}

// ── Base construction ───────────────────────────────────────────────────────

const ALLIED_BUILD_ORDER: readonly StructureKindId[] = [
  "power_a",
  "refinery_a",
  "barracks_a",
  "warfactory_a",
  "power_a",
  "pillbox",
  "turret",
  "power_a",
  "refinery_a",
  "turret",
  "pillbox",
];

function manageBase(world: World, ai: AiState): void {
  // Keep factories rallying to a staging point on the enemy-facing side of the base.
  const rally = aiRallyPoint(world, ai);
  for (const s of world.structures) {
    if (s.side !== ai.side || s.dead) continue;
    const produces = structureDef(s.kind).producesQueue;
    if (!produces || produces === QueueKind.Structure) continue;
    s.rallyX = rally.x;
    s.rallyY = rally.y;
  }

  const queue = world.players[ai.side].queues[QueueKind.Structure];

  // A finished building is waiting to be sited.
  if (queue.status === QueueStatus.Ready) {
    const ready = queue.items.find((i) => i.isStructure);
    if (ready) {
      const kind = ready.what as StructureKindId;
      const spot = findBuildSite(world, ai, kind);
      if (spot) placeReadyStructure(world, ai.side, kind, spot.tx, spot.ty);
    }
    return;
  }
  if (queue.items.length > 0) return;

  const next = chooseNextStructure(world, ai);
  if (next) enqueue(world, ai.side, next);
}

function chooseNextStructure(world: World, ai: AiState): StructureKindId | null {
  const player = world.players[ai.side];

  // Losing power cripples everything, so restoring it always jumps the queue.
  if (player.powerConsumed > 0 && player.powerFactor < 1) {
    const plant: StructureKindId = ai.side === "allied" ? "power_a" : "power";
    if (canBuildStructure(world, ai.side, plant)) return plant;
  }

  const counts = new Map<StructureKindId, number>();
  for (const s of world.structures) {
    if (s.side !== ai.side || s.dead) continue;
    counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);
  }

  // Walk the build order and take the first entry we are short of.
  const wanted = new Map<StructureKindId, number>();
  for (const kind of ALLIED_BUILD_ORDER) {
    wanted.set(kind, (wanted.get(kind) ?? 0) + 1);
    if ((counts.get(kind) ?? 0) < wanted.get(kind)!) {
      if (canBuildStructure(world, ai.side, kind)) return kind;
      // Prerequisite missing: keep scanning for something we *can* start.
    }
  }
  return null;
}

/** Spiral out from the AI's Construction Yard for a legal, reachable site. */
function findBuildSite(
  world: World,
  ai: AiState,
  kind: StructureKindId,
): { tx: number; ty: number } | null {
  const home = world.structures.find(
    (s) => s.side === ai.side && !s.dead && structureDef(s.kind).producesQueue === QueueKind.Structure,
  );
  if (!home) return null;

  const def = structureDef(kind);
  const defensive = def.weapon !== null;
  // Defences go on the side facing the enemy; everything else hugs the base.
  const enemyDir = enemyDirection(world, ai);

  for (let r = 2; r <= 7; r++) {
    const candidates: { tx: number; ty: number; score: number }[] = [];
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const tx = home.tx + dx;
        const ty = home.ty + dy;
        if (!isPlacementLegal(world, ai.side, kind, tx, ty)) continue;
        const towardEnemy = dx * enemyDir.x + dy * enemyDir.y;
        candidates.push({ tx, ty, score: defensive ? -towardEnemy : towardEnemy });
      }
    }
    if (candidates.length > 0) {
      candidates.sort((a, b) => a.score - b.score);
      return candidates[0];
    }
  }
  return null;
}

function enemyDirection(world: World, ai: AiState): { x: number; y: number } {
  const mine = baseCentre(world, ai.side);
  const theirs = baseCentre(world, ai.side === "soviet" ? "allied" : "soviet");
  if (!mine || !theirs) return { x: 1, y: 0 };
  const dx = theirs.x - mine.x;
  const dy = theirs.y - mine.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: dx / len, y: dy / len };
}

function baseCentre(world: World, side: Side): { x: number; y: number } | null {
  let sx = 0;
  let sy = 0;
  let n = 0;
  for (const s of world.structures) {
    if (s.side !== side || s.dead) continue;
    const c = world.structureCenter(s);
    sx += c.x;
    sy += c.y;
    n++;
  }
  return n === 0 ? null : { x: sx / n, y: sy / n };
}

// ── Army production ─────────────────────────────────────────────────────────

/** Composition the AI aims for, weighted by how many of each it wants per wave. */
const ARMY_MIX: readonly { kind: UnitKindId; weight: number }[] = [
  { kind: "e1a", weight: 3 },
  { kind: "e3a", weight: 2 },
  { kind: "jeep", weight: 1 },
  { kind: "1tnk", weight: 2 },
  { kind: "2tnk", weight: 3 },
  { kind: "arty", weight: 1 },
];

function manageArmy(world: World, ai: AiState): void {
  const player = world.players[ai.side];
  const targetStrength = waveStrength(ai) * 1.35;
  // Count what is already on order as well as what is on the field. Without this the AI keeps
  // queueing every think-tick until the units finally roll out, and the "first wave" arrives
  // three times the intended size.
  const current = combatValue(world, ai.side) + queuedCombatValue(world, ai.side);
  if (current >= targetStrength) return;

  // Alternate between the two production queues so infantry and armour arrive together.
  for (const queueKind of [QueueKind.Infantry, QueueKind.Vehicle] as const) {
    const queue = player.queues[queueKind];
    if (queue.items.length >= 3) continue;

    const options = ARMY_MIX.filter(
      (entry) =>
        canBuildUnit(world, ai.side, entry.kind) &&
        queueForUnit(entry.kind) === queueKind,
    );
    if (options.length === 0) continue;

    // Weighted pick, seeded from the world RNG so runs stay reproducible.
    const total = options.reduce((sum, o) => sum + o.weight, 0);
    let roll = world.rng.next() * total;
    for (const option of options) {
      roll -= option.weight;
      if (roll <= 0) {
        enqueue(world, ai.side, option.kind);
        break;
      }
    }
  }
}

function queueForUnit(kind: UnitKindId): QueueKind {
  return unitDef(kind).cls === UnitClass.Infantry ? QueueKind.Infantry : QueueKind.Vehicle;
}

function countQueued(world: World, side: Side, kind: UnitKindId): number {
  let n = 0;
  for (const queue of Object.values(world.players[side].queues)) {
    for (const item of queue.items) if (item.what === kind) n++;
  }
  return n;
}

/** Cost of every combat unit currently queued for production. */
function queuedCombatValue(world: World, side: Side): number {
  let value = 0;
  for (const kind of [QueueKind.Infantry, QueueKind.Vehicle] as const) {
    for (const item of world.players[side].queues[kind].items) {
      const def = unitDef(item.what as UnitKindId);
      if (def.cargoCapacity > 0 || !def.weapon) continue;
      value += def.cost;
    }
  }
  return value;
}

/** Sum of the cost of every combat unit the side has in the field. */
function combatValue(world: World, side: Side): number {
  let value = 0;
  for (const u of world.units) {
    if (u.side !== side || u.dead) continue;
    const def = unitDef(u.kind);
    if (def.cargoCapacity > 0 || !def.weapon) continue;
    value += def.cost;
  }
  return value;
}

function waveStrength(ai: AiState): number {
  const base = ai.config.firstWaveStrength + ai.waveNumber * ai.config.waveStrengthGrowth;
  return base * ai.tuning.waveStrength;
}

function waveInterval(ai: AiState): number {
  return Math.max(
    ai.config.minWaveInterval,
    Math.round(ai.config.waveInterval * ai.tuning.waveInterval),
  );
}

// ── Attack waves ────────────────────────────────────────────────────────────

function manageWaves(world: World, ai: AiState): void {
  // Prune the dead out of the strike force.
  ai.strikeForce = ai.strikeForce.filter((id) => {
    const u = world.unit(id);
    return !!u && !u.dead;
  });

  // Escalate on the clock rather than only when a wave dies out. Otherwise a wave that gets
  // bogged down freezes the AI's target strength, it stops spending, and the pressure evaporates.
  const interval = waveInterval(ai);
  ai.waveNumber = Math.floor(world.tick / interval);

  if (ai.posture === AiPosture.Attacking) {
    // Fold newly built units into the ongoing offensive so reinforcements keep arriving.
    for (const u of idleCombatUnits(world, ai)) {
      if (!ai.strikeForce.includes(u.id)) ai.strikeForce.push(u.id);
    }
  }

  if (ai.posture === AiPosture.Attacking) {
    const target = world.entity(ai.attackTarget);
    const targetGone = !target || target.dead;
    if (targetGone) {
      const next = pickObjective(world, ai);
      if (next) {
        ai.attackTarget = next.id;
        commitStrike(world, ai);
      } else {
        ai.posture = AiPosture.Building;
      }
    } else if (world.tick - ai.lastCommitTick > RECOMMIT_INTERVAL) {
      // Re-issue the order periodically. Units that arrived, got blocked, or fell back to Guard
      // after a local skirmish would otherwise sit still for the rest of the match.
      commitStrike(world, ai);
    }

    if (ai.strikeForce.length === 0) {
      ai.posture = AiPosture.Building;
      ai.nextWaveTick = world.tick + interval;
    }
    return;
  }

  if (world.tick < ai.nextWaveTick) return;

  const idle = idleCombatUnits(world, ai);
  const strength = idle.reduce((sum, u) => sum + unitDef(u.kind).cost, 0);
  if (strength < waveStrength(ai)) {
    ai.posture = AiPosture.Massing;
    return;
  }

  const objective = pickObjective(world, ai);
  if (!objective) return;

  ai.strikeForce = idle.map((u) => u.id);
  ai.attackTarget = objective.id;
  ai.posture = AiPosture.Attacking;
  commitStrike(world, ai);
}

function commitStrike(world: World, ai: AiState): void {
  const target = world.entity(ai.attackTarget);
  if (!target) return;
  ai.lastCommitTick = world.tick;

  // Aim at open ground just outside the objective rather than its centre: the centre of a
  // building is unreachable, and stacking a whole wave on one tile is a traffic jam anyway.
  const centre = world.entityCenter(target);
  const from = baseCentre(world, ai.side) ?? centre;
  const dx = from.x - centre.x;
  const dy = from.y - centre.y;
  const len = Math.hypot(dx, dy) || 1;
  const standoff = world.entityRadius(target) + TILE * 1.5;
  const aimX = centre.x + (dx / len) * standoff;
  const aimY = centre.y + (dy / len) * standoff;

  ai.strikeForce.forEach((id, index) => {
    const u = world.unit(id);
    if (!u || u.dead) return;
    // Fan the wave out so they do not all path onto the same tile.
    const spread = ((index % 5) - 2) * TILE * 1.2;
    giveOrder(world, u, {
      type: "attackMove",
      x: aimX + (-dy / len) * spread,
      y: aimY + (dx / len) * spread,
    });
  });
}

/** Prefers production buildings, then anything else, closest to the AI's base first. */
function pickObjective(world: World, ai: AiState): Structure | Unit | null {
  const enemy: Side = ai.side === "soviet" ? "allied" : "soviet";
  const from = baseCentre(world, ai.side) ?? { x: 0, y: 0 };

  let best: Structure | null = null;
  let bestScore = Infinity;
  for (const s of world.structures) {
    if (s.side !== enemy || s.dead) continue;
    const def = structureDef(s.kind);
    const c = world.structureCenter(s);
    const priority = def.producesQueue ? 0 : def.isRefinery ? TILE * 6 : TILE * 18;
    const score = dist(from.x, from.y, c.x, c.y) + priority;
    if (score < bestScore) {
      bestScore = score;
      best = s;
    }
  }
  if (best) return best;

  // No buildings left: hunt the remaining units.
  let bestUnit: Unit | null = null;
  let bestUnitScore = Infinity;
  for (const u of world.units) {
    if (u.side !== enemy || u.dead) continue;
    const d = dist(from.x, from.y, u.x, u.y);
    if (d < bestUnitScore) {
      bestUnitScore = d;
      bestUnit = u;
    }
  }
  return bestUnit;
}

function idleCombatUnits(world: World, ai: AiState): Unit[] {
  return world.units.filter((u) => {
    if (u.side !== ai.side || u.dead) return false;
    const def = unitDef(u.kind);
    if (!def.weapon || def.cargoCapacity > 0) return false;
    return u.order.type === "guard" || u.order.type === "idle";
  });
}

// ── Defence ─────────────────────────────────────────────────────────────────

const DEFENCE_RADIUS = TILE * 22;
const DEFENCE_MEMORY = 30 * 12;

/** Notifies the AI that one of its buildings or units is being attacked. */
export function notifyAiThreat(world: World, side: Side, x: number, y: number): void {
  const ai = world.ai;
  if (!ai || ai.side !== side) return;
  ai.lastThreatTick = world.tick;
  ai.threatX = x;
  ai.threatY = y;
}

function manageDefence(world: World, ai: AiState): void {
  if (world.tick - ai.lastThreatTick > DEFENCE_MEMORY) return;

  const home = baseCentre(world, ai.side);
  if (!home) return;
  // Only react to attacks on the base itself; skirmishes out in the field are not worth recalling
  // the whole garrison for.
  if (dist(home.x, home.y, ai.threatX, ai.threatY) > DEFENCE_RADIUS) return;

  for (const u of world.units) {
    if (u.side !== ai.side || u.dead) continue;
    const def = unitDef(u.kind);
    if (!def.weapon || def.cargoCapacity > 0) continue;
    if (ai.strikeForce.includes(u.id)) continue;
    if (u.order.type !== "guard" && u.order.type !== "idle") continue;
    if (dist(u.x, u.y, ai.threatX, ai.threatY) < TILE * 5) continue;
    giveOrder(world, u, { type: "attackMove", x: ai.threatX, y: ai.threatY });
  }
}

/** Rally point used by newly produced AI units, just inside the base. */
export function aiRallyPoint(world: World, ai: AiState): { x: number; y: number } {
  const home = baseCentre(world, ai.side);
  if (!home) return { x: tileToWorldX(0), y: tileToWorldY(0) };
  const dir = enemyDirection(world, ai);
  return { x: home.x + dir.x * TILE * 4, y: home.y + dir.y * TILE * 4 };
}
