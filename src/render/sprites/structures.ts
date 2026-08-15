import { TILE } from "../../engine/constants";
import { structureDef } from "../../engine/rules";
import type { Side, StructureKindId } from "../../engine/types";
import { bake, bakeRotations, outlineRect, px, type Sprite } from "./canvas";
import { PAL, TEAM, type TeamColors } from "./palette";

export interface StructureSprite {
  body: Sprite;
  /** Scorched/cracked variant shown below 50% health. */
  damaged: Sprite;
  /** Independently rotating gun, for turret structures. */
  turret: Sprite[] | null;
  /** Looping overlay frames (radar dish, coil hum). */
  overlay: Sprite[] | null;
  /** Ticks per overlay frame. */
  overlaySpeed: number;
}

const TURRET_FACINGS = 32;

/**
 * Structures are authored on a canvas exactly matching their tile footprint (24px per tile).
 *
 * Design rules:
 *  - a dark concrete apron grounds every building so it never looks like it is floating;
 *  - the roof is the largest readable surface, so silhouette and roof detail carry recognition;
 *  - light from the north-west: roofs are lit, the south face is a shaded "wall" band;
 *  - a team-coloured band plus a faction insignia makes ownership obvious at any zoom.
 */

// ── Shared primitives ───────────────────────────────────────────────────────

const ROOF = "#6a6257";
const ROOF_LITE = "#8b8275";
const ROOF_DARK = "#4a443b";
const WALL = "#39342d";
const WALL_DARK = "#232019";

/** Dark concrete pad covering the whole footprint. */
function apron(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  px(ctx, 0, 2, w, h - 2, PAL.concreteDark);
  px(ctx, 1, 3, w - 2, h - 4, "#5c584e");
  // Expansion joints.
  for (let x = 6; x < w - 4; x += 12) px(ctx, x, 3, 1, h - 4, PAL.concreteDark);
  outlineRect(ctx, 0, 2, w, h - 2, PAL.outline);
}

/**
 * A rectangular mass with a lit roof and a shaded south wall.
 * `wallH` is how many pixels at the bottom read as vertical wall.
 */
function mass(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  wallH: number,
  roof = ROOF,
  roofLite = ROOF_LITE,
  wall = WALL,
): void {
  const roofH = h - wallH;
  px(ctx, x, y, w, roofH, roof);
  px(ctx, x, y, w, 1, roofLite);
  px(ctx, x, y + 1, 1, roofH - 1, roofLite);
  px(ctx, x + w - 1, y, 1, roofH, ROOF_DARK);
  px(ctx, x, y + roofH, w, wallH, wall);
  px(ctx, x, y + roofH, w, 1, "#4d473e");
  px(ctx, x, y + h - 1, w, 1, WALL_DARK);
  outlineRect(ctx, x, y, w, h, PAL.outline);
}

/** Team-coloured band with a small insignia block, the main ownership cue. */
function insigniaBand(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  team: TeamColors,
): void {
  px(ctx, x, y, w, 3, team.dark);
  px(ctx, x, y, w, 1, team.base);
  px(ctx, x + 2, y, 3, 3, team.accent);
}

/** Yellow/black hazard stripes, used on doors and blast covers. */
function hazard(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number): void {
  px(ctx, x, y, w, h, "#1b1a16");
  for (let i = 0; i < w; i += 4) px(ctx, x + i, y, 2, h, PAL.glow);
}

function pipes(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, count: number): void {
  for (let i = 0; i < count; i++) {
    const py = y + i * 3;
    px(ctx, x, py, w, 2, PAL.steelDark);
    px(ctx, x, py, w, 1, PAL.steelLite);
  }
}

function lamp(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  px(ctx, x, y, 2, 2, PAL.lampOn);
  px(ctx, x, y, 1, 1, "#fff3c0");
}

// ── Individual structures ───────────────────────────────────────────────────

