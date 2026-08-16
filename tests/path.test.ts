import { describe, expect, it } from "vitest";
import { findPath, nearestWaypoint, type Waypoint } from "../src/game/path";

const graph: Waypoint[] = [
  { id: "a", pos: { x: 0, y: 0, z: 0 }, neighbors: ["b"] },
  { id: "b", pos: { x: 5, y: 0, z: 0 }, neighbors: ["a", "c"] },
  { id: "c", pos: { x: 10, y: 0, z: 0 }, neighbors: ["b"] },
];

describe("findPath", () => {
  it("returns a shortest waypoint chain", () => {
    expect(findPath(graph, "a", "c")).toEqual(["a", "b", "c"]);
  });

  it("returns a single node when already there", () => {
    expect(findPath(graph, "b", "b")).toEqual(["b"]);
  });

  it("returns the start when the goal is unknown", () => {
    expect(findPath(graph, "a", "missing")).toEqual(["a"]);
  });
});

describe("nearestWaypoint", () => {
  it("picks the closest node", () => {
    expect(nearestWaypoint(graph, { x: 9, y: 0, z: 1 }).id).toBe("c");
  });
});
