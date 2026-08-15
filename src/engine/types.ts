/**
 * Core simulation types.
 *
 * IMPORTANT: everything under `src/engine/` must stay free of DOM / React / canvas so the whole
 * simulation can be run headless in Node (see `tests/sim/`). ESLint enforces this.
 */

// ── Basics ──────────────────────────────────────────────────────────────────

export type EntityId = number;

export type Side = "soviet" | "allied";

export type Difficulty = "easy" | "normal" | "hard";

export interface Point {
  x: number;
  y: number;
}

export interface TilePoint {
  tx: number;
  ty: number;
}

// ── Terrain ─────────────────────────────────────────────────────────────────

export const TerrainKind = {
  Grass: 0,
  Dirt: 1,
  Road: 2,
  Rough: 3,
  Water: 4,
  Cliff: 5,
  Beach: 6,
} as const;
export type TerrainKind = (typeof TerrainKind)[keyof typeof TerrainKind];

/** Ore overlay type sitting on top of a passable tile. */
export const OreKind = {
  None: 0,
  Ore: 1,
  Gem: 2,
} as const;
export type OreKind = (typeof OreKind)[keyof typeof OreKind];

/** How much a single tile can hold, in "scoops". Each scoop is worth `ORE_VALUE` credits. */
export const MAX_ORE_DENSITY = 12;

// ── Armour / weapons ────────────────────────────────────────────────────────

export const ArmorKind = {
  /** Unarmoured infantry. */
  None: "none",
  /** Sandbags, wooden structures, light emplacements. */
  Wood: "wood",
  /** Light vehicles, harvesters. */
  Light: "light",
  /** Tanks. */
  Heavy: "heavy",
  /** Concrete structures. */
  Concrete: "concrete",
} as const;
export type ArmorKind = (typeof ArmorKind)[keyof typeof ArmorKind];

export const ProjectileKind = {
  /** Bullets, tesla bolts — apply damage the moment the shot is fired. */
  Instant: "instant",
  /** Tank shells — travel fast in a straight line. */
  Ballistic: "ballistic",
  /** Rockets — travel with limited turn rate toward the target. */
  Missile: "missile",
  /** Grenades / artillery — lobbed on an arc to a ground position. */
  Lobbed: "lobbed",
  /** Short-range flame cone. */
  Flame: "flame",
} as const;
export type ProjectileKind = (typeof ProjectileKind)[keyof typeof ProjectileKind];

export interface WeaponDef {
  readonly id: string;
  readonly damage: number;
  /** Ticks between shots. */
  readonly rof: number;
  /** Range in world pixels. */
  readonly range: number;
  readonly projectile: ProjectileKind;
  /** Splash radius in world pixels; 0 = single target. */
  readonly spread: number;
  /** Damage multiplier per target armour class. */
  readonly verses: Readonly<Record<ArmorKind, number>>;
  /** Projectile travel speed in world px per tick (unused for `Instant`). */
  readonly speed: number;
  /** Can this weapon hit a target that is not a unit/structure (i.e. bare ground)? */
  readonly groundAttack: boolean;
  /** Number of shots fired per volley (burst). */
  readonly burst: number;
  /** Ticks between shots inside a burst. */
  readonly burstDelay: number;
}

// ── Units ───────────────────────────────────────────────────────────────────

export type UnitKindId =
  | "e1" // Rifle Infantry
  | "e2" // Grenadier
  | "e3" // Rocket Soldier
  | "e6" // Engineer
  | "dog" // Attack Dog
  | "harv" // Ore Truck
  | "3tnk" // Heavy Tank (Soviet)
  | "4tnk" // Mammoth Tank
  | "v2rl" // V2 Rocket Launcher
  | "mcv" // Mobile Construction Vehicle
  | "e1a" // Allied Rifle Infantry
  | "e3a" // Allied Rocket Soldier
  | "jeep" // Ranger
  | "1tnk" // Light Tank (Allied)
  | "2tnk" // Medium Tank (Allied)
  | "arty" // Artillery
  | "harva"; // Allied Ore Truck

export const UnitClass = {
  Infantry: "infantry",
  Vehicle: "vehicle",
} as const;
export type UnitClass = (typeof UnitClass)[keyof typeof UnitClass];

export interface UnitDef {
  readonly id: UnitKindId;
  readonly cls: UnitClass;
  readonly side: Side | "both";
  readonly cost: number;
  /** Ticks to produce at full power. */
  readonly buildTime: number;
  readonly hp: number;
  readonly armor: ArmorKind;
  /** World px per tick. */
  readonly speed: number;
  /** Body rotation speed, radians per tick. */
  readonly turnRate: number;
  /** Turret rotation speed, radians per tick; 0 = no independent turret. */
  readonly turretTurnRate: number;
  readonly hasTurret: boolean;
  readonly weapon: string | null;
  /** Secondary weapon (Mammoth rockets). */
  readonly weapon2: string | null;
  /** Sight radius in tiles. */
  readonly sight: number;
  /** Collision radius in world px. */
  readonly radius: number;
  /** Which structure produces it. */
  readonly producedBy: StructureKindId | null;
  /** Tech requirements (structure ids that must exist and be operational). */
  readonly requires: readonly StructureKindId[];
  /** Harvester capacity in scoops; 0 = not a harvester. */
  readonly cargoCapacity: number;
  /** Can this unit crush infantry by driving over it? */
  readonly crusher: boolean;
  /** Regenerates hp per tick (Mammoth). */
  readonly selfHeal: number;
  /** Sidebar ordering. */
  readonly order: number;
}

