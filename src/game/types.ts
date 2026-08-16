export type Team = "T" | "CT";

export type HitZone = "head" | "body" | "legs";

export interface AABB {
  minX: number;
  minY: number;
  minZ: number;
  maxX: number;
  maxY: number;
  maxZ: number;
}

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface WeaponDef {
  id: string;
  name: string;
  slot: 1 | 2 | 3;
  price: number;
  damage: number;
  armorPen: number;
  headMultiplier: number;
  rpm: number;
  magSize: number;
  reserve: number;
  reloadTime: number;
  spread: number;
  moveSpread: number;
  recoilPitch: number;
  recoilYaw: number;
  automatic: boolean;
  scoped: boolean;
  pellets: number;
}

export interface WeaponState {
  def: WeaponDef;
  clip: number;
  reserve: number;
  cooldown: number;
  reloading: number;
}

export interface KillEvent {
  attacker: string;
  victim: string;
  weapon: string;
  headshot: boolean;
  attackerTeam: Team;
  victimTeam: Team;
  attackerIsPlayer: boolean;
}

export interface ScoreRow {
  id: string;
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  isPlayer: boolean;
}
