export type WeaponId = "rifle" | "smg" | "pistol" | "sniper" | "knife";
export type FireMode = "auto" | "semi" | "bolt" | "melee";

export interface WeaponSpec {
  id: WeaponId;
  name: string;
  slot: number;
  mode: FireMode;
  sound: "rifle" | "smg" | "pistol" | "sniper";
  /** Base body damage before armour and distance falloff. */
  damage: number;
  headMultiplier: number;
  legMultiplier: number;
  armorPenetration: number;
  /** Rounds per minute. */
  rpm: number;
  magSize: number;
  reserveAmmo: number;
  reloadTime: number;
  /** Inaccuracy in degrees for different player states. */
  spread: {
    stand: number;
    moving: number;
    air: number;
    crouch: number;
    perShot: number;
    max: number;
  };
  recoil: {
    vertical: number;
    horizontal: number;
    recovery: number;
    /** Multiplier per shot index, giving each gun a recognisable spray. */
    pattern: Array<[number, number]>;
  };
  /** Damage stays at 100% until falloffStart and decays to falloffMin at falloffEnd. */
  falloffStart: number;
  falloffEnd: number;
  falloffMin: number;
  range: number;
  moveSpeedFactor: number;
  zoomFov: number | null;
  zoomSensitivity: number;
  scoped: boolean;
  reloadStages: Array<{ at: number; sound: "out" | "in" | "bolt" }>;
  meleeRange?: number;
  meleeBackstab?: number;
}

const sprayPattern = (points: Array<[number, number]>): Array<[number, number]> => points;

export const WEAPONS: Record<WeaponId, WeaponSpec> = {
  rifle: {
    id: "rifle",
    name: "AR-47",
    slot: 1,
    mode: "auto",
    sound: "rifle",
    damage: 33,
    headMultiplier: 4,
    legMultiplier: 0.75,
    armorPenetration: 0.78,
    rpm: 600,
    magSize: 30,
    reserveAmmo: 120,
    reloadTime: 2.4,
    spread: {
      stand: 0.35,
      moving: 3.6,
      air: 8,
      crouch: 0.18,
      perShot: 0.22,
      max: 4.5,
    },
    recoil: {
      vertical: 1.55,
      horizontal: 0.42,
      recovery: 7.5,
      pattern: sprayPattern([
        [0, 1],
        [0.1, 1.1],
        [0.15, 1.15],
        [0.1, 1.1],
        [-0.4, 0.95],
        [-0.9, 0.8],
        [-1.2, 0.7],
        [-1, 0.6],
        [-0.4, 0.55],
        [0.6, 0.5],
        [1.3, 0.5],
        [1.5, 0.45],
        [1.2, 0.45],
        [0.5, 0.4],
        [-0.6, 0.4],
        [-1.3, 0.4],
      ]),
    },
    falloffStart: 22,
    falloffEnd: 70,
    falloffMin: 0.6,
    range: 120,
    moveSpeedFactor: 0.92,
    zoomFov: 65,
    zoomSensitivity: 0.75,
    scoped: false,
    reloadStages: [
      { at: 0.25, sound: "out" },
      { at: 0.62, sound: "in" },
      { at: 0.9, sound: "bolt" },
    ],
  },
  smg: {
    id: "smg",
    name: "MP-5K",
    slot: 2,
    mode: "auto",
    sound: "smg",
    damage: 24,
    headMultiplier: 3.6,
    legMultiplier: 0.8,
    armorPenetration: 0.6,
    rpm: 800,
    magSize: 30,
    reserveAmmo: 120,
    reloadTime: 2.1,
    spread: {
      stand: 0.5,
      moving: 1.6,
      air: 6,
      crouch: 0.3,
      perShot: 0.16,
      max: 3.6,
    },
    recoil: {
      vertical: 0.95,
      horizontal: 0.38,
      recovery: 9,
      pattern: sprayPattern([
        [0, 1],
        [0.2, 1],
        [0.3, 0.9],
        [0.1, 0.85],
        [-0.5, 0.8],
        [-0.9, 0.7],
        [-0.7, 0.6],
        [0.2, 0.55],
        [0.9, 0.5],
        [1.1, 0.45],
        [0.4, 0.45],
        [-0.6, 0.4],
      ]),
    },
    falloffStart: 14,
    falloffEnd: 45,
    falloffMin: 0.5,
    range: 90,
    moveSpeedFactor: 1,
    zoomFov: null,
    zoomSensitivity: 1,
    scoped: false,
    reloadStages: [
      { at: 0.25, sound: "out" },
      { at: 0.65, sound: "in" },
      { at: 0.92, sound: "bolt" },
    ],
  },
  pistol: {
    id: "pistol",
    name: "P-9",
    slot: 3,
    mode: "semi",
    sound: "pistol",
    damage: 27,
    headMultiplier: 4,
    legMultiplier: 0.75,
    armorPenetration: 0.5,
    rpm: 420,
    magSize: 12,
    reserveAmmo: 60,
    reloadTime: 1.9,
    spread: {
      stand: 0.5,
      moving: 2.4,
      air: 6,
      crouch: 0.3,
      perShot: 0.35,
      max: 4,
    },
    recoil: {
      vertical: 1.5,
      horizontal: 0.3,
      recovery: 11,
      pattern: sprayPattern([
        [0, 1],
        [0.3, 0.95],
        [-0.3, 0.9],
        [0.4, 0.85],
      ]),
    },
    falloffStart: 16,
    falloffEnd: 50,
    falloffMin: 0.5,
    range: 90,
    moveSpeedFactor: 1.05,
    zoomFov: null,
    zoomSensitivity: 1,
    scoped: false,
    reloadStages: [
      { at: 0.3, sound: "out" },
      { at: 0.7, sound: "in" },
    ],
  },
  sniper: {
    id: "sniper",
    name: "AWM-S",
    slot: 4,
    mode: "bolt",
    sound: "sniper",
    damage: 118,
    headMultiplier: 2.5,
    legMultiplier: 0.75,
    armorPenetration: 0.97,
    rpm: 41,
    magSize: 5,
    reserveAmmo: 25,
    reloadTime: 3.4,
    spread: {
      stand: 1.6,
      moving: 8,
      air: 14,
      crouch: 1.2,
      perShot: 1.4,
      max: 12,
    },
    recoil: {
      vertical: 3.4,
      horizontal: 0.5,
      recovery: 5,
      pattern: sprayPattern([[0, 1]]),
    },
    falloffStart: 60,
    falloffEnd: 130,
    falloffMin: 0.8,
    range: 200,
    moveSpeedFactor: 0.76,
    zoomFov: 18,
    zoomSensitivity: 0.35,
    scoped: true,
    reloadStages: [
      { at: 0.2, sound: "out" },
      { at: 0.6, sound: "in" },
      { at: 0.88, sound: "bolt" },
    ],
  },
  knife: {
    id: "knife",
    name: "军刀",
    slot: 5,
    mode: "melee",
    sound: "pistol",
    damage: 55,
    headMultiplier: 1.4,
    legMultiplier: 1,
    armorPenetration: 0.85,
    rpm: 140,
    magSize: Infinity,
    reserveAmmo: 0,
    reloadTime: 0,
    spread: {
      stand: 0,
      moving: 0,
      air: 0,
      crouch: 0,
      perShot: 0,
      max: 0,
    },
    recoil: {
      vertical: 0.4,
      horizontal: 0.2,
      recovery: 14,
      pattern: sprayPattern([[0, 1]]),
    },
    falloffStart: 2,
    falloffEnd: 2.2,
    falloffMin: 1,
    range: 2.2,
    moveSpeedFactor: 1.15,
    zoomFov: null,
    zoomSensitivity: 1,
    scoped: false,
    reloadStages: [],
    meleeRange: 2.2,
    meleeBackstab: 200,
  },
};

