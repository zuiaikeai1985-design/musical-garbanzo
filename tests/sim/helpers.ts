import { expect } from "vitest";
import type { World } from "../../src/engine/world";

/**
 * Guards against the classes of bug that are invisible in a screenshot but ruin a match:
 * NaN positions, units escaping the map, entity leaks and exceptions deep in a system.
 */
export function assertWorldSane(world: World, label: string): void {
  for (const u of world.units) {
    expect(Number.isFinite(u.x), `${label}: unit ${u.id} (${u.kind}) x is ${u.x}`).toBe(true);
    expect(Number.isFinite(u.y), `${label}: unit ${u.id} (${u.kind}) y is ${u.y}`).toBe(true);
    expect(Number.isFinite(u.facing), `${label}: unit ${u.id} facing is ${u.facing}`).toBe(true);
    expect(u.x, `${label}: unit ${u.id} left the map`).toBeGreaterThanOrEqual(-1);
    expect(u.y, `${label}: unit ${u.id} left the map`).toBeGreaterThanOrEqual(-1);
    expect(u.x, `${label}: unit ${u.id} left the map`).toBeLessThanOrEqual(
      world.grid.worldWidth + 1,
    );
    expect(u.y, `${label}: unit ${u.id} left the map`).toBeLessThanOrEqual(
      world.grid.worldHeight + 1,
    );
    expect(Number.isFinite(u.hp), `${label}: unit ${u.id} hp is ${u.hp}`).toBe(true);
  }
  for (const s of world.structures) {
    expect(Number.isFinite(s.hp), `${label}: structure ${s.id} hp is ${s.hp}`).toBe(true);
  }
  for (const p of world.projectiles) {
    expect(Number.isFinite(p.x) && Number.isFinite(p.y), `${label}: projectile NaN`).toBe(true);
  }
}