/** 3x3 — an open construction bay straddled by a crane gantry. */
function conyard(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    // Two side wings.
    mass(ctx, 2, 6, 16, h - 12, 6);
    mass(ctx, w - 18, 6, 16, h - 12, 6);
    insigniaBand(ctx, 4, 9, 12, team);
    insigniaBand(ctx, w - 16, 9, 12, team);
    // Open bay floor between them.
    px(ctx, 18, 8, w - 36, h - 16, "#413c34");
    for (let y = 10; y < h - 10; y += 5) px(ctx, 19, y, w - 38, 1, "#302c26");
    // Crane gantry crossing the bay.
    px(ctx, 16, 18, w - 32, 5, PAL.rust);
    px(ctx, 16, 18, w - 32, 1, "#a5673c");
    px(ctx, 16, 22, w - 32, 1, PAL.outline);
    // Crane trolley with a hanging hook.
    px(ctx, Math.floor(w / 2) - 4, 15, 8, 11, PAL.steel);
    px(ctx, Math.floor(w / 2) - 4, 15, 8, 1, PAL.steelHi);
    outlineRect(ctx, Math.floor(w / 2) - 4, 15, 8, 11, PAL.outline);
    px(ctx, Math.floor(w / 2) - 1, 26, 2, 6, PAL.steelDark);
    px(ctx, Math.floor(w / 2) - 3, 32, 6, 3, PAL.steelLite);
    // Roof-mounted red star.
    star(ctx, 9, h - 22, 5, team.accent, team.dark);
    lamp(ctx, 4, 4);
    lamp(ctx, w - 6, 4);
  });
}

