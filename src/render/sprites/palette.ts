import type { Side } from "../../engine/types";

/**
 * A deliberately small, VGA-flavoured palette.
 *
 * Every sprite routine draws from this list so the whole game reads as one coherent 1996-era
 * tileset rather than a pile of unrelated shapes.
 */
export const PAL = {
  black: "#05060a",
  outline: "#0d0f14",
  shadow: "rgba(0,0,0,0.38)",

  // Terrain
  grass1: "#425f2c",
  grass2: "#385225",
  grass3: "#4b6b32",
  dirt1: "#6d5636",
  dirt2: "#5d4a2e",
  dirt3: "#7b6340",
  rough1: "#4a4335",
  rough2: "#5a5140",
  road1: "#6a6155",
  road2: "#5b5347",
  road3: "#787064",
  water1: "#1b3654",
  water2: "#20406a",
  water3: "#2b5384",
  beach1: "#8a7a52",
  beach2: "#9b8a5e",
  cliff1: "#4a4038",
  cliff2: "#5d5147",
  cliff3: "#332c26",

  // Ore
  ore1: "#8a6a1c",
  ore2: "#b98d22",
  ore3: "#e2b23a",
  ore4: "#f6d878",
  gem1: "#2c6a74",
  gem2: "#3f97a4",
  gem3: "#66d0dc",
  gem4: "#a8f0f7",

  // Metals / structures
  steelDark: "#3a3a42",
  steel: "#5a5a66",
  steelLite: "#7d7d8c",
  steelHi: "#a3a3b2",
  concrete: "#6e6a5f",
  concreteDark: "#514e46",
  concreteLite: "#8d887b",
  rust: "#7a4a2a",

  // Highlights
  glass: "#7fd7ff",
  glow: "#ffd27f",
  lampOn: "#ffe27a",
  lampOff: "#5b4f2e",
  fire1: "#ffef9a",
  fire2: "#ffb43c",
  fire3: "#e0561c",
  smoke1: "#6b6b6b",
  smoke2: "#3d3d3d",
  tesla: "#9fe8ff",

  // UI
  hpGreen: "#35c23a",
  hpAmber: "#e8b23a",
  hpRed: "#d0342c",
  selection: "#59ff64",
} as const;

export interface TeamColors {
  /** Main body colour. */
  base: string;
  /** Lit facet. */
  light: string;
  /** Shaded facet. */
  dark: string;
  /** Darkest outline / recess. */
  deep: string;
  /** Accent used for insignia, lamps and trim. */
  accent: string;
}

export const TEAM: Record<Side, TeamColors> = {
  soviet: {
    base: "#a8272c",
    light: "#d94b46",
    dark: "#75181d",
    deep: "#450d10",
    accent: "#f2c14a",
  },
  allied: {
    base: "#2f6fd0",
    light: "#5b9bf0",
    dark: "#1d4a92",
    deep: "#0f2a58",
    accent: "#d7e4f7",
  },
};

/** Neutral olive drab used for the non-team-coloured chassis parts. */
export const CHASSIS = {
  base: "#5c6046",
  light: "#767a58",
  dark: "#44472f",
  deep: "#2c2e1e",
} as const;

export const TREAD = {
  base: "#3a3a3a",
  light: "#4d4d4d",
  dark: "#242424",
} as const;
