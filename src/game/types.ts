export type Team = 'CT' | 'T';

export type WeaponType = 'knife' | 'glock' | 'deagle' | 'mp5' | 'ak47' | 'm4a1' | 'awp' | 'c4' | 'hegrenade' | 'flashbang' | 'smokegrenade';

export type WeaponCategory = 'melee' | 'pistol' | 'smg' | 'rifle' | 'sniper' | 'grenade' | 'utility';

export interface WeaponConfig {
  id: WeaponType;
  name: string;
  category: WeaponCategory;
  price: number;
  damage: number;
  headshotMultiplier: number;
  fireRate: number; // shots per second
  magazineSize: number;
  reserveAmmo: number;
  reloadTime: number; // in seconds
  spread: number;
  recoilVertical: number;
  recoilHorizontal: number;
  range: number;
  speedMultiplier: number;
  hasScope?: boolean;
  scopeMagnification?: number;
  teamExclusive?: Team;
  killReward: number;
  soundType: string;
  description: string;
}

export interface WeaponSlotState {
  config: WeaponConfig;
  currentAmmo: number;
  reserveAmmo: number;
}

export interface PlayerStats {
  health: number;
  maxHealth: number;
  armor: number;
  hasHelmet: boolean;
  money: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  isPlanting?: boolean;
  isDefusing?: boolean;
  hasDefuseKit: boolean;
}

export interface KillfeedEntry {
  id: string;
  killer: string;
  killerTeam: Team;
  victim: string;
  victimTeam: Team;
  weapon: WeaponType;
  isHeadshot: boolean;
  wallbang: boolean;
  timestamp: number;
}

export type GameState = 'lobby' | 'buy_time' | 'in_round' | 'round_end' | 'match_end';

export interface ScoreboardPlayer {
  id: string;
  name: string;
  team: Team;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  ping: number;
  isBot: boolean;
  isAlive: boolean;
  money: number;
}

export interface BombState {
  isPlanted: boolean;
  plantedAt?: number;
  site?: 'A' | 'B';
  position?: [number, number, number];
  isDefused: boolean;
  isExploded: boolean;
  defuseProgress: number; // 0 to 1
  plantProgress: number; // 0 to 1
}

export interface GrenadeEntity {
  id: string;
  type: 'hegrenade' | 'flashbang' | 'smokegrenade';
  position: { x: number; y: number; z: number };
  velocity: { x: number; y: number; z: number };
  fuseTime: number;
  thrownBy: string;
  team: Team;
}

export interface SmokeCloud {
  id: string;
  position: { x: number; y: number; z: number };
  radius: number;
  createdAt: number;
  duration: number;
}

export interface DecalMark {
  position: [number, number, number];
  normal: [number, number, number];
  type: 'bullet' | 'blood' | 'scorch';
  size: number;
  color?: string;
}
