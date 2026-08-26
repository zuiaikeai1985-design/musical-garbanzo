import type { Side, TilePoint } from "../engine/types";
import type { World } from "../engine/world";

export interface AiConfig {
  /** Multiplier applied to the AI's harvesting income. */
  incomeMultiplier: number;
  /** Ticks between attack waves at the start of the match. */
  waveInterval: number;
  /** Minimum ticks between waves however long the match runs. */
  minWaveInterval: number;
  /** Combat value the AI gathers before launching its first wave. */
  firstWaveStrength: number;
  /** Extra strength added to each subsequent wave. */
  waveStrengthGrowth: number;
  /** Maximum simultaneous harvesters. */
  maxHarvesters: number;
}

export interface MissionDef {
  readonly id: string;
  readonly width: number;
  readonly height: number;
  readonly seed: number;
  readonly startCredits: Record<Side, number>;
  readonly cameraStart: TilePoint;
  readonly ai: AiConfig;
  /** Paints terrain and places the starting bases. Called once, on a fresh world. */
  build(world: World): void;
}
