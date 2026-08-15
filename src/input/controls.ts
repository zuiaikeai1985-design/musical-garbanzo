import { TILE } from "../engine/constants";
import type { Game } from "../engine/game";
import { structureDef, unitDef } from "../engine/rules";
import { isPlacementLegal } from "../engine/systems/production";
import type { EntityId, Order, StructureKindId } from "../engine/types";
import { worldToTileX, worldToTileY } from "../engine/util/vec";
import type { Camera } from "../render/camera";
import { MAX_ZOOM, MIN_ZOOM } from "../render/camera";
import type { RenderOverlay } from "../render/renderer";

/** How close to the window edge the pointer must be to scroll, in CSS pixels. */
const EDGE_MARGIN = 12;
/** Camera speed in world pixels per second. */
const SCROLL_SPEED = 900;
/** Pointer travel (px) before a click becomes a drag-select. */
const DRAG_THRESHOLD = 5;

export type CursorKind = "default" | "move" | "attack" | "harvest" | "select" | "noEntry" | "sell" | "repair";

export interface ControllerCallbacks {
  onSelectionChanged?: () => void;
  onPlacementDone?: (kind: StructureKindId) => void;
  onPlacementCancelled?: () => void;
  onCursorChanged?: (cursor: CursorKind) => void;
  /** Fired when the player presses a key the UI cares about (tab cycling, language, menu…). */
  onHotkey?: (key: string) => void;
}

/**
 * Translates raw DOM input into engine commands.
 *
 * Nothing here mutates the world directly — every action becomes a `Command` on the game's queue,
 * which keeps input replayable and the simulation authoritative.
 */
export class GameController {
  readonly overlay: RenderOverlay = {
    marquee: null,
    placement: null,
    hoveredId: 0,
    shakeX: 0,
    shakeY: 0,
  };

  /** Set while the sidebar has handed us a structure to position. */
  private placingKind: StructureKindId | null = null;
  private sellMode = false;
  private repairMode = false;

