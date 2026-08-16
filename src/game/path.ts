import type { Vec3 } from "./types";

export interface Waypoint {
  id: string;
  pos: Vec3;
  neighbors: string[];
}

export function findPath(waypoints: Waypoint[], fromId: string, toId: string): string[] {
  if (fromId === toId) return [toId];
  const map = new Map(waypoints.map((w) => [w.id, w]));
  if (!map.has(fromId) || !map.has(toId)) return [fromId];

  const queue = [fromId];
  const prev = new Map<string, string | null>([[fromId, null]]);

  while (queue.length > 0) {
    const cur = queue.shift();
    if (!cur) break;
    const node = map.get(cur);
    if (!node) continue;
    for (const next of node.neighbors) {
      if (prev.has(next)) continue;
      prev.set(next, cur);
      if (next === toId) return reconstruct(prev, toId);
      queue.push(next);
    }
  }
  return [fromId];
}

function reconstruct(prev: Map<string, string | null>, end: string): string[] {
  const path = [end];
  let cursor: string | null = end;
  while (cursor) {
    const p: string | null = prev.get(cursor) ?? null;
    if (p === null) break;
    path.unshift(p);
    cursor = p;
  }
  return path;
}

export function nearestWaypoint(waypoints: Waypoint[], pos: Vec3): Waypoint {
  if (waypoints.length === 0) {
    throw new Error("no waypoints");
  }
  let best = waypoints[0];
  let bestD = Infinity;
  for (const w of waypoints) {
    const d = (w.pos.x - pos.x) ** 2 + (w.pos.z - pos.z) ** 2;
    if (d < bestD) {
      bestD = d;
      best = w;
    }
  }
  return best;
}