// ── Structures ──────────────────────────────────────────────────────────────

export type StructureKindId =
  | "conyard"
  | "power"
  | "refinery"
  | "silo"
  | "barracks"
  | "kennel"
  | "warfactory"
  | "radar"
  | "depot"
  | "flametower"
  | "tesla"
  | "wall"
  | "nukesilo"
  // Allied
  | "conyard_a"
  | "power_a"
  | "refinery_a"
  | "barracks_a"
  | "warfactory_a"
  | "pillbox"
  | "turret";

export interface StructureDef {
  readonly id: StructureKindId;
  readonly side: Side | "both";
  readonly cost: number;
  readonly buildTime: number;
  readonly hp: number;
  readonly armor: ArmorKind;
  /** Footprint in tiles. */
  readonly w: number;
  readonly h: number;
  readonly powerProduced: number;
  readonly powerConsumed: number;
  readonly weapon: string | null;
  readonly hasTurret: boolean;
  readonly turretTurnRate: number;
  readonly sight: number;
  readonly requires: readonly StructureKindId[];
  /** Provides radar/minimap when powered. */
  readonly providesRadar: boolean;
  /** Ore storage capacity added. */
  readonly storage: number;
  /** Harvesters can unload here. */
  readonly isRefinery: boolean;
  /** Which production queue this structure unlocks/serves. */
  readonly producesQueue: QueueKind | null;
  /** Tile offset (relative to the structure origin) where produced units appear. */
  readonly exit: TilePoint | null;
  /** Sidebar tab. */
  readonly tab: SidebarTab;
  readonly order: number;
  /** Superweapon charge time in ticks; 0 = none. */
  readonly superweaponCharge: number;
}

export const QueueKind = {
  Structure: "structure",
  Infantry: "infantry",
  Vehicle: "vehicle",
} as const;
export type QueueKind = (typeof QueueKind)[keyof typeof QueueKind];

export const SidebarTab = {
  Structures: "structures",
  Defense: "defense",
  Infantry: "infantry",
  Vehicles: "vehicles",
} as const;
export type SidebarTab = (typeof SidebarTab)[keyof typeof SidebarTab];

// ── Orders ──────────────────────────────────────────────────────────────────

export type Order =
  | { type: "idle" }
  | { type: "guard" }
  | { type: "move"; x: number; y: number }
  | { type: "attackMove"; x: number; y: number }
  | { type: "attack"; targetId: EntityId }
  | { type: "forceFire"; x: number; y: number }
  | { type: "harvest"; tx: number; ty: number }
  | { type: "deliver"; refineryId: EntityId }
  | { type: "enter"; targetId: EntityId }
  | { type: "repairAt"; targetId: EntityId }
  | { type: "deploy" };

// ── Entities ────────────────────────────────────────────────────────────────

export const HarvestState = {
  Seeking: "seeking",
  Harvesting: "harvesting",
  Returning: "returning",
  Unloading: "unloading",
} as const;
export type HarvestState = (typeof HarvestState)[keyof typeof HarvestState];

export interface Unit {
  readonly id: EntityId;
  readonly kind: UnitKindId;
  readonly side: Side;
  /** World-pixel centre. */
  x: number;
  y: number;
  /** Position at the start of the current tick, used for render interpolation. */
  px: number;
  py: number;
  /** Body facing in radians (0 = east, grows clockwise on screen). */
  facing: number;
  turret: number;
  hp: number;
  order: Order;
  /** Order to resume after the current one finishes (used for queued waypoints). */
  queued: Order[];
  path: TilePoint[];
  pathIndex: number;
  /** Ticks until the unit may fire again. */
  cooldown: number;
  /** Remaining shots in the current burst. */
  burstLeft: number;
  burstCooldown: number;
  /** Current auto-acquired or ordered target. */
  targetId: EntityId;
  /** Harvester state. */
  cargo: number;
  cargoKind: OreKind;
  harvestState: HarvestState;
  homeRefinery: EntityId;
  /** Ticks spent stuck; used to trigger a re-path or scatter. */
  blockedTicks: number;
  /** Ticks remaining of the unload/harvest animation. */
  actionTimer: number;
  /** Set when the unit has been destroyed this tick and is awaiting removal. */
  dead: boolean;
  /** Ticks since spawn — used for staggered AI thinking and effects. */
  age: number;
  /** Repeat-path throttle. */
  repathCooldown: number;
  /** Veterancy-free, but track kills for the score screen. */
  kills: number;
}

