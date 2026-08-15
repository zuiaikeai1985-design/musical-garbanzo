/**
 * Seeded pseudo-random number generator.
 *
 * The engine never calls `Math.random()` (ESLint enforces this) so that headless simulations are
 * reproducible: the same seed and the same command stream always produce the same match.
 */
export class Rng {
  private state: number;

  constructor(seed: number) {
    // Avoid the degenerate all-zero state.
    this.state = (seed >>> 0) || 0x9e3779b9;
  }

  /** mulberry32 — small, fast, and good enough for a game. */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** Uniform float in [min, max). */
  range(min: number, max: number): number {
    return min + this.next() * (max - min);
  }

  /** Uniform integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1));
  }

  /** True with probability `p`. */
  chance(p: number): boolean {
    return this.next() < p;
  }

  pick<T>(items: readonly T[]): T {
    return items[this.int(0, items.length - 1)];
  }

  /** Snapshot / restore so saves and tests can fork deterministically. */
  getState(): number {
    return this.state;
  }

  setState(state: number): void {
    this.state = state >>> 0;
  }
}

/**
 * Stateless hash → [0,1). Used for per-entity, per-frame visual jitter that must be stable across
 * renders (e.g. sprite variants, explosion particle offsets) without consuming the shared RNG.
 */
export function hash01(a: number, b = 0, c = 0): number {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13) ^ b, 0xc2b2ae35);
  h = Math.imul(h ^ (h >>> 16) ^ c, 0x27d4eb2f);
  return ((h ^ (h >>> 15)) >>> 0) / 4294967296;
}
