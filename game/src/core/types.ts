export type Difficulty = "easy" | "normal" | "hard";

export interface DifficultyProfile {
  label: string;
  /** Seconds before a bot reacts to spotting the player. */
  reactionTime: [number, number];
  /** Cone of fire in degrees; lower is deadlier. */
  aimSpread: number;
  /** Multiplier applied to the damage bots deal. */
  damageScale: number;
  /** Bots per round: base + perRound * (round - 1). */
  baseBots: number;
  botsPerRound: number;
  /** Simultaneous bots alive. */
  maxAlive: number;
  botHealth: number;
  botSpeed: number;
  /** How long a bot keeps firing before pausing. */
  burst: [number, number];
  restBetweenBursts: [number, number];
}

export const DIFFICULTIES: Record<Difficulty, DifficultyProfile> = {
  easy: {
    label: "新兵",
    reactionTime: [0.55, 0.95],
    aimSpread: 4.2,
    damageScale: 0.55,
    baseBots: 3,
    botsPerRound: 1,
    maxAlive: 3,
    botHealth: 100,
    botSpeed: 2.9,
    burst: [0.18, 0.32],
    restBetweenBursts: [0.7, 1.4],
  },
  normal: {
    label: "士兵",
    reactionTime: [0.32, 0.6],
    aimSpread: 2.6,
    damageScale: 0.85,
    baseBots: 4,
    botsPerRound: 1,
    maxAlive: 4,
    botHealth: 100,
    botSpeed: 3.3,
    burst: [0.25, 0.5],
    restBetweenBursts: [0.45, 0.95],
  },
  hard: {
    label: "特种兵",
    reactionTime: [0.16, 0.32],
    aimSpread: 1.5,
    damageScale: 1.15,
    baseBots: 5,
    botsPerRound: 2,
    maxAlive: 6,
    botHealth: 110,
    botSpeed: 3.7,
    burst: [0.35, 0.7],
    restBetweenBursts: [0.28, 0.6],
  },
};

export type HitPart = "head" | "chest" | "stomach" | "legs";

export interface HitResult {
  part: HitPart;
  point: import("three").Vector3;
  normal: import("three").Vector3;
  distance: number;
}
