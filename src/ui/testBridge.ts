import type { Game } from "../engine/game";
import { structureDef } from "../engine/rules";
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
  };
}

export function removeTestBridge(): void {
  if (typeof window !== "undefined") delete window.__ra;
}