  private keys = new Set<string>();
  private pointerX = -1;
  private pointerY = -1;
  private pointerInside = false;
  private dragStart: { x: number; y: number } | null = null;
  private dragging = false;
  private panning: { x: number; y: number } | null = null;
  private cursor: CursorKind = "default";
  private detachers: (() => void)[] = [];

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly game: Game,
    private readonly camera: Camera,
    private readonly callbacks: ControllerCallbacks = {},
  ) {}

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  attach(): void {
    const on = <K extends keyof HTMLElementEventMap>(
      target: HTMLElement | Window,
      type: K,
      handler: (e: HTMLElementEventMap[K]) => void,
      options?: AddEventListenerOptions,
    ) => {
      target.addEventListener(type, handler as EventListener, options);
      this.detachers.push(() => target.removeEventListener(type, handler as EventListener));
    };

    on(this.canvas, "pointerdown", this.onPointerDown);
    on(window as unknown as HTMLElement, "pointerup", this.onPointerUp);
    on(window as unknown as HTMLElement, "pointermove", this.onPointerMove);
    on(this.canvas, "wheel", this.onWheel, { passive: false });
    on(this.canvas, "contextmenu", (e) => e.preventDefault());
    on(this.canvas, "pointerenter", (e) => {
      this.pointerInside = true;
      const rect = this.canvas.getBoundingClientRect();
      this.pointerX = e.clientX - rect.left;
      this.pointerY = e.clientY - rect.top;
    });
    on(this.canvas, "pointerleave", () => {
      this.pointerInside = false;
      this.pointerX = -1;
      this.pointerY = -1;
    });
    on(window as unknown as HTMLElement, "keydown", this.onKeyDown);
    on(window as unknown as HTMLElement, "keyup", this.onKeyUp);
    on(window as unknown as HTMLElement, "blur", () => this.keys.clear());
  }

  detach(): void {
    for (const off of this.detachers) off();
    this.detachers = [];
  }

  // ── Per-frame ─────────────────────────────────────────────────────────────

  /** Applies keyboard and edge scrolling. `dt` is in seconds. */
  update(dt: number, edgeScrollEnabled: boolean): void {
    let dx = 0;
    let dy = 0;
    if (this.keys.has("arrowleft") || this.keys.has("a")) dx -= 1;
    if (this.keys.has("arrowright") || this.keys.has("d")) dx += 1;
    if (this.keys.has("arrowup") || this.keys.has("w")) dy -= 1;
    if (this.keys.has("arrowdown") || this.keys.has("s")) dy += 1;

    // Only edge-scroll once we have a real pointer position; the sentinel (-1,-1) would otherwise
    // read as "hard against the top-left corner" and drag the camera away on its own.
    if (
      edgeScrollEnabled &&
      this.pointerInside &&
      !this.dragging &&
      this.pointerX >= 0 &&
      this.pointerY >= 0
    ) {
      const rect = this.canvas.getBoundingClientRect();
      if (this.pointerX < EDGE_MARGIN) dx -= 1;
      if (this.pointerX > rect.width - EDGE_MARGIN) dx += 1;
      if (this.pointerY < EDGE_MARGIN) dy -= 1;
      if (this.pointerY > rect.height - EDGE_MARGIN) dy += 1;
    }

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy) || 1;
      const speed = (SCROLL_SPEED * dt) / this.camera.zoom;
      this.camera.move((dx / len) * speed, (dy / len) * speed);
    }
  }

  // ── Placement mode ────────────────────────────────────────────────────────

  beginPlacement(kind: StructureKindId): void {
    this.placingKind = kind;
    this.sellMode = false;
    this.repairMode = false;
    this.updatePlacementPreview();
  }

  cancelPlacement(): void {
    if (!this.placingKind) return;
    this.placingKind = null;
    this.overlay.placement = null;
    this.callbacks.onPlacementCancelled?.();
  }

  get isPlacing(): boolean {
    return this.placingKind !== null;
  }

  setSellMode(on: boolean): void {
    this.sellMode = on;
    if (on) {
      this.repairMode = false;
      this.cancelPlacement();
    }
    this.setCursor(on ? "sell" : "default");
  }

  setRepairMode(on: boolean): void {
    this.repairMode = on;
    if (on) {
      this.sellMode = false;
      this.cancelPlacement();
    }
    this.setCursor(on ? "repair" : "default");
  }

  get isSelling(): boolean {
    return this.sellMode;
  }

  get isRepairing(): boolean {
    return this.repairMode;
  }

  // ── Pointer ───────────────────────────────────────────────────────────────

  private onPointerDown = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.pointerX = x;
    this.pointerY = y;

    if (e.button === 1) {
      e.preventDefault();
      this.panning = { x, y };
      return;
    }

    if (e.button === 0) {
      if (this.placingKind) {
        this.commitPlacement();
        return;
      }
      if (this.sellMode || this.repairMode) {
        this.applyStructureTool(x, y);
        return;
      }
      this.dragStart = { x, y };
      this.dragging = false;
      return;
    }

    if (e.button === 2) {
      e.preventDefault();
      if (this.placingKind) {
        this.cancelPlacement();
        return;
      }
      if (this.sellMode || this.repairMode) {
        this.setSellMode(false);
        this.setRepairMode(false);
        return;
      }
      this.issueOrder(x, y, e.shiftKey);
    }
  };

  private onPointerMove = (e: PointerEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.pointerX = e.clientX - rect.left;
    this.pointerY = e.clientY - rect.top;

    if (this.panning) {
      const dx = (this.panning.x - this.pointerX) / this.camera.zoom;
      const dy = (this.panning.y - this.pointerY) / this.camera.zoom;
      this.camera.move(dx, dy);
      this.panning = { x: this.pointerX, y: this.pointerY };
      return;
    }

    if (this.dragStart) {
      const moved = Math.hypot(this.pointerX - this.dragStart.x, this.pointerY - this.dragStart.y);
      if (moved > DRAG_THRESHOLD) this.dragging = true;
      if (this.dragging) {
        this.overlay.marquee = {
          x0: this.dragStart.x,
          y0: this.dragStart.y,
          x1: this.pointerX,
          y1: this.pointerY,
        };
      }
    }

    if (this.placingKind) this.updatePlacementPreview();
    this.updateHoverCursor();
  };

  private onPointerUp = (e: PointerEvent): void => {
    if (e.button === 1) {
      this.panning = null;
      return;
    }
    if (e.button !== 0 || !this.dragStart) return;

    if (this.dragging && this.overlay.marquee) {
      this.selectInRect(this.overlay.marquee, e.shiftKey);
    } else {
      this.selectAtPoint(this.dragStart.x, this.dragStart.y, e.shiftKey, e.detail >= 2);
    }

    this.dragStart = null;
    this.dragging = false;
    this.overlay.marquee = null;
  };

  private onWheel = (e: WheelEvent): void => {
    e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const delta = e.deltaY > 0 ? -1 : 1;
    this.camera.setZoom(this.camera.zoom + delta, e.clientX - rect.left, e.clientY - rect.top);
  };

  // ── Keyboard ──────────────────────────────────────────────────────────────

  private onKeyDown = (e: KeyboardEvent): void => {
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA")) return;

    const key = e.key.toLowerCase();
    this.keys.add(key);

    // Control groups.
    if (/^[1-9]$/.test(key)) {
      const index = Number(key);
      if (e.ctrlKey || e.metaKey) {
        this.game.world.controlGroups[index] = new Set(this.game.world.selection);
      } else {
        const group = this.game.world.controlGroups[index];
        const alive = [...group].filter((id) => this.game.world.isAlive(id));
        if (alive.length > 0) {
          this.game.dispatch({ type: "select", ids: alive });
          this.callbacks.onSelectionChanged?.();
          if (e.shiftKey) this.centerOnSelection(alive);
        }
      }
      e.preventDefault();
      return;
    }

    switch (key) {
      case "escape":
        if (this.placingKind) this.cancelPlacement();
        else if (this.sellMode) this.setSellMode(false);
        else if (this.repairMode) this.setRepairMode(false);
        else this.callbacks.onHotkey?.("escape");
        break;
      case "s":
        if (!e.ctrlKey) this.orderSelected({ type: "guard" });
        break;
      case "x":
        this.scatterSelected();
        break;
      case "g":
        this.orderSelected({ type: "guard" });
        break;
      case "h":
        this.centerOnBase();
        break;
      case "=":
      case "+":
        this.camera.setZoom(Math.min(MAX_ZOOM, this.camera.zoom + 1));
        break;
      case "-":
      case "_":
        this.camera.setZoom(Math.max(MIN_ZOOM, this.camera.zoom - 1));
        break;
      case "tab":
        e.preventDefault();
        this.callbacks.onHotkey?.("tab");
        break;
      case "l":
      case "p":
      case "f1":
      case " ":
        this.callbacks.onHotkey?.(key);
        break;
      default:
        break;
    }
  };

  private onKeyUp = (e: KeyboardEvent): void => {
    this.keys.delete(e.key.toLowerCase());
  };

  // ── Selection ─────────────────────────────────────────────────────────────

  private selectAtPoint(sx: number, sy: number, additive: boolean, doubleClick: boolean): void {
    const world = this.game.world;
    const wx = this.camera.screenToWorldX(sx);
    const wy = this.camera.screenToWorldY(sy);

    const unit = this.unitAt(wx, wy);
    let ids: EntityId[] = [];

    if (unit) {
      if (doubleClick && unit.side === world.humanSide) {
        // Select every visible unit of the same type.
        const view = this.viewportWorldRect();
        ids = world.units
          .filter(
            (u) =>
              u.side === world.humanSide &&
              u.kind === unit.kind &&
              u.x >= view.x0 &&
              u.x <= view.x1 &&
              u.y >= view.y0 &&
              u.y <= view.y1,
          )
          .map((u) => u.id);
      } else {
        ids = [unit.id];
      }
    } else {
      const structure = this.structureAt(wx, wy);
      if (structure) ids = [structure.id];
    }

    if (additive) {
      const merged = new Set(world.selection);
      for (const id of ids) {
        if (merged.has(id)) merged.delete(id);
        else merged.add(id);
      }
      ids = [...merged];
    }

    this.game.dispatch({ type: "select", ids });
    this.callbacks.onSelectionChanged?.();
  }

  private selectInRect(
    marquee: { x0: number; y0: number; x1: number; y1: number },
    additive: boolean,
  ): void {
    const world = this.game.world;
    const x0 = this.camera.screenToWorldX(Math.min(marquee.x0, marquee.x1));
    const x1 = this.camera.screenToWorldX(Math.max(marquee.x0, marquee.x1));
    const y0 = this.camera.screenToWorldY(Math.min(marquee.y0, marquee.y1));
    const y1 = this.camera.screenToWorldY(Math.max(marquee.y0, marquee.y1));

    let ids = world.units
      .filter((u) => u.side === world.humanSide && u.x >= x0 && u.x <= x1 && u.y >= y0 && u.y <= y1)
      .map((u) => u.id);

    // Marquee never picks up enemy units; if it caught nothing, keep the old selection.
    if (ids.length === 0 && !additive) {
      this.game.dispatch({ type: "select", ids: [] });
      this.callbacks.onSelectionChanged?.();
      return;
    }

    if (additive) ids = [...new Set([...world.selection, ...ids])];
    this.game.dispatch({ type: "select", ids });
    this.callbacks.onSelectionChanged?.();
  }

  private unitAt(wx: number, wy: number) {
    const world = this.game.world;
    let best: (typeof world.units)[number] | null = null;
    let bestDist = Infinity;
    for (const u of world.units) {
      if (u.dead) continue;
      const r = unitDef(u.kind).radius + 4;
      const d = Math.hypot(u.x - wx, u.y - wy);
      if (d <= r && d < bestDist) {
        best = u;
        bestDist = d;
      }
    }
    return best;
  }

  private structureAt(wx: number, wy: number) {
    const world = this.game.world;
    const id = world.grid.structureIdAt(worldToTileX(wx), worldToTileY(wy));
    return id ? (world.structure(id) ?? null) : null;
  }

  private viewportWorldRect() {
    return {
      x0: this.camera.x,
      y0: this.camera.y,
      x1: this.camera.x + this.camera.viewportWidth / this.camera.zoom,
      y1: this.camera.y + this.camera.viewportHeight / this.camera.zoom,
    };
  }

  private centerOnSelection(ids: EntityId[]): void {
    const world = this.game.world;
    let sx = 0;
    let sy = 0;
    let n = 0;
    for (const id of ids) {
      const e = world.entity(id);
      if (!e) continue;
      const c = world.entityCenter(e);
      sx += c.x;
      sy += c.y;
      n++;
    }
    if (n > 0) this.camera.centerOn(sx / n, sy / n);
  }

  private centerOnBase(): void {
    const world = this.game.world;
    const base = world.structures.find(
      (s) => s.side === world.humanSide && !s.dead && structureDef(s.kind).producesQueue !== null,
    );
    if (base) {
      const c = world.structureCenter(base);
      this.camera.centerOn(c.x, c.y);
    }
  }

  // ── Orders ────────────────────────────────────────────────────────────────

  private selectedUnitIds(): EntityId[] {
    const world = this.game.world;
    return [...world.selection].filter((id) => {
      const u = world.unit(id);
      return !!u && u.side === world.humanSide;
    });
  }

  private orderSelected(order: Order, queue = false): void {
    const ids = this.selectedUnitIds();
    if (ids.length === 0) return;
    this.game.dispatch({ type: "order", ids, order, queue });
  }

  private scatterSelected(): void {
    const world = this.game.world;
    const ids = this.selectedUnitIds();
    for (const id of ids) {
      const u = world.unit(id);
      if (!u) continue;
      const angle = (u.id % 8) * (Math.PI / 4);
      this.game.dispatch({
        type: "order",
        ids: [id],
        order: {
          type: "move",
          x: u.x + Math.cos(angle) * TILE * 2,
          y: u.y + Math.sin(angle) * TILE * 2,
        },
        queue: false,
      });
    }
  }

  private issueOrder(sx: number, sy: number, queue: boolean): void {
    const world = this.game.world;
    const ids = this.selectedUnitIds();
    const wx = this.camera.screenToWorldX(sx);
    const wy = this.camera.screenToWorldY(sy);

    // Right-clicking with only a structure selected sets its rally point.
    if (ids.length === 0) {
      for (const id of world.selection) {
        const s = world.structure(id);
        if (s && s.side === world.humanSide && structureDef(s.kind).producesQueue) {
          this.game.dispatch({ type: "setRally", id, x: wx, y: wy });
        }
      }
      return;
    }

    const targetUnit = this.unitAt(wx, wy);
    const targetStructure = targetUnit ? null : this.structureAt(wx, wy);
    const target = targetUnit ?? targetStructure;

    if (target && target.side !== world.humanSide) {
      this.game.dispatch({
        type: "order",
        ids,
        order: { type: "attack", targetId: target.id },
        queue,
      });
      return;
    }

    const tx = worldToTileX(wx);
    const ty = worldToTileY(wy);
    const oreHere = world.grid.getOre(tx, ty) > 0;

    // Harvesters get contextual harvest / deliver orders.
    const harvesters = ids.filter((id) => {
      const u = world.unit(id);
      return !!u && unitDef(u.kind).cargoCapacity > 0;
    });
    const others = ids.filter((id) => !harvesters.includes(id));

    if (harvesters.length > 0) {
      if (oreHere) {
        this.game.dispatch({
          type: "order",
          ids: harvesters,
          order: { type: "harvest", tx, ty },
          queue,
        });
      } else if (
        targetStructure &&
        targetStructure.side === world.humanSide &&
        structureDef(targetStructure.kind).isRefinery
      ) {
        this.game.dispatch({
          type: "order",
          ids: harvesters,
          order: { type: "deliver", refineryId: targetStructure.id },
          queue,
        });
      } else {
        this.game.dispatch({
          type: "order",
          ids: harvesters,
          order: { type: "move", x: wx, y: wy },
          queue,
        });
      }
    }

    if (others.length > 0) {
      this.game.dispatch({
        type: "order",
        ids: others,
        order: { type: "move", x: wx, y: wy },
        queue,
      });
    }
  }

  private applyStructureTool(sx: number, sy: number): void {
    const world = this.game.world;
    const wx = this.camera.screenToWorldX(sx);
    const wy = this.camera.screenToWorldY(sy);
    const s = this.structureAt(wx, wy);
    if (!s || s.side !== world.humanSide) return;
    if (this.sellMode) {
      this.game.dispatch({ type: "sellStructure", id: s.id });
    } else if (this.repairMode) {
      this.game.dispatch({ type: "toggleRepair", id: s.id });
    }
  }

  // ── Placement ─────────────────────────────────────────────────────────────

  private placementTile(): { tx: number; ty: number } | null {
    if (!this.placingKind) return null;
    const def = structureDef(this.placingKind);
    const wx = this.camera.screenToWorldX(this.pointerX);
    const wy = this.camera.screenToWorldY(this.pointerY);
    return {
      tx: worldToTileX(wx) - Math.floor((def.w - 1) / 2),
      ty: worldToTileY(wy) - Math.floor((def.h - 1) / 2),
    };
  }

  private updatePlacementPreview(): void {
    const tile = this.placementTile();
    if (!tile || !this.placingKind) {
      this.overlay.placement = null;
      return;
    }
    this.overlay.placement = {
      kind: this.placingKind,
      tx: tile.tx,
      ty: tile.ty,
      valid: canPlace(this.game, this.placingKind, tile.tx, tile.ty),
    };
  }

  private commitPlacement(): void {
    const kind = this.placingKind;
    const tile = this.placementTile();
    if (!kind || !tile) return;
    if (!canPlace(this.game, kind, tile.tx, tile.ty)) return;

    this.game.dispatch({
      type: "placeStructure",
      side: this.game.world.humanSide,
      what: kind,
      tx: tile.tx,
      ty: tile.ty,
    });
    this.placingKind = null;
    this.overlay.placement = null;
    this.callbacks.onPlacementDone?.(kind);
  }

  // ── Cursor ────────────────────────────────────────────────────────────────

  private updateHoverCursor(): void {
    if (this.placingKind || this.sellMode || this.repairMode) return;
    const world = this.game.world;
    const wx = this.camera.screenToWorldX(this.pointerX);
    const wy = this.camera.screenToWorldY(this.pointerY);

    const unit = this.unitAt(wx, wy);
    const structure = unit ? null : this.structureAt(wx, wy);
    const target = unit ?? structure;
    this.overlay.hoveredId = target?.id ?? 0;

    const hasSelection = this.selectedUnitIds().length > 0;
    if (target && target.side !== world.humanSide) {
      this.setCursor(hasSelection ? "attack" : "select");
      return;
    }
    if (target) {
      this.setCursor("select");
      return;
    }
    if (hasSelection) {
      const tx = worldToTileX(wx);
      const ty = worldToTileY(wy);
      if (world.grid.getOre(tx, ty) > 0) {
        this.setCursor("harvest");
        return;
      }
      this.setCursor(world.grid.passable(tx, ty) ? "move" : "noEntry");
      return;
    }
    this.setCursor("default");
  }

  private setCursor(cursor: CursorKind): void {
    if (this.cursor === cursor) return;
    this.cursor = cursor;
    this.callbacks.onCursorChanged?.(cursor);
  }
}

/**
 * Placement preview validity.
 *
 * Deliberately delegates to the same engine predicate the `placeStructure` command uses, so the
 * green/red overlay can never disagree with what the simulation will accept.
 */
export function canPlace(game: Game, kind: StructureKindId, tx: number, ty: number): boolean {
  return isPlacementLegal(game.world, game.world.humanSide, kind, tx, ty);
}
