import { TILE } from "../engine/constants";
import type { Game } from "../engine/game";
import { structureDef } from "../engine/rules";
import { isPlacementLegal } from "../engine/systems/production";
import type { StructureKindId } from "../engine/types";
import type { Camera } from "../render/camera";

/**
 * A tiny read-only window into the running match, installed only in dev builds.
 *
 * End-to-end tests need to assert on simulation state (did the marquee select anything? did the
 * ordered tanks actually move?) and screenshots alone cannot answer that. Exposing a narrow,
 * read-only bridge is far more reliable than trying to infer state from pixels.
 */
export interface RaTestBridge {
  tick(): number;
  status(): string;
  selectionSize(): number;
  selectionIds(): number[];
  credits(): number;
  power(): { produced: number; consumed: number };
  unitCount(): number;
  unitPositions(): { id: number; kind: string; x: number; y: number }[];
  structureCounts(): Record<string, number>;
  camera(): { x: number; y: number; zoom: number };
  /** Grants credits so tests can exercise the build system without waiting for the economy. */
  grantCredits(amount: number): void;
  /**
   * Canvas-relative pixel position of a legal build site for `kind`, or null if there is none
   * on screen. Tests need this because hard-coded drop coordinates silently land on top of an
   * existing building the moment the map or the camera changes.
   */
  placementSpot(kind: string): { x: number; y: number; tx: number; ty: number } | null;
  /**
   * Drops a scratch force onto the map so combat can be exercised without waiting for the AI to
   * walk an attack wave across seventy tiles.
   */
  spawnSkirmish(): { friendly: number[]; hostile: number[] };
  /** Total hit points remaining on a side — a cheap way to prove a fight is actually happening. */
  totalHp(side: "soviet" | "allied"): number;
  /** Hit points remaining across a specific set of entities (dead ones count as zero). */
  hpOf(ids: number[]): number;
  effectCount(): number;
  projectileCount(): number;
}

declare global {
  interface Window {
    __ra?: RaTestBridge;
  }
}

export function installTestBridge(game: Game, camera: Camera): void {
  if (!import.meta.env.DEV) return;
  const world = game.world;
  window.__ra = {
    tick: () => world.tick,
    status: () => world.status,
    selectionSize: () => world.selection.size,
    selectionIds: () => [...world.selection],
    credits: () => Math.floor(world.players[world.humanSide].credits),
    power: () => ({
      produced: world.players[world.humanSide].powerProduced,
      consumed: world.players[world.humanSide].powerConsumed,
    }),
    unitCount: () => world.units.length,
    unitPositions: () =>
      world.units
        .filter((u) => u.side === world.humanSide)
        .map((u) => ({ id: u.id, kind: u.kind, x: u.x, y: u.y })),
    structureCounts: () => {
      const counts: Record<string, number> = {};
      for (const s of world.structures) {
        if (s.side !== world.humanSide) continue;
        counts[s.kind] = (counts[s.kind] ?? 0) + 1;
        // Touch the def so an unknown structure kind fails loudly here rather than at draw time.
        structureDef(s.kind);
      }
      return counts;
    },
    camera: () => ({ x: camera.x, y: camera.y, zoom: camera.zoom }),
    grantCredits: (amount: number) => {
      game.dispatch({ type: "cheatCredits", side: world.humanSide, amount });
    },
    placementSpot: (kind: string) => {
      const structureKind = kind as StructureKindId;
      const def = structureDef(structureKind);
      const home = world.structures.find(
        (s) => s.side === world.humanSide && s.kind === "conyard" && !s.dead,
      );
      if (!home) return null;

      const view = camera.visibleTiles(-1);
      // Spiral out from the Construction Yard so the site stays inside the build radius.
      for (let r = 2; r <= 8; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const tx = home.tx + dx;
            const ty = home.ty + dy;
            if (tx < view.x0 || ty < view.y0 || tx + def.w > view.x1 || ty + def.h > view.y1) {
              continue;
            }
            if (!isPlacementLegal(world, world.humanSide, structureKind, tx, ty)) continue;
            // The controller centres the footprint on the cursor, so aim at the middle tile.
            const anchorX = (tx + Math.floor((def.w - 1) / 2) + 0.5) * TILE;
            const anchorY = (ty + Math.floor((def.h - 1) / 2) + 0.5) * TILE;
            return {
              x: camera.worldToScreenX(anchorX),
              y: camera.worldToScreenY(anchorY),
              tx,
              ty,
            };
          }
        }
      }
      return null;
    },
    spawnSkirmish: () => {
      // Place both forces just below the centre of the current view, four tiles apart so they
      // are inside cannon range and open fire straight away.
      const cx = camera.x + camera.viewportWidth / camera.zoom / 2;
      const cy = camera.y + camera.viewportHeight / camera.zoom / 2;
      const friendly: number[] = [];
      const hostile: number[] = [];
      for (let i = 0; i < 4; i++) {
        friendly.push(
          world.spawnUnit("3tnk", "soviet", cx - TILE * 2, cy + (i - 1.5) * TILE * 1.6, 0).id,
        );
        hostile.push(
          world.spawnUnit("2tnk", "allied", cx + TILE * 3, cy + (i - 1.5) * TILE * 1.6, Math.PI).id,
        );
      }
      hostile.push(
        world.spawnUnit("e1a", "allied", cx + TILE * 4, cy + TILE * 2, Math.PI).id,
        world.spawnUnit("e1a", "allied", cx + TILE * 4, cy - TILE * 2, Math.PI).id,
      );
      return { friendly, hostile };
    },
    totalHp: (side) => {
      let sum = 0;
      for (const u of world.units) if (u.side === side && !u.dead) sum += u.hp;
      for (const s of world.structures) if (s.side === side && !s.dead) sum += s.hp;
      return Math.round(sum);
    },
    hpOf: (ids: number[]) => {
      let sum = 0;
      for (const id of ids) {
        const e = world.entity(id);
        if (e && !e.dead) sum += e.hp;
      }
      return Math.round(sum);
    },
    effectCount: () => world.effects.length,
    projectileCount: () => world.projectiles.length,
  };
}

export function removeTestBridge(): void {
  if (typeof window !== "undefined") delete window.__ra;
}
