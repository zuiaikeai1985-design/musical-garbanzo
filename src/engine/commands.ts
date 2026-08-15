import type { EntityId, Order, QueueKind, Side, StructureKindId, UnitKindId } from "./types";

/**
 * Everything the player (or a test) can ask the simulation to do.
 *
 * The UI and input layers never mutate entities directly — they push commands onto
 * `world.commands`, which `Game.tick()` drains at the start of the next tick. That keeps all
 * mutation inside the simulation and makes matches reproducible from a command log.
 */
export type Command =
  | { type: "select"; ids: EntityId[] }
  | { type: "order"; ids: EntityId[]; order: Order; queue: boolean }
  | { type: "queueAdd"; side: Side; queue: QueueKind; what: UnitKindId | StructureKindId }
  | { type: "queueCancel"; side: Side; queue: QueueKind; what: UnitKindId | StructureKindId }
  | { type: "queueToggleHold"; side: Side; queue: QueueKind }
  | { type: "placeStructure"; side: Side; what: StructureKindId; tx: number; ty: number }
  | { type: "sellStructure"; id: EntityId }
  | { type: "toggleRepair"; id: EntityId }
  | { type: "setRally"; id: EntityId; x: number; y: number }
  | { type: "launchNuke"; id: EntityId; x: number; y: number }
  | { type: "cheatCredits"; side: Side; amount: number };
