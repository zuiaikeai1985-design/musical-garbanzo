import type { Side, UnitKindId } from "../../engine/types";
import { bake, bakeRotations, bakeShadow, outlineRect, px, type Sprite } from "./canvas";
import { PAL, TEAM, TREAD, type TeamColors } from "./palette";

export interface UnitSprite {
  /** `frames[animationFrame][facing]` — vehicles have a single animation frame. */
  frames: Sprite[][];
  /** Independently rotating turret, baked into the same number of facings. */
  turret: Sprite[] | null;
  shadow: Sprite;
  /** Ticks per animation frame (0 = static). */
  animSpeed: number;
}

const VEHICLE_FACINGS = 32;
const INFANTRY_FACINGS = 16;

/**
 * Every sprite is authored facing **east** (+x) because the engine's `facing = 0` points east and
 * `bakeRotations` spins from there.
 *
 * Art rules, applied consistently so the roster reads as one coherent tileset:
 *  - one-pixel near-black outline on every silhouette, so units stay readable on any terrain;
 *  - light comes from the north-west, so top/left edges are lit and bottom/right edges shaded;
 *  - the team colour carries the *hull*, not just a stripe — faction must be legible at a glance
 *    on a 24-pixel unit;
 *  - mechanical greys (treads, barrels, pipes) stay neutral so the team colour keeps its punch.
 */

// ── Shared vehicle primitives ───────────────────────────────────────────────

/** Continuous track running along the top and bottom edges of an east-facing hull. */
function tracks(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  treadW: number,
): void {
  const bottomY = y + h - treadW;
  px(ctx, x, y, w, treadW, TREAD.base);
  px(ctx, x, bottomY, w, treadW, TREAD.base);
  px(ctx, x, y, w, 1, TREAD.light);
  px(ctx, x, bottomY + treadW - 1, w, 1, TREAD.dark);
  for (let i = 1; i < w - 1; i += 3) {
    px(ctx, x + i, y + 1, 1, treadW - 1, TREAD.dark);
    px(ctx, x + i, bottomY, 1, treadW - 1, TREAD.dark);
  }
  // Drive sprockets at each end.
  px(ctx, x, y + 1, 2, treadW - 1, TREAD.light);
  px(ctx, x + w - 2, y + 1, 2, treadW - 1, TREAD.light);
  px(ctx, x, bottomY, 2, treadW - 1, TREAD.light);
  px(ctx, x + w - 2, bottomY, 2, treadW - 1, TREAD.light);
}

/** Team-coloured armoured hull with a sloped glacis at the east end. */
function armouredHull(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  team: TeamColors,
): void {
  px(ctx, x, y, w, h, team.dark);
  px(ctx, x, y, w, 1, team.base);
  px(ctx, x + 1, y + 1, w - 2, 1, team.light);
  px(ctx, x, y + h - 1, w, 1, team.deep);
  px(ctx, x, y + h - 2, w, 1, team.dark);

  // Sloped front plate.
  px(ctx, x + w - 5, y + 1, 4, h - 2, team.base);
  px(ctx, x + w - 5, y + 1, 4, 1, team.light);
  px(ctx, x + w - 2, y + 1, 1, h - 2, team.deep);

  // Rear engine deck louvres.
  for (let i = 0; i < 3; i++) px(ctx, x + 2 + i * 3, y + 2, 2, h - 4, team.deep);

  outlineRect(ctx, x, y, w, h, PAL.outline);
}

/**
 * Turret with a gun barrel, drawn on a canvas large enough that the barrel is never clipped.
 * The pivot is the canvas centre, which is where the renderer places it over the hull.
 */
