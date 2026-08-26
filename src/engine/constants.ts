/** Simulation-wide constants. Shared by the engine and (read-only) by the renderer. */

/** Size of one map cell in world pixels. */
export const TILE = 24;

/** The simulation runs at a fixed rate; rendering interpolates between ticks. */
export const TICKS_PER_SECOND = 30;
export const TICK_MS = 1000 / TICKS_PER_SECOND;

export const seconds = (s: number): number => Math.round(s * TICKS_PER_SECOND);

/** How much a single tile can hold, in "scoops". Each scoop is worth `ORE_VALUE` credits. */
export const MAX_ORE_DENSITY = 12;

/** Credits earned per scoop of ore / gems delivered to a refinery. */
export const ORE_VALUE = 25;
export const GEM_VALUE = 50;

/** Ticks a harvester spends collecting one scoop. */
export const HARVEST_TICKS_PER_SCOOP = 12;
/** Ticks a harvester spends unloading one scoop. */
export const UNLOAD_TICKS_PER_SCOOP = 4;

/** Base storage every player has, even without silos (matches RA's "conyard holds a little"). */
export const BASE_STORAGE = 2000;

/** How far from an existing structure a new one may be placed, in tiles. */
export const BUILD_RADIUS = 6;

/** Production slows to this fraction of normal speed when power is fully browned out. */
export const MIN_POWER_FACTOR = 0.25;

/** Ticks between AI "think" passes. */
export const AI_THINK_INTERVAL = 15;

/** Maximum A* requests serviced per tick, to keep tick time bounded. */
export const PATH_BUDGET_PER_TICK = 24;

/** Hard cap on nodes A* will expand before giving up on a single request. */
export const PATH_MAX_NODES = 6000;

/** Auto-acquire scan interval (ticks) for idle/guarding units. */
export const ACQUIRE_INTERVAL = 8;

/** Structures repair this fraction of max HP per repair pulse, at this credit cost per HP. */
export const REPAIR_PULSE_TICKS = 12;
export const REPAIR_HP_PER_PULSE = 0.02;
export const REPAIR_COST_PER_HP = 0.15;

/** Selling a structure refunds this fraction of its cost. */
export const SELL_REFUND = 0.5;

/** Ticks a structure spends playing its "build up" animation after placement. */
export const BUILDUP_TICKS = 24;

/** How long the nuke countdown runs after launch, in ticks. */
export const NUKE_COUNTDOWN_TICKS = 300;