/** 2x2 — two cooling towers behind a low turbine hall. */
function powerPlant(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    // Cooling towers (circular, viewed from above).
    for (const cx of [12, w - 12]) {
      ctx.fillStyle = PAL.outline;
      ctx.beginPath();
      ctx.arc(cx, 13, 9, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#9a9488";
      ctx.beginPath();
      ctx.arc(cx, 13, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#c2bcae";
      ctx.beginPath();
      ctx.arc(cx - 1, 12, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2b2822";
      ctx.beginPath();
      ctx.arc(cx, 13, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#4a453c";
      ctx.beginPath();
      ctx.arc(cx - 1, 12, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    // Turbine hall.
    mass(ctx, 3, h - 20, w - 6, 17, 6);
    insigniaBand(ctx, 5, h - 18, w - 10, team);
    // Glowing vents along the wall.
    for (let i = 0; i < 4; i++) px(ctx, 6 + i * 9, h - 7, 5, 3, PAL.lampOn);
    // Cable run.
    px(ctx, 2, h - 24, w - 4, 2, PAL.steelDark);
  });
}

/** 3x2 — processing hall, storage silo and a marked docking apron. */
function refinery(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    // Processing hall.
    mass(ctx, 2, 5, w - 24, h - 16, 6);
    insigniaBand(ctx, 4, 7, w - 28, team);
    pipes(ctx, 5, 13, w - 30, 3);
    // Vertical storage silo (circular).
    const scx = w - 11;
    ctx.fillStyle = PAL.outline;
    ctx.beginPath();
    ctx.arc(scx, 16, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#8d8578";
    ctx.beginPath();
    ctx.arc(scx, 16, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#aaa294";
    ctx.beginPath();
    ctx.arc(scx - 2, 14, 6, 0, Math.PI * 2);
    ctx.fill();
    px(ctx, scx - 3, 15, 6, 2, PAL.ore3);
    // Conveyor from the apron into the hall.
    px(ctx, 4, h - 15, w - 26, 4, PAL.rust);
    px(ctx, 4, h - 15, w - 26, 1, PAL.ore3);
    for (let i = 0; i < 6; i++) px(ctx, 6 + i * 6, h - 14, 2, 2, PAL.ore2);
    // Docking apron with chevrons.
    px(ctx, 3, h - 10, w - 24, 8, "#2f2b25");
    for (let i = 0; i < 5; i++) px(ctx, 5 + i * 8, h - 8, 5, 4, PAL.glow);
    outlineRect(ctx, 3, h - 10, w - 24, 8, PAL.outline);
  });
}

/** 2x2 — a single fat cylinder with an ore heap on top. */
function oreSilo(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = PAL.outline;
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7d766a";
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#9d9588";
    ctx.beginPath();
    ctx.arc(cx - 2, cy - 2, 13, 0, Math.PI * 2);
    ctx.fill();
    // Ore heaped in the middle.
    ctx.fillStyle = PAL.ore2;
    ctx.beginPath();
    ctx.arc(cx, cy, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.ore3;
    ctx.beginPath();
    ctx.arc(cx - 1, cy - 2, 5, 0, Math.PI * 2);
    ctx.fill();
    px(ctx, cx - 2, cy - 4, 2, 2, PAL.ore4);
    // Radial ribs.
    ctx.strokeStyle = "#5f594f";
    ctx.lineWidth = 1;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 9, cy + Math.sin(a) * 9);
      ctx.lineTo(cx + Math.cos(a) * 16, cy + Math.sin(a) * 16);
      ctx.stroke();
    }
    insigniaBand(ctx, 4, h - 8, 10, team);
  });
}

/** 2x2 — hut with a red roof, sandbags and a flag. */
function barracks(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    mass(ctx, 4, 9, w - 8, h - 16, 7, team.dark, team.base, team.deep);
    // Roof ridge and shingles.
    px(ctx, 4, 14, w - 8, 2, team.light);
    for (let x = 6; x < w - 6; x += 5) px(ctx, x, 10, 1, 4, team.deep);
    // Door.
    px(ctx, Math.floor(w / 2) - 4, h - 13, 8, 9, PAL.outline);
    px(ctx, Math.floor(w / 2) - 3, h - 12, 6, 7, "#2f2a22");
    px(ctx, Math.floor(w / 2) + 1, h - 9, 1, 1, PAL.glow);
    // Sandbag line.
    for (let i = 0; i < 5; i++) px(ctx, 4 + i * 8, h - 5, 6, 3, "#7e7355");
    // Flag pole.
    px(ctx, 6, 3, 1, 10, PAL.steelLite);
    px(ctx, 7, 3, 9, 6, team.base);
    px(ctx, 7, 3, 9, 1, team.light);
    px(ctx, 9, 5, 3, 2, team.accent);
  });
}

/** 2x2 — kennel hut plus a wire run. */
function kennel(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    mass(ctx, 3, 10, 20, h - 16, 6, "#6a5236", "#8a6b47", "#3f3122");
    // Kennel arch.
    px(ctx, 10, h - 12, 7, 8, PAL.outline);
    px(ctx, 11, h - 11, 5, 6, "#241c14");
    insigniaBand(ctx, 5, 12, 12, team);
    // Fenced run.
    const fx = 25;
    px(ctx, fx, 8, w - fx - 3, h - 12, "#2d2a24");
    for (let i = 0; i < 8; i++) px(ctx, fx + 1 + i * 2, 9, 1, h - 14, "#6f6a5e");
    for (let i = 0; i < 5; i++) px(ctx, fx + 1, 10 + i * 5, w - fx - 5, 1, "#6f6a5e");
    outlineRect(ctx, fx, 8, w - fx - 3, h - 12, PAL.outline);
    // Feeding bowl.
    px(ctx, fx + 4, h - 12, 4, 3, PAL.rust);
  });
}

