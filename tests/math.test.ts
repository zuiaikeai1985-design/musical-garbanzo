import { describe, expect, it } from "vitest";
import {
  aabbFromCenter,
  aabbFromFoot,
  aabbOverlap,
  applyDamage,
  formatClock,
  normalize2,
  rayAABB,
  raySphere,
  resolveCapsule,
} from "../src/game/math";

describe("aabbOverlap", () => {
  it("detects overlapping boxes", () => {
    const a = aabbFromCenter(0, 1, 0, 2, 2, 2);
    const b = aabbFromCenter(1, 1, 0, 2, 2, 2);
    expect(aabbOverlap(a, b)).toBe(true);
  });

  it("rejects separated boxes", () => {
    const a = aabbFromCenter(0, 1, 0, 2, 2, 2);
    const b = aabbFromCenter(5, 1, 0, 2, 2, 2);
    expect(aabbOverlap(a, b)).toBe(false);
  });
});

describe("resolveCapsule", () => {
  it("stands on the floor at y=0", () => {
    const out = resolveCapsule({ x: 0, y: -0.4, z: 0 }, { x: 0, y: -0.4, z: 0 }, 0.4, 1.7, []);
    expect(out.pos.y).toBe(0);
    expect(out.grounded).toBe(true);
    expect(out.vel.y).toBe(0);
  });

  it("does not walk through a wall", () => {
    const wall = aabbFromCenter(2, 2, 0, 1, 4, 4);
    const out = resolveCapsule({ x: 0, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }, 0.4, 1.7, [wall]);
    expect(out.pos.x).toBeLessThan(1.6);
  });

  it("lands on a crate", () => {
    const crate = aabbFromCenter(0, 0.5, 0, 2, 1, 2);
    const out = resolveCapsule({ x: 0, y: 1.2, z: 0 }, { x: 0, y: -0.4, z: 0 }, 0.35, 1.7, [crate]);
    expect(out.grounded).toBe(true);
    expect(out.pos.y).toBeGreaterThan(0.99);
  });
});

describe("rays", () => {
  it("hits a sphere", () => {
    const t = raySphere({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -5 }, 0.5);
    expect(t).toBeCloseTo(4.5, 5);
  });

  it("misses a sphere", () => {
    const t = raySphere({ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 0, y: 0, z: -5 }, 0.5);
    expect(t).toBeNull();
  });

  it("hits an AABB", () => {
    const box = aabbFromFoot(0, 0, -6, 0.5, 1.8);
    const t = rayAABB({ x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: -1 }, box);
    expect(t).not.toBeNull();
    expect(t ?? 0).toBeGreaterThan(4);
  });
});

describe("applyDamage", () => {
  it("one-taps an unarmored head with AK-like damage", () => {
    const out = applyDamage(100, 0, 36, 0.775, "head", false);
    expect(out.health).toBe(0);
    expect(out.dealt).toBe(144);
  });

  it("helmet reduces head damage versus a pistol", () => {
    const bare = applyDamage(100, 0, 35, 0.505, "head", false);
    const helm = applyDamage(100, 100, 35, 0.505, "head", true);
    expect(bare.health).toBe(0);
    expect(helm.health).toBeGreaterThan(0);
    expect(helm.armor).toBeLessThan(100);
    expect(helm.dealt).toBeLessThan(bare.dealt);
  });

  it("legs deal 75% damage", () => {
    const out = applyDamage(100, 0, 40, 0.5, "legs", false);
    expect(out.dealt).toBe(30);
    expect(out.health).toBe(70);
  });
});

describe("helpers", () => {
  it("formats the match clock", () => {
    expect(formatClock(125)).toBe("2:05");
    expect(formatClock(0)).toBe("0:00");
  });

  it("normalizes a 2d vector", () => {
    const n = normalize2(3, 4);
    expect(n.x).toBeCloseTo(0.6);
    expect(n.z).toBeCloseTo(0.8);
  });
});
