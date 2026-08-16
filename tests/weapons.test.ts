import { describe, expect, it } from "vitest";
import {
  beginReload,
  canFire,
  consumeShot,
  createWeaponState,
  currentSpread,
  finishReload,
  fireInterval,
  tickWeapon,
  WEAPONS,
} from "../src/game/weapons";

describe("weapon fire cycle", () => {
  it("consumes a rifle round and applies cooldown", () => {
    const ak = createWeaponState("ak47");
    expect(canFire(ak)).toBe(true);
    expect(consumeShot(ak)).toBe(true);
    expect(ak.clip).toBe(29);
    expect(ak.cooldown).toBeCloseTo(fireInterval(WEAPONS.ak47));
    expect(canFire(ak)).toBe(false);
  });

  it("reloads from reserve", () => {
    const usp = createWeaponState("usp");
    usp.clip = 3;
    expect(beginReload(usp)).toBe(true);
    expect(tickWeapon(usp, 2.2)).toBe(true);
    expect(usp.clip).toBe(12);
    expect(usp.reserve).toBe(15);
  });

  it("does not reload a full mag", () => {
    const glock = createWeaponState("glock");
    expect(beginReload(glock)).toBe(false);
  });

  it("knife never spends ammo", () => {
    const knife = createWeaponState("knife");
    expect(consumeShot(knife)).toBe(true);
    expect(knife.clip).toBe(1);
  });
});

describe("spread", () => {
  it("increases when moving or airborne", () => {
    const ak = createWeaponState("ak47");
    const still = currentSpread(ak, false, false, false, 0);
    const run = currentSpread(ak, true, false, false, 0);
    const jump = currentSpread(ak, false, true, false, 0);
    const crouch = currentSpread(ak, false, false, true, 0);
    expect(run).toBeGreaterThan(still);
    expect(jump).toBeGreaterThan(still);
    expect(crouch).toBeLessThan(still);
  });
});

describe("finishReload", () => {
  it("partially fills when reserve is short", () => {
    const deagle = createWeaponState("deagle");
    deagle.clip = 1;
    deagle.reserve = 3;
    finishReload(deagle);
    expect(deagle.clip).toBe(4);
    expect(deagle.reserve).toBe(0);
  });
});