export const WEAPON_ORDER: WeaponId[] = ["rifle", "smg", "pistol", "sniper", "knife"];

export class WeaponState {
  readonly spec: WeaponSpec;
  mag: number;
  reserve: number;
  cooldown = 0;
  reloadTimer = 0;
  reloading = false;
  shotIndex = 0;
  sinceLastShot = 999;
  private reloadStageIndex = 0;

  constructor(spec: WeaponSpec) {
    this.spec = spec;
    this.mag = spec.magSize;
    this.reserve = spec.reserveAmmo;
  }

  get isMelee(): boolean {
    return this.spec.mode === "melee";
  }

  get canReload(): boolean {
    return (
      !this.isMelee &&
      !this.reloading &&
      this.mag < this.spec.magSize &&
      this.reserve > 0
    );
  }

  get empty(): boolean {
    return !this.isMelee && this.mag <= 0;
  }

  resetAmmo(): void {
    this.mag = this.spec.magSize;
    this.reserve = this.spec.reserveAmmo;
    this.reloading = false;
    this.reloadTimer = 0;
    this.cooldown = 0;
    this.shotIndex = 0;
  }

  startReload(): boolean {
    if (!this.canReload) return false;
    this.reloading = true;
    this.reloadTimer = 0;
    this.reloadStageIndex = 0;
    return true;
  }

  cancelReload(): void {
    this.reloading = false;
    this.reloadTimer = 0;
    this.reloadStageIndex = 0;
  }

  /** Advances timers; returns the reload sound cue that should play this frame. */
  update(dt: number): "out" | "in" | "bolt" | null {
    this.cooldown = Math.max(0, this.cooldown - dt);
    this.sinceLastShot += dt;
    if (this.sinceLastShot > 0.35) this.shotIndex = 0;

    if (!this.reloading) return null;
    this.reloadTimer += dt;

    const stages = this.spec.reloadStages;
    let cue: "out" | "in" | "bolt" | null = null;
    while (
      this.reloadStageIndex < stages.length &&
      this.reloadTimer >= stages[this.reloadStageIndex].at * this.spec.reloadTime
    ) {
      cue = stages[this.reloadStageIndex].sound;
      this.reloadStageIndex++;
    }

    if (this.reloadTimer >= this.spec.reloadTime) {
      const needed = this.spec.magSize - this.mag;
      const taken = Math.min(needed, this.reserve);
      this.mag += taken;
      this.reserve -= taken;
      this.reloading = false;
      this.reloadTimer = 0;
      this.reloadStageIndex = 0;
      this.shotIndex = 0;
    }
    return cue;
  }

  consume(): void {
    if (!this.isMelee) this.mag--;
    this.cooldown = 60 / this.spec.rpm;
    this.sinceLastShot = 0;
    this.shotIndex++;
  }
}