/** 3x2 — long corrugated hangar with a big striped door. */
function warFactory(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    mass(ctx, 2, 4, w - 4, h - 12, 8);
    // Corrugated roof ribs.
    for (let x = 4; x < w - 4; x += 4) px(ctx, x, 5, 2, h - 22, ROOF_DARK);
    px(ctx, 2, 4, w - 4, 1, ROOF_LITE);
    insigniaBand(ctx, 4, 6, w - 8, team);
    // Overhead crane rail.
    px(ctx, 5, h - 24, w - 10, 3, PAL.rust);
    px(ctx, 5, h - 24, w - 10, 1, "#a5673c");
    // Roll-up door.
    const dx = Math.floor(w / 2) - 14;
    hazard(ctx, dx, h - 12, 28, 3);
    px(ctx, dx, h - 9, 28, 7, "#2b2822");
    for (let i = 0; i < 6; i++) px(ctx, dx + 2 + i * 5, h - 8, 3, 5, "#3d3931");
    outlineRect(ctx, dx, h - 12, 28, 10, PAL.outline);
    lamp(ctx, dx - 4, h - 10);
    lamp(ctx, dx + 30, h - 10);
  });
}

/** 2x2 — bunker with a dish (the dish itself is an animated overlay). */
function radarDome(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    mass(ctx, 4, h - 22, w - 8, 19, 7);
    insigniaBand(ctx, 6, h - 20, w - 12, team);
    // Dish cradle.
    px(ctx, w / 2 - 8, 12, 16, 6, PAL.steelDark);
    px(ctx, w / 2 - 8, 12, 16, 1, PAL.steelLite);
    outlineRect(ctx, w / 2 - 8, 12, 16, 6, PAL.outline);
    px(ctx, w / 2 - 2, 6, 4, 8, PAL.steel);
    // Console lights.
    for (let i = 0; i < 3; i++) px(ctx, 7 + i * 5, h - 8, 3, 2, i === 1 ? PAL.hpGreen : PAL.lampOn);
  });
}

/** The rotating dish, baked as an overlay animation. */
function radarDish(frame: number, frames: number, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    const cx = w / 2;
    const cy = 11;
    const a = (frame / frames) * Math.PI * 2;
    const len = 11;
    const ex = cx + Math.cos(a) * len;
    const ey = cy + Math.sin(a) * len * 0.4;
    ctx.strokeStyle = PAL.outline;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    ctx.strokeStyle = "#d8d2c4";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    px(ctx, ex - 2, ey - 2, 4, 4, PAL.glass);
    px(ctx, cx - 2, cy - 2, 4, 4, PAL.steelHi);
  });
}

/** 3x2 — open repair pad with a yellow cross. */
function serviceDepot(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    px(ctx, 16, 6, w - 20, h - 12, "#3a352d");
    outlineRect(ctx, 16, 6, w - 20, h - 12, PAL.outline);
    const cx = 16 + (w - 20) / 2;
    const cy = h / 2;
    px(ctx, cx - 12, cy - 3, 24, 6, PAL.glow);
    px(ctx, cx - 3, cy - 12, 6, 24, PAL.glow);
    px(ctx, cx - 11, cy - 2, 22, 2, "#fff0b0");
    // Tool shed with a crane arm.
    mass(ctx, 2, 6, 14, h - 12, 6);
    insigniaBand(ctx, 3, 8, 12, team);
    px(ctx, 15, 10, 12, 2, PAL.rust);
    px(ctx, 25, 10, 2, 7, PAL.steelDark);
  });
}

/** 1x2 — tall insulator column topped with an emitter sphere. */
function teslaCoil(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    px(ctx, 2, h - 15, w - 4, 13, PAL.concreteDark);
    px(ctx, 3, h - 14, w - 6, 11, "#5c584e");
    outlineRect(ctx, 2, h - 15, w - 4, 13, PAL.outline);
    insigniaBand(ctx, 4, h - 12, w - 8, team);
    const cx = Math.floor(w / 2);
    // Insulator discs, widest at the bottom.
    for (let i = 0; i < 5; i++) {
      const y = h - 20 - i * 5;
      const half = 6 - i;
      px(ctx, cx - half, y, half * 2, 3, "#cfc8b8");
      px(ctx, cx - half, y, half * 2, 1, "#efe8d8");
      px(ctx, cx - half, y + 2, half * 2, 1, "#8e887a");
      px(ctx, cx - 2, y + 3, 4, 2, PAL.steelDark);
    }
    // Emitter sphere.
    ctx.fillStyle = PAL.outline;
    ctx.beginPath();
    ctx.arc(cx, 8, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#b9c6cf";
    ctx.beginPath();
    ctx.arc(cx, 8, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PAL.tesla;
    ctx.beginPath();
    ctx.arc(cx - 1, 6, 3, 0, Math.PI * 2);
    ctx.fill();
  });
}

