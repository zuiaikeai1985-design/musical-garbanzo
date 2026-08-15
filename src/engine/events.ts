import type { EntityId, EvaKey, Side, StructureKindId, UnitKindId } from "./types";

/** Sound cue identifiers. `src/audio/cues.ts` maps these to generated audio files. */
export type SoundCue =
  | "uiClick"
  | "uiError"
  | "select"
  | "moveAck"
  | "attackAck"
  | "creditTick"
  | "buildStart"
  | "buildComplete"
  | "placeBuilding"
  | "sell"
  | "repair"
  | "rifle"
  | "mg"
  | "cannon"
  | "cannonHeavy"
  | "rocketLaunch"
  | "grenade"
  | "flame"
  | "tesla"
  | "dogBark"
  | "explosionSmall"
  | "explosionMedium"
  | "explosionLarge"
  | "structureExplode"
  | "infantryDie"
  | "harvest"
  | "unload"
  | "radarOn"
  | "radarOff"
  | "klaxon"
  | "nukeLaunch"
  | "nukeImpact"
  | "victory"
  | "defeat";

/**
 * Events the simulation emits for the presentation layers. The engine only ever pushes onto a
 * queue (`world.events`); the app drains it each animation frame. This keeps the engine free of
 * callbacks into DOM/React code and keeps it headless-testable.
 */
export type EngineEvent =
  | { type: "eva"; key: EvaKey; side: Side; x: number; y: number }
  | { type: "sound"; cue: SoundCue; x: number; y: number; side: Side | null }
  | { type: "unitCreated"; id: EntityId; kind: UnitKindId; side: Side }
  | { type: "unitDestroyed"; id: EntityId; kind: UnitKindId; side: Side; x: number; y: number }
  | {
      type: "structureCreated";
      id: EntityId;
      kind: StructureKindId;
      side: Side;
      tx: number;
      ty: number;
    }
  | {
      type: "structureDestroyed";
      id: EntityId;
      kind: StructureKindId;
      side: Side;
      x: number;
      y: number;
    }
  | { type: "screenShake"; magnitude: number; x: number; y: number }
  | { type: "gameOver"; victory: boolean };