function turretSprite(
  bodyW: number,
  bodyH: number,
  barrelLen: number,
  team: TeamColors,
  twin = false,
): Sprite {
  const size = (Math.ceil(Math.max(bodyW, bodyH) / 2 + barrelLen) + 2) * 2;
  return bake(size, size, (ctx, w, h) => {
    const cx = Math.floor(w / 2);
    const cy = Math.floor(h / 2);

    const barrel = (offset: number) => {
      px(ctx, cx + 2, cy + offset - 1, barrelLen, 3, PAL.steelDark);
      px(ctx, cx + 2, cy + offset - 1, barrelLen, 1, PAL.steelLite);
      // Muzzle brake.
      px(ctx, cx + 2 + barrelLen - 3, cy + offset - 2, 3, 5, PAL.steel);
      px(ctx, cx + 2 + barrelLen - 3, cy + offset - 2, 3, 1, PAL.steelHi);
      outlineRect(ctx, cx + 2 + barrelLen - 3, cy + offset - 2, 3, 5, PAL.outline);
    };

    if (twin) {
      barrel(-3);
      barrel(3);
    } else {
      barrel(0);
    }

    // Octagonal turret body.
    const bw = bodyW;
    const bh = bodyH;
    const x0 = cx - Math.floor(bw / 2);
    const y0 = cy - Math.floor(bh / 2);
    px(ctx, x0 + 2, y0, bw - 4, bh, team.base);
    px(ctx, x0, y0 + 2, bw, bh - 4, team.base);
    px(ctx, x0 + 2, y0, bw - 4, 1, team.light);
    px(ctx, x0 + 1, y0 + 1, bw - 2, 1, team.light);
    px(ctx, x0 + 2, y0 + bh - 1, bw - 4, 1, team.deep);
    px(ctx, x0 + 1, y0 + bh - 2, bw - 2, 1, team.dark);
    // Mantlet where the barrel joins.
    px(ctx, cx + Math.floor(bw / 2) - 2, cy - 3, 4, 6, team.light);
    outlineRect(ctx, cx + Math.floor(bw / 2) - 2, cy - 3, 4, 6, PAL.outline);
    // Commander's hatch.
    px(ctx, cx - 3, cy - 2, 4, 4, team.dark);
    px(ctx, cx - 3, cy - 2, 4, 1, team.deep);

    // Silhouette outline (octagon corners nipped).
    outlineRect(ctx, x0 + 2, y0, bw - 4, bh, PAL.outline);
    outlineRect(ctx, x0, y0 + 2, bw, bh - 4, PAL.outline);
  });
}

// ── Vehicles ────────────────────────────────────────────────────────────────

function heavyTank(team: TeamColors): Sprite {
  return bake(26, 18, (ctx) => {
    tracks(ctx, 0, 0, 26, 18, 4);
    armouredHull(ctx, 1, 4, 24, 10, team);
    // Stowage box on the rear deck.
    px(ctx, 3, 6, 4, 6, PAL.rust);
    outlineRect(ctx, 3, 6, 4, 6, PAL.outline);
  });
}

function mammothTank(team: TeamColors): Sprite {
  return bake(32, 24, (ctx) => {
    tracks(ctx, 0, 0, 32, 24, 5);
    armouredHull(ctx, 1, 5, 30, 14, team);
    // Shoulder rocket pods.
    for (const y of [6, 15]) {
      px(ctx, 7, y, 9, 4, PAL.steelDark);
      px(ctx, 8, y + 1, 7, 1, PAL.steelLite);
      for (let i = 0; i < 3; i++) px(ctx, 8 + i * 3, y + 2, 2, 2, PAL.outline);
      outlineRect(ctx, 7, y, 9, 4, PAL.outline);
    }
  });
}

function lightTank(team: TeamColors): Sprite {
  return bake(22, 16, (ctx) => {
    tracks(ctx, 0, 0, 22, 16, 3);
    armouredHull(ctx, 1, 3, 20, 10, team);
  });
}

function mediumTank(team: TeamColors): Sprite {
  return bake(24, 18, (ctx) => {
    tracks(ctx, 0, 0, 24, 18, 4);
    armouredHull(ctx, 1, 4, 22, 10, team);
    px(ctx, 3, 6, 3, 6, PAL.rust);
    outlineRect(ctx, 3, 6, 3, 6, PAL.outline);
  });
}

function artillery(team: TeamColors): Sprite {
  return bake(28, 16, (ctx) => {
    tracks(ctx, 0, 0, 19, 16, 3);
    armouredHull(ctx, 1, 3, 17, 10, team);
    // Fixed forward howitzer with a recoil cradle.
    px(ctx, 15, 6, 5, 5, PAL.steel);
    px(ctx, 15, 6, 5, 1, PAL.steelHi);
    outlineRect(ctx, 15, 6, 5, 5, PAL.outline);
    px(ctx, 19, 7, 9, 3, PAL.steelDark);
    px(ctx, 19, 7, 9, 1, PAL.steelLite);
    px(ctx, 25, 6, 3, 5, PAL.steel);
    outlineRect(ctx, 25, 6, 3, 5, PAL.outline);
  });
}