/** Idle crackle around the tesla emitter. */
function teslaHum(frame: number, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    const cx = Math.floor(w / 2);
    ctx.strokeStyle = PAL.tesla;
    ctx.globalAlpha = 0.55;
    ctx.lineWidth = 1;
    for (let i = 0; i < 3; i++) {
      const a = ((frame * 1.9 + i * 2.1) % 6.283) - 3.14;
      ctx.beginPath();
      ctx.moveTo(cx, 8);
      ctx.lineTo(cx + Math.cos(a) * 8, 8 + Math.sin(a) * 8);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.9;
    px(ctx, cx - 1, 5, 2, 2, "#e8fbff");
  });
}

/** 1x1 — fuel drum on a squat concrete base (the nozzle is a rotating turret). */
function flameTower(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    ctx.fillStyle = PAL.outline;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 1, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#514c43";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6b6459";
    ctx.beginPath();
    ctx.arc(w / 2 - 1, h / 2 - 1, 7, 0, Math.PI * 2);
    ctx.fill();
    // Fuel drums around the rim.
    for (const [dx, dy] of [
      [-8, 6],
      [6, 7],
    ]) {
      px(ctx, w / 2 + dx, h / 2 + dy, 5, 5, PAL.rust);
      px(ctx, w / 2 + dx, h / 2 + dy, 5, 1, "#a5673c");
      outlineRect(ctx, w / 2 + dx, h / 2 + dy, 5, 5, PAL.outline);
    }
    px(ctx, w / 2 - 4, 2, 8, 2, team.base);
  });
}

function flameNozzle(team: TeamColors): Sprite {
  return bake(20, 20, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    px(ctx, cx + 1, cy - 2, 8, 4, PAL.steelDark);
    px(ctx, cx + 1, cy - 2, 8, 1, PAL.steelLite);
    px(ctx, cx + 8, cy - 2, 2, 4, PAL.fire3);
    px(ctx, cx - 5, cy - 4, 7, 8, team.dark);
    px(ctx, cx - 5, cy - 4, 7, 1, team.base);
    outlineRect(ctx, cx - 5, cy - 4, 7, 8, PAL.outline);
  });
}

/** 1x1 — concrete wall segment. */
function wall(_team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    px(ctx, 1, 3, w - 2, h - 6, "#3f3b34");
    px(ctx, 2, 4, w - 4, h - 8, PAL.concrete);
    px(ctx, 2, 4, w - 4, 1, PAL.concreteLite);
    px(ctx, 2, h - 5, w - 4, 1, "#3f3b34");
    // Brick courses.
    px(ctx, 2, 11, w - 4, 1, "#4f4a41");
    px(ctx, 9, 4, 1, 7, "#4f4a41");
    px(ctx, 5, 12, 1, 7, "#4f4a41");
    px(ctx, 16, 12, 1, 7, "#4f4a41");
    outlineRect(ctx, 1, 3, w - 2, h - 6, PAL.outline);
  });
}