export interface Structure {
  readonly id: EntityId;
  readonly kind: StructureKindId;
  readonly side: Side;
  /** Top-left tile of the footprint. */
  readonly tx: number;
  readonly ty: number;
  hp: number;
  /** 0..1 build-up animation progress when first placed. */
  buildProgress: number;
  turret: number;
  cooldown: number;
  burstLeft: number;
  burstCooldown: number;
  targetId: EntityId;
  /** Rally point in world px (production structures). */
  rallyX: number;
  rallyY: number;
  /** Whether the power grid can currently run it. */
  online: boolean;
  /** Superweapon charge in ticks. */
  charge: number;
  dead: boolean;
  age: number;
  /** Harvester currently docked (refineries). */
  dockedUnit: EntityId;
  /** Repair mode active (player clicked repair). */
  repairing: boolean;
}

export const EffectKind = {
  Explosion: "explosion",
  SmallExplosion: "smallExplosion",
  BigExplosion: "bigExplosion",
  MuzzleFlash: "muzzleFlash",
  Tracer: "tracer",
  Spark: "spark",
  Smoke: "smoke",
  Fire: "fire",
  Crater: "crater",
  Wreck: "wreck",
  TeslaArc: "teslaArc",
  Nuke: "nuke",
  Shockwave: "shockwave",
  Corpse: "corpse",
  Ripple: "ripple",
} as const;
export type EffectKind = (typeof EffectKind)[keyof typeof EffectKind];

export interface Effect {
  readonly id: EntityId;
  readonly kind: EffectKind;
  x: number;
  y: number;
  /** Secondary point (tracers, tesla arcs). */
  x2: number;
  y2: number;
  age: number;
  life: number;
  /** Deterministic per-effect randomness seed. */
  seed: number;
  rot: number;
  scale: number;
  side: Side | null;
}

export interface Projectile {
  readonly id: EntityId;
  readonly weapon: string;
  readonly side: Side;
  readonly ownerId: EntityId;
  x: number;
  y: number;
  px: number;
  py: number;
  /** Target position, updated for homing projectiles. */
  tx: number;
  ty: number;
  targetId: EntityId;
  vx: number;
  vy: number;
  /** For lobbed projectiles: total flight time and elapsed, used for the arc. */
  age: number;
  life: number;
  dead: boolean;
}

// ── Production ──────────────────────────────────────────────────────────────

export interface QueueItem {
  readonly what: UnitKindId | StructureKindId;
  readonly isStructure: boolean;
  /** Ticks of progress accumulated. */
  progress: number;
  /** Credits already spent (drip payment). */
  paid: number;
}

export const QueueStatus = {
  Empty: "empty",
  Building: "building",
  OnHold: "onHold",
  Ready: "ready",
} as const;
export type QueueStatus = (typeof QueueStatus)[keyof typeof QueueStatus];

export interface ProductionQueue {
  readonly kind: QueueKind;
  items: QueueItem[];
  status: QueueStatus;
}

// ── Player ──────────────────────────────────────────────────────────────────

export interface PlayerStats {
  unitsBuilt: number;
  unitsLost: number;
  structuresBuilt: number;
  structuresLost: number;
  enemiesDestroyed: number;
  oreHarvested: number;
}

export interface Player {
  readonly side: Side;
  readonly isHuman: boolean;
  credits: number;
  /** Credits currently sitting in silos (capacity-limited). */
  storage: number;
  powerProduced: number;
  powerConsumed: number;
  queues: Record<QueueKind, ProductionQueue>;
  stats: PlayerStats;
  defeated: boolean;
}

// ── Game-level ──────────────────────────────────────────────────────────────

export const GameStatus = {
  Playing: "playing",
  Victory: "victory",
  Defeat: "defeat",
} as const;
export type GameStatus = (typeof GameStatus)[keyof typeof GameStatus];

export interface EvaEntry {
  readonly id: number;
  readonly key: EvaKey;
  readonly tick: number;
  readonly side: Side;
  /** Optional world position to jump to when the player presses Space. */
  readonly x: number;
  readonly y: number;
}

export type EvaKey =
  | "constructionComplete"
  | "unitReady"
  | "buildingInfo"
  | "newConstructionOptions"
  | "insufficientFunds"
  | "silosNeeded"
  | "lowPower"
  | "baseUnderAttack"
  | "unitLost"
  | "structureLost"
  | "cannotDeployHere"
  | "unableToComply"
  | "primaryBuildingSelected"
  | "missionAccomplished"
  | "missionFailed"
  | "nuclearWeaponAvailable"
  | "nuclearWeaponLaunched"
  | "radarOnline"
  | "radarOffline"
  | "repairing"
  | "buildingCaptured"
  | "ourBaseIsUnderAttack";