function v2Launcher(team: TeamColors): Sprite {
  return bake(28, 18, (ctx) => {
    // Six-wheeled chassis.
    for (const wx of [3, 9, 15, 22]) {
      px(ctx, wx, 0, 4, 3, TREAD.base);
      px(ctx, wx, 15, 4, 3, TREAD.base);
      px(ctx, wx, 0, 4, 1, TREAD.light);
      px(ctx, wx, 17, 4, 1, TREAD.dark);
    }
    // Flatbed.
    px(ctx, 2, 4, 18, 10, team.dark);
    px(ctx, 2, 4, 18, 1, team.base);
    outlineRect(ctx, 2, 4, 18, 10, PAL.outline);
    // Cab.
    px(ctx, 20, 4, 7, 10, team.base);
    px(ctx, 20, 4, 7, 1, team.light);
    px(ctx, 22, 6, 4, 5, PAL.glass);
    px(ctx, 22, 6, 4, 1, "#b8ecff");
    outlineRect(ctx, 20, 4, 7, 10, PAL.outline);
    // Missile on its rail, nose east.
    px(ctx, 3, 7, 16, 5, PAL.steelLite);
    px(ctx, 3, 7, 16, 1, PAL.steelHi);
    px(ctx, 3, 11, 16, 1, PAL.steelDark);
    px(ctx, 17, 7, 3, 5, team.base);
    px(ctx, 4, 6, 3, 1, PAL.steelDark);
    px(ctx, 4, 12, 3, 1, PAL.steelDark);
    // Warning band.
    px(ctx, 10, 8, 2, 3, "#c0242a");
    outlineRect(ctx, 3, 7, 17, 5, PAL.outline);
  });
}

function oreTruck(team: TeamColors): Sprite {
  return bake(30, 22, (ctx) => {
    tracks(ctx, 1, 0, 27, 22, 3);
    // Ore hopper: open box with visible ore inside.
    px(ctx, 2, 4, 18, 14, PAL.steelDark);
    px(ctx, 3, 5, 16, 12, PAL.steel);
    px(ctx, 3, 5, 16, 1, PAL.steelHi);
    for (let i = 0; i < 4; i++) px(ctx, 5 + i * 4, 6, 1, 10, PAL.steelDark);
    // Ore heap.
    px(ctx, 6, 9, 10, 5, PAL.ore2);
    px(ctx, 7, 9, 8, 2, PAL.ore3);
    px(ctx, 9, 9, 3, 1, PAL.ore4);
    outlineRect(ctx, 2, 4, 18, 14, PAL.outline);
    // Cab.
    px(ctx, 20, 5, 8, 12, team.base);
    px(ctx, 20, 5, 8, 1, team.light);
    px(ctx, 22, 7, 5, 5, PAL.glass);
    px(ctx, 22, 7, 5, 1, "#b8ecff");
    outlineRect(ctx, 20, 5, 8, 12, PAL.outline);
    // Scoop arm at the front.
    px(ctx, 27, 8, 3, 6, PAL.rust);
    outlineRect(ctx, 27, 8, 3, 6, PAL.outline);
  });
}

function mcvSprite(team: TeamColors): Sprite {
  return bake(32, 24, (ctx) => {
    tracks(ctx, 0, 0, 32, 24, 4);
    px(ctx, 2, 5, 24, 14, team.dark);
    px(ctx, 2, 5, 24, 1, team.base);
    px(ctx, 3, 6, 22, 1, team.light);
    outlineRect(ctx, 2, 5, 24, 14, PAL.outline);
    // Folded construction gantry.
    px(ctx, 5, 8, 17, 3, PAL.steelDark);
    px(ctx, 5, 13, 17, 3, PAL.steelDark);
    px(ctx, 6, 8, 15, 1, PAL.steelHi);
    px(ctx, 6, 13, 15, 1, PAL.steelHi);
    for (let i = 0; i < 5; i++) px(ctx, 6 + i * 3, 11, 2, 2, PAL.rust);
    // Cab.
    px(ctx, 26, 7, 5, 10, team.base);
    px(ctx, 27, 9, 3, 4, PAL.glass);
    outlineRect(ctx, 26, 7, 5, 10, PAL.outline);
  });
}