/** 2x2 — circular blast doors with hazard chevrons. */
function missileSilo(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    apron(ctx, w, h);
    const cx = w / 2;
    const cy = h / 2;
    ctx.fillStyle = PAL.outline;
    ctx.beginPath();
    ctx.arc(cx, cy, 17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a453c";
    ctx.beginPath();
    ctx.arc(cx, cy, 16, 0, Math.PI * 2);
    ctx.fill();
    // Two blast door leaves, slightly parted.
    ctx.fillStyle = "#787065";
    ctx.beginPath();
    ctx.arc(cx, cy, 13, Math.PI * 0.53, Math.PI * 1.47);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(cx, cy, 13, Math.PI * 1.53, Math.PI * 0.47);
    ctx.fill();
    ctx.fillStyle = "#918878";
    ctx.beginPath();
    ctx.arc(cx - 1, cy - 1, 10, Math.PI * 0.53, Math.PI * 1.47);
    ctx.fill();
    px(ctx, cx - 1, cy - 14, 2, 28, "#1d1a15");
    // Hazard chevrons around the rim.
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      px(ctx, cx + Math.cos(a) * 14 - 1, cy + Math.sin(a) * 14 - 1, 3, 3, PAL.glow);
    }
    star(ctx, cx - 4, cy - 4, 4, team.accent, team.dark);
    insigniaBand(ctx, 3, 3, 12, team);
  });
}

/** 1x1 — low concrete dome with an embrasure. */
function pillbox(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    ctx.fillStyle = PAL.outline;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 1, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#5a554b";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#7b7466";
    ctx.beginPath();
    ctx.arc(w / 2 - 1, h / 2 - 2, 6, 0, Math.PI * 2);
    ctx.fill();
    // Embrasure slit facing east.
    px(ctx, w / 2 + 2, h / 2 - 2, 7, 4, PAL.outline);
    px(ctx, w / 2 + 3, h / 2 - 1, 5, 2, "#141310");
    px(ctx, w / 2 - 4, h - 5, 8, 2, team.base);
  });
}

