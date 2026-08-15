import { TILE } from "../constants";
import { unitDef, weaponDef } from "../rules";
import type { Order, Unit } from "../types";
import { dist, worldToTileX, worldToTileY } from "../util/vec";
import type { World } from "../world";
import { clearPath, hasArrived, requestPath, setDestination } from "./movement";

/** Re-issue an attack path at most this often (ticks) while chasing a moving target. */
const CHASE_REPATH_INTERVAL = 20;

/** Replaces a unit's order, cancelling any queued follow-ups unless `queue` is set. */
export function giveOrder(world: World, u: Unit, order: Order, queue = false): void {
  if (queue && u.order.type !== "idle" && u.order.type !== "guard") {
    u.queued.push(order);
    return;
  }
  u.queued.length = 0;
  applyOrder(world, u, order);
}

export function applyOrder(_world: World, u: Unit, order: Order): void {
  u.order = order;
  u.targetId = 0;
  clearPath(u);

  switch (order.type) {
    case "move":
    case "attackMove":
    case "forceFire":
      setDestination(u, worldToTileX(order.x), worldToTileY(order.y));
      break;
    case "attack":
    case "enter":
    case "repairAt":
      u.targetId = order.targetId;
      break;
    case "harvest":
      setDestination(u, order.tx, order.ty);
      break;
    case "deliver":
      u.targetId = order.refineryId;
      break;
    case "idle":
    case "guard":
    case "deploy":
      break;
  }
}

/** Pops the next queued order, or falls back to guarding in place. */
export function finishOrder(world: World, u: Unit): void {
  const next = u.queued.shift();
  applyOrder(world, u, next ?? { type: "guard" });
}

/**
 * Turns high-level orders into path requests and detects completion.
 *
 * Harvesting and combat have their own systems; this one owns movement-shaped orders and the
 * shared "ask for a path, retry if the budget ran out" plumbing.
 */
export function orderSystem(world: World): void {
  for (const u of world.units) {
    if (u.dead) continue;
    u.age++;

    // Service a pending path request for any order type.
    if (u.pathPending && u.destTx >= 0) {
      const goalRadius = u.order.type === "attack" || u.order.type === "harvest" ? 3 : 1;
      const result = requestPath(world, u, u.destTx, u.destTy, { goalRadius });
      if (result === "ok") {
        u.pathPending = false;
      } else if (result === "nopath") {
        u.pathPending = false;
        u.destTx = -1;
        u.destTy = -1;
        if (u.order.type === "move" || u.order.type === "attackMove") {
          finishOrder(world, u);
        }
      }
      // "budget" → keep pathPending set and retry next tick.
    }

    switch (u.order.type) {
      case "move":
      case "attackMove":
      case "forceFire": {
        if (hasArrived(u)) finishOrder(world, u);
        break;
      }

      case "attack": {
        const target = world.entity(u.targetId);
        if (!target || ("dead" in target && target.dead)) {
          finishOrder(world, u);
          break;
        }
        const def = unitDef(u.kind);
        if (!def.weapon) {
          finishOrder(world, u);
          break;
        }
        const range = weaponDef(def.weapon).range;
        const centre = world.entityCenter(target);
        const reach = range + world.entityRadius(target) * 0.6;
        const d = dist(u.x, u.y, centre.x, centre.y);

        if (d <= reach) {
          // In range: stop moving and let the combat system do the shooting.
          if (u.path.length > 0 || u.pathPending) clearPath(u);
        } else if (!u.pathPending && (hasArrived(u) || u.age % CHASE_REPATH_INTERVAL === 0)) {
          setDestination(u, worldToTileX(centre.x), worldToTileY(centre.y));
        }
        break;
      }

      case "enter":
      case "repairAt": {
        const target = world.entity(u.targetId);
        if (!target || ("dead" in target && target.dead)) {
          finishOrder(world, u);
          break;
        }
        const centre = world.entityCenter(target);
        const d = dist(u.x, u.y, centre.x, centre.y);
        if (d <= world.entityRadius(target) + TILE * 0.6) {
          // Arrival behaviour (capture / repair) is handled by the owning system.
          break;
        }
        if (!u.pathPending && hasArrived(u)) {
          setDestination(u, worldToTileX(centre.x), worldToTileY(centre.y));
        }
        break;
      }

      case "guard":
      case "idle":
      case "harvest":
      case "deliver":
      case "deploy":
        break;
    }
  }
}