function ranger(team: TeamColors): Sprite {
  return bake(20, 15, (ctx) => {
    for (const wx of [2, 14]) {
      px(ctx, wx, 0, 4, 3, TREAD.base);
      px(ctx, wx, 12, 4, 3, TREAD.base);
    }
    px(ctx, 1, 3, 18, 9, team.dark);
    px(ctx, 1, 3, 18, 1, team.base);
    px(ctx, 2, 4, 16, 1, team.light);
    // Bonnet and windscreen.
    px(ctx, 13, 4, 6, 7, team.base);
    px(ctx, 11, 5, 3, 5, PAL.glass);
    // Open cargo bed.
    px(ctx, 3, 5, 7, 5, team.deep);
    outlineRect(ctx, 1, 3, 18, 9, PAL.outline);
  });
}

// ── Infantry ────────────────────────────────────────────────────────────────

type InfantryKind = "rifle" | "rocket" | "grenade" | "engineer";

const UNIFORM: Record<InfantryKind, { cloth: string; clothLite: string }> = {
  rifle: { cloth: "#4a4a34", clothLite: "#63633f" },
  grenade: { cloth: "#4a3a2a", clothLite: "#63503a" },
  rocket: { cloth: "#3c4a44", clothLite: "#4f635a" },
  engineer: { cloth: "#b9b4a2", clothLite: "#d8d4c4" },
};

/**
 * Top-down infantryman on a 16x16 canvas.
 *
 * At two-times zoom a soldier is roughly 24 screen pixels tall, so the readable features are the
 * silhouette, the helmet and the weapon sticking out east. Everything else is texture.
 */
function infantry(team: TeamColors, step: number, kind: InfantryKind): Sprite {
  const { cloth, clothLite } = UNIFORM[kind];
  return bake(16, 16, (ctx) => {
    const cx = 8;
    const cy = 8;
    const swing = step === 0 ? 0 : step === 1 ? 1 : -1;

    // Boots poking out behind the torso, swinging with the walk cycle.
    px(ctx, cx - 7, cy - 4 + swing, 3, 3, "#241d15");
    px(ctx, cx - 7, cy + 1 - swing, 3, 3, "#241d15");

    // Torso: shoulders run across the facing, so it is deeper in y than in x.
    px(ctx, cx - 5, cy - 5, 8, 10, PAL.outline);
    px(ctx, cx - 4, cy - 4, 7, 8, cloth);
    px(ctx, cx - 4, cy - 4, 7, 1, clothLite);
    px(ctx, cx - 4, cy + 3, 7, 1, "#2b271b");
    // Shoulder pads catch the light.
    px(ctx, cx - 1, cy - 4, 4, 2, clothLite);
    px(ctx, cx - 1, cy + 2, 4, 2, clothLite);
    // Backpack.
    px(ctx, cx - 5, cy - 2, 3, 5, "#3a3226");
    px(ctx, cx - 5, cy - 2, 3, 1, "#4d4433");

    // Helmet — the strongest team-colour cue, kept small so the uniform still reads.
    px(ctx, cx - 1, cy - 3, 5, 6, PAL.outline);
    px(ctx, cx - 1, cy - 2, 5, 4, team.base);
    px(ctx, cx - 1, cy - 2, 5, 1, team.light);
    px(ctx, cx, cy - 1, 2, 1, team.light);
    px(ctx, cx + 3, cy - 1, 1, 2, team.deep);

    // Weapon, pointing east.
    switch (kind) {
      case "rifle":
        px(ctx, cx + 2, cy - 1, 7, 2, PAL.outline);
        px(ctx, cx + 2, cy - 1, 6, 1, PAL.steelLite);
        px(ctx, cx + 3, cy, 4, 1, PAL.steelDark);
        break;
      case "rocket":
        px(ctx, cx, cy - 4, 9, 4, PAL.outline);
        px(ctx, cx + 1, cy - 3, 7, 2, PAL.steelLite);
        px(ctx, cx + 7, cy - 3, 1, 2, PAL.rust);
        break;
      case "grenade":
        px(ctx, cx + 2, cy - 1, 4, 2, PAL.outline);
        px(ctx, cx + 2, cy - 1, 3, 1, PAL.steelLite);
        px(ctx, cx + 4, cy - 4, 4, 4, PAL.outline);
        px(ctx, cx + 5, cy - 3, 2, 2, "#5c6b3c");
        break;
      case "engineer":
        px(ctx, cx + 2, cy, 5, 5, PAL.outline);
        px(ctx, cx + 3, cy + 1, 3, 3, PAL.rust);
        px(ctx, cx + 3, cy + 1, 3, 1, "#a5673c");
        break;
    }
  });
}