/** 1x1 — concrete ring for the rotating gun. */
function gunTurretBase(team: TeamColors, w: number, h: number): Sprite {
  return bake(w, h, (ctx) => {
    ctx.fillStyle = PAL.outline;
    ctx.beginPath();
    ctx.arc(w / 2, h / 2 + 1, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4f4a41";
    ctx.beginPath();
    ctx.arc(w / 2, h / 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#6d6659";
    ctx.beginPath();
    ctx.arc(w / 2 - 1, h / 2 - 1, 6, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      px(ctx, w / 2 + Math.cos(a) * 8 - 1, h / 2 + Math.sin(a) * 8 - 1, 2, 2, "#3a352d");
    }
    px(ctx, w / 2 - 4, h - 5, 8, 2, team.base);
  });
}

function gunBarrel(team: TeamColors): Sprite {
  return bake(28, 28, (ctx, w, h) => {
    const cx = w / 2;
    const cy = h / 2;
    px(ctx, cx + 2, cy - 1, 11, 3, PAL.steelDark);
    px(ctx, cx + 2, cy - 1, 11, 1, PAL.steelLite);
    px(ctx, cx + 11, cy - 2, 3, 5, PAL.steel);
    outlineRect(ctx, cx + 11, cy - 2, 3, 5, PAL.outline);
    px(ctx, cx - 6, cy - 5, 10, 10, team.base);
    px(ctx, cx - 6, cy - 5, 10, 1, team.light);
    px(ctx, cx - 6, cy + 4, 10, 1, team.deep);
    outlineRect(ctx, cx - 6, cy - 5, 10, 10, PAL.outline);
  });
}

/** Small filled five-pointed star, used as the Soviet insignia. */
function star(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  r: number,
  fill: string,
  outline: string,
): void {
  const cx = x + r;
  const cy = y + r;
  const path = (radius: number) => {
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 === 0 ? radius : radius * 0.4;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      const px2 = cx + Math.cos(a) * rad;
      const py2 = cy + Math.sin(a) * rad;
      if (i === 0) ctx.moveTo(px2, py2);
      else ctx.lineTo(px2, py2);
    }
    ctx.closePath();
  };
  ctx.fillStyle = outline;
  path(r + 1);
  ctx.fill();
  ctx.fillStyle = fill;
  path(r);
  ctx.fill();
}

// ── Damage overlay ──────────────────────────────────────────────────────────

function makeDamaged(source: Sprite): Sprite {
  return bake(source.width, source.height, (ctx, w, h) => {
    ctx.drawImage(source, 0, 0);
    ctx.globalCompositeOperation = "source-atop";
    ctx.fillStyle = "rgba(24,16,10,0.42)";
    ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = "source-over";

    ctx.strokeStyle = "rgba(0,0,0,0.8)";
    ctx.lineWidth = 1;
    let sx = (w * 7) % 13;
    let sy = (h * 11) % 17;
    for (let i = 0; i < 6; i++) {
      const x0 = 4 + ((sx * 37 + i * 53) % Math.max(1, w - 8));
      const y0 = 4 + ((sy * 29 + i * 41) % Math.max(1, h - 8));
      ctx.beginPath();
      ctx.moveTo(x0, y0);
      ctx.lineTo(x0 + ((i % 2 === 0 ? 5 : -4) + (i % 3)), y0 + 4 + (i % 4));
      ctx.lineTo(x0 + ((i % 2 === 0 ? 9 : -8) + (i % 3)), y0 + 9 + (i % 3));
      ctx.stroke();
      sx = (sx * 3 + 7) % 31;
      sy = (sy * 5 + 11) % 29;
    }

    // Blown-out holes showing the dark interior.
    ctx.fillStyle = "#100d09";
    ctx.fillRect(Math.floor(w * 0.55), Math.floor(h * 0.3), 6, 5);
    ctx.fillRect(Math.floor(w * 0.2), Math.floor(h * 0.6), 5, 4);
    ctx.fillStyle = "#33291d";
    ctx.fillRect(Math.floor(w * 0.55), Math.floor(h * 0.3), 6, 1);
    ctx.fillRect(Math.floor(w * 0.2), Math.floor(h * 0.6), 5, 1);
  });
}

// ── Assembly ────────────────────────────────────────────────────────────────

type BodyFn = (team: TeamColors, w: number, h: number) => Sprite;

const BODY: Record<StructureKindId, BodyFn> = {
  conyard,
  power: powerPlant,
  refinery,
  silo: oreSilo,
  barracks,
  kennel,
  warfactory: warFactory,
  radar: radarDome,
  depot: serviceDepot,
  flametower: flameTower,
  tesla: teslaCoil,
  wall,
  nukesilo: missileSilo,
  conyard_a: conyard,
  power_a: powerPlant,
  refinery_a: refinery,
  barracks_a: barracks,
  warfactory_a: warFactory,
  pillbox,
  turret: gunTurretBase,
};

const RADAR_FRAMES = 16;
const TESLA_FRAMES = 8;

export function buildStructureSprite(kind: StructureKindId, side: Side): StructureSprite {
  const def = structureDef(kind);
  const team = TEAM[side];
  const w = def.w * TILE;
  const h = def.h * TILE;
  const body = BODY[kind](team, w, h);

  let overlay: Sprite[] | null = null;
  let overlaySpeed = 0;
  if (kind === "radar") {
    overlay = Array.from({ length: RADAR_FRAMES }, (_, i) => radarDish(i, RADAR_FRAMES, w, h));
    overlaySpeed = 3;
  } else if (kind === "tesla") {
    overlay = Array.from({ length: TESLA_FRAMES }, (_, i) => teslaHum(i, w, h));
    overlaySpeed = 4;
  }

  let turret: Sprite[] | null = null;
  if (kind === "turret") {
    turret = bakeRotations(gunBarrel(team), TURRET_FACINGS);
  } else if (kind === "flametower") {
    turret = bakeRotations(flameNozzle(team), TURRET_FACINGS);
  }

  return { body, damaged: makeDamaged(body), turret, overlay, overlaySpeed };
}
