import type { WeaponDef, WeaponState } from "./types";

export const WEAPONS: Record<string, WeaponDef> = {
  ak47: {
    id: "ak47",
    name: "AK-47",
    slot: 1,
    price: 2700,
    damage: 36,
    armorPen: 0.775,
    headMultiplier: 4,
    rpm: 600,
    magSize: 30,
    reserve: 90,
    reloadTime: 2.4,
    spread: 0.012,
    moveSpread: 0.055,
    recoilPitch: 0.018,
    recoilYaw: 0.007,
    automatic: true,
    scoped: false,
    pellets: 1,
  },
  m4a4: {
    id: "m4a4",
    name: "M4A4",
    slot: 1,
    price: 3100,
    damage: 33,
    armorPen: 0.7,
    headMultiplier: 4,
    rpm: 666,
    magSize: 30,
    reserve: 90,
    reloadTime: 3.1,
    spread: 0.01,
    moveSpread: 0.042,
    recoilPitch: 0.014,
    recoilYaw: 0.006,
    automatic: true,
    scoped: false,
    pellets: 1,
  },
  awp: {
    id: "awp",
    name: "AWP",
    slot: 1,
    price: 4750,
    damage: 115,
    armorPen: 0.975,
    headMultiplier: 4,
    rpm: 41,
    magSize: 10,
    reserve: 30,
    reloadTime: 3.6,
    spread: 0.002,
    moveSpread: 0.12,
    recoilPitch: 0.05,
    recoilYaw: 0.01,
    automatic: false,
    scoped: true,
    pellets: 1,
  },
  deagle: {
    id: "deagle",
    name: "Desert Eagle",
    slot: 2,
    price: 700,
    damage: 53,
    armorPen: 0.93,
    headMultiplier: 4,
    rpm: 267,
    magSize: 7,
    reserve: 35,
    reloadTime: 2.2,
    spread: 0.016,
    moveSpread: 0.08,
    recoilPitch: 0.04,
    recoilYaw: 0.012,
    automatic: false,
    scoped: false,
    pellets: 1,
  },
  usp: {
    id: "usp",
    name: "USP-S",
    slot: 2,
    price: 200,
    damage: 35,
    armorPen: 0.505,
    headMultiplier: 4,
    rpm: 352,
    magSize: 12,
    reserve: 24,
    reloadTime: 2.2,
    spread: 0.01,
    moveSpread: 0.035,
    recoilPitch: 0.012,
    recoilYaw: 0.004,
    automatic: false,
    scoped: false,
    pellets: 1,
  },
  glock: {
    id: "glock",
    name: "Glock-18",
    slot: 2,
    price: 200,
    damage: 30,
    armorPen: 0.47,
    headMultiplier: 4,
    rpm: 400,
    magSize: 20,
    reserve: 120,
    reloadTime: 2.2,
    spread: 0.014,
    moveSpread: 0.04,
    recoilPitch: 0.01,
    recoilYaw: 0.005,
    automatic: false,
    scoped: false,
    pellets: 1,
  },
  knife: {
    id: "knife",
    name: "Knife",
    slot: 3,
    price: 0,
    damage: 40,
    armorPen: 0.85,
    headMultiplier: 1.5,
    rpm: 120,
    magSize: 1,
    reserve: 0,
    reloadTime: 0,
    spread: 0,
    moveSpread: 0,
    recoilPitch: 0.01,
    recoilYaw: 0,
    automatic: false,
    scoped: false,
    pellets: 1,
  },
};

export const BUY_ORDER = ["ak47", "m4a4", "awp", "deagle", "usp", "glock"] as const;

export function createWeaponState(id: string): WeaponState {
  const def = WEAPONS[id];
  if (!def) throw new Error(`Unknown weapon ${id}`);
  return {
    def,
    clip: def.magSize,
    reserve: def.reserve,
    cooldown: 0,
    reloading: 0,
  };
}

export function fireInterval(def: WeaponDef): number {
  return 60 / def.rpm;
}

export function canFire(weapon: WeaponState): boolean {
  if (weapon.def.id === "knife") {
    return weapon.cooldown <= 0;
  }
  return weapon.cooldown <= 0 && weapon.reloading <= 0 && weapon.clip > 0;
}

export function beginReload(weapon: WeaponState): boolean {
  if (weapon.def.id === "knife") return false;
  if (weapon.reloading > 0) return false;
  if (weapon.clip >= weapon.def.magSize) return false;
  if (weapon.reserve <= 0) return false;
  weapon.reloading = weapon.def.reloadTime;
  return true;
}

export function finishReload(weapon: WeaponState): void {
  const need = weapon.def.magSize - weapon.clip;
  const take = Math.min(need, weapon.reserve);
  weapon.clip += take;
  weapon.reserve -= take;
  weapon.reloading = 0;
}

export function consumeShot(weapon: WeaponState): boolean {
  if (!canFire(weapon)) return false;
  if (weapon.def.id !== "knife") weapon.clip -= 1;
  weapon.cooldown = fireInterval(weapon.def);
  return true;
}

export function tickWeapon(weapon: WeaponState, dt: number): boolean {
  if (weapon.cooldown > 0) weapon.cooldown = Math.max(0, weapon.cooldown - dt);
  if (weapon.reloading > 0) {
    weapon.reloading = Math.max(0, weapon.reloading - dt);
    if (weapon.reloading === 0) {
      finishReload(weapon);
      return true;
    }
  }
  return false;
}

export function currentSpread(
  weapon: WeaponState,
  moving: boolean,
  airborne: boolean,
  crouching: boolean,
  spraying: number,
): number {
  if (weapon.def.id === "knife") return 0;
  let spread = weapon.def.spread;
  if (moving) spread += weapon.def.moveSpread;
  if (airborne) spread += 0.08;
  if (crouching) spread *= 0.55;
  spread += spraying * 0.004;
  return spread;
}