/** Top-down attack dog with a two-frame run cycle. */
function attackDog(step: number): Sprite {
  return bake(14, 12, (ctx) => {
    const body = "#4a3a28";
    const bodyLite = "#6b563c";
    const bodyDark = "#2c2218";
    const stretch = step === 1 ? 1 : 0;

    // Legs.
    px(ctx, 4, 2 + stretch, 2, 2, bodyDark);
    px(ctx, 8, 2 + stretch, 2, 2, bodyDark);
    px(ctx, 4, 8 - stretch, 2, 2, bodyDark);
    px(ctx, 8, 8 - stretch, 2, 2, bodyDark);

    // Body.
    px(ctx, 3, 4, 8, 4, body);
    px(ctx, 3, 4, 8, 1, bodyLite);
    px(ctx, 3, 7, 8, 1, bodyDark);

    // Head and snout.
    px(ctx, 10, 4, 3, 4, bodyLite);
    px(ctx, 12, 5, 2, 2, body);
    px(ctx, 13, 5, 1, 1, "#1a140e");
    // Ears.
    px(ctx, 10, 3, 1, 2, bodyDark);
    px(ctx, 10, 7, 1, 2, bodyDark);
    // Tail.
    px(ctx, 0, 5, 3, 1, body);
    px(ctx, 0, 4, 1, 1, bodyLite);

    outlineRect(ctx, 2, 3, 12, 6, "rgba(0,0,0,0.35)");
  });
}

// ── Assembly ────────────────────────────────────────────────────────────────

interface UnitArt {
  body: (team: TeamColors, step: number) => Sprite;
  steps: number;
  facings: number;
  animSpeed: number;
  turret: ((team: TeamColors) => Sprite) | null;
  shadow: [number, number];
}

const vehicle = (
  body: (team: TeamColors) => Sprite,
  shadow: [number, number],
  turret: ((team: TeamColors) => Sprite) | null = null,
): UnitArt => ({
  body,
  steps: 1,
  facings: VEHICLE_FACINGS,
  animSpeed: 0,
  turret,
  shadow,
});

const foot = (kind: InfantryKind): UnitArt => ({
  body: (team, step) => infantry(team, step, kind),
  steps: 3,
  facings: INFANTRY_FACINGS,
  animSpeed: 5,
  turret: null,
  shadow: [9, 7],
});

const ART: Record<UnitKindId, UnitArt> = {
  "3tnk": vehicle(heavyTank, [24, 17], (t) => turretSprite(14, 12, 13, t)),
  "4tnk": vehicle(mammothTank, [30, 22], (t) => turretSprite(17, 15, 14, t, true)),
  v2rl: vehicle(v2Launcher, [26, 16]),
  harv: vehicle(oreTruck, [28, 20]),
  mcv: vehicle(mcvSprite, [30, 22]),
  "1tnk": vehicle(lightTank, [20, 14], (t) => turretSprite(12, 10, 11, t)),
  "2tnk": vehicle(mediumTank, [22, 16], (t) => turretSprite(13, 11, 12, t)),
  jeep: vehicle(ranger, [18, 13], (t) => turretSprite(9, 8, 8, t)),
  arty: vehicle(artillery, [20, 14]),
  harva: vehicle(oreTruck, [28, 20]),
  e1: foot("rifle"),
  e2: foot("grenade"),
  e3: foot("rocket"),
  e6: foot("engineer"),
  e1a: foot("rifle"),
  e3a: foot("rocket"),
  dog: {
    body: (_t, step) => attackDog(step),
    steps: 2,
    facings: INFANTRY_FACINGS,
    animSpeed: 4,
    turret: null,
    shadow: [11, 7],
  },
};

export function buildUnitSprite(kind: UnitKindId, side: Side): UnitSprite {
  const art = ART[kind];
  const team = TEAM[side];
  const frames: Sprite[][] = [];
  for (let step = 0; step < art.steps; step++) {
    frames.push(bakeRotations(art.body(team, step), art.facings));
  }
  return {
    frames,
    turret: art.turret ? bakeRotations(art.turret(team), art.facings) : null,
    shadow: bakeShadow(art.shadow[0], art.shadow[1]),
    animSpeed: art.animSpeed,
  };
}
