import type { SoundCue } from "../engine/events";

export interface CueDef {
  /** File stem under `public/audio`. */
  readonly file: string;
  readonly volume: number;
  /**
   * Minimum milliseconds between two plays of this cue. Twenty rifles firing on the same tick
   * would otherwise sum into a clipped mush.
   */
  readonly cooldownMs: number;
  /** Maximum simultaneous voices for this cue. */
  readonly maxVoices: number;
  /** Random pitch variation (± fraction) so repeated shots do not sound machine-stamped. */
  readonly detune: number;
  /** Plays at full volume regardless of where it happened on the map. */
  readonly global?: boolean;
}

const def = (
  file: string,
  volume: number,
  cooldownMs = 0,
  maxVoices = 4,
  detune = 0.06,
  global = false,
): CueDef => ({ file, volume, cooldownMs, maxVoices, detune, global });

export const CUES: Record<SoundCue, CueDef> = {
  uiClick: def("uiClick", 0.5, 40, 3, 0, true),
  uiError: def("uiError", 0.5, 220, 1, 0, true),
  select: def("select", 0.45, 60, 2, 0.03, true),
  moveAck: def("moveAck", 0.4, 80, 2, 0.05, true),
  attackAck: def("attackAck", 0.45, 80, 2, 0.05, true),
  creditTick: def("creditTick", 0.28, 55, 3, 0.02, true),
  buildStart: def("buildStart", 0.45, 120, 2, 0.02, true),
  buildComplete: def("buildComplete", 0.55, 200, 2, 0, true),
  placeBuilding: def("placeBuilding", 0.6, 100, 2, 0.04),
  sell: def("sell", 0.5, 150, 1, 0.03, true),
  repair: def("repair", 0.45, 200, 1, 0.04, true),

  rifle: def("rifle", 0.28, 55, 5, 0.12),
  mg: def("mg", 0.26, 50, 5, 0.12),
  cannon: def("cannon", 0.5, 45, 6, 0.1),
  cannonHeavy: def("cannonHeavy", 0.6, 60, 4, 0.08),
  rocketLaunch: def("rocketLaunch", 0.5, 70, 4, 0.08),
  grenade: def("grenade", 0.4, 60, 4, 0.1),
  flame: def("flame", 0.4, 110, 3, 0.1),
  tesla: def("tesla", 0.65, 90, 3, 0.06),
  dogBark: def("dogBark", 0.45, 140, 2, 0.14),

  explosionSmall: def("explosionSmall", 0.5, 45, 6, 0.12),
  explosionMedium: def("explosionMedium", 0.6, 60, 5, 0.1),
  explosionLarge: def("explosionLarge", 0.7, 90, 4, 0.08),
  structureExplode: def("structureExplode", 0.85, 160, 3, 0.05),
  infantryDie: def("infantryDie", 0.35, 90, 3, 0.15),

  harvest: def("harvest", 0.22, 500, 2, 0.08),
  unload: def("unload", 0.3, 600, 2, 0.06),

  radarOn: def("radarOn", 0.5, 500, 1, 0, true),
  radarOff: def("radarOff", 0.5, 500, 1, 0, true),
  klaxon: def("klaxon", 0.7, 4000, 1, 0, true),
  nukeLaunch: def("nukeLaunch", 0.9, 2000, 1, 0, true),
  nukeImpact: def("nukeImpact", 1.0, 2000, 1, 0, true),
  victory: def("victory", 0.9, 5000, 1, 0, true),
  defeat: def("defeat", 0.9, 5000, 1, 0, true),
};

export type MusicTrack = "theme" | "menu";

export const MUSIC_FILES: Record<MusicTrack, string> = {
  theme: "theme",
  menu: "menu",
};

/** Every file the audio manager needs to fetch up front. */
export function allAudioFiles(): string[] {
  const files = new Set<string>();
  for (const cue of Object.values(CUES)) files.add(cue.file);
  for (const file of Object.values(MUSIC_FILES)) files.add(file);
  return [...files];
}
