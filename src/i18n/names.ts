import type { EvaKey, StructureKindId, UnitKindId } from "../engine/types";
import type { Translation, TranslationKey } from "./en";

/**
 * Maps engine identifiers onto translation keys.
 *
 * The casts are contained here rather than sprinkled through the UI, and the exhaustive
 * `Record<...>` types below mean adding a new unit, structure or EVA line without a translation
 * is a compile error.
 */
const UNIT_KEY: Record<UnitKindId, TranslationKey> = {
  e1: "unit_e1",
  e2: "unit_e2",
  e3: "unit_e3",
  e6: "unit_e6",
  dog: "unit_dog",
  harv: "unit_harv",
  "3tnk": "unit_3tnk",
  "4tnk": "unit_4tnk",
  v2rl: "unit_v2rl",
  mcv: "unit_mcv",
  e1a: "unit_e1a",
  e3a: "unit_e3a",
  jeep: "unit_jeep",
  "1tnk": "unit_1tnk",
  "2tnk": "unit_2tnk",
  arty: "unit_arty",
  harva: "unit_harva",
};

const STRUCTURE_KEY: Record<StructureKindId, TranslationKey> = {
  conyard: "struct_conyard",
  power: "struct_power",
  refinery: "struct_refinery",
  silo: "struct_silo",
  barracks: "struct_barracks",
  kennel: "struct_kennel",
  warfactory: "struct_warfactory",
  radar: "struct_radar",
  depot: "struct_depot",
  flametower: "struct_flametower",
  tesla: "struct_tesla",
  wall: "struct_wall",
  nukesilo: "struct_nukesilo",
  conyard_a: "struct_conyard_a",
  power_a: "struct_power_a",
  refinery_a: "struct_refinery_a",
  barracks_a: "struct_barracks_a",
  warfactory_a: "struct_warfactory_a",
  pillbox: "struct_pillbox",
  turret: "struct_turret",
};

const EVA_KEY: Record<EvaKey, TranslationKey> = {
  constructionComplete: "eva_constructionComplete",
  unitReady: "eva_unitReady",
  buildingInfo: "eva_buildingInfo",
  newConstructionOptions: "eva_newConstructionOptions",
  insufficientFunds: "eva_insufficientFunds",
  silosNeeded: "eva_silosNeeded",
  lowPower: "eva_lowPower",
  baseUnderAttack: "eva_baseUnderAttack",
  unitLost: "eva_unitLost",
  structureLost: "eva_structureLost",
  cannotDeployHere: "eva_cannotDeployHere",
  unableToComply: "eva_unableToComply",
  primaryBuildingSelected: "eva_primaryBuildingSelected",
  missionAccomplished: "eva_missionAccomplished",
  missionFailed: "eva_missionFailed",
  nuclearWeaponAvailable: "eva_nuclearWeaponAvailable",
  nuclearWeaponLaunched: "eva_nuclearWeaponLaunched",
  radarOnline: "eva_radarOnline",
  radarOffline: "eva_radarOffline",
  repairing: "eva_repairing",
  buildingCaptured: "eva_buildingCaptured",
  ourBaseIsUnderAttack: "eva_ourBaseIsUnderAttack",
};

export function unitName(t: Translation, kind: UnitKindId): string {
  return t[UNIT_KEY[kind]];
}

export function structureName(t: Translation, kind: StructureKindId): string {
  return t[STRUCTURE_KEY[kind]];
}

export function evaText(t: Translation, key: EvaKey): string {
  return t[EVA_KEY[key]];
}

/** Name for anything buildable, whichever kind it turns out to be. */
export function buildableName(
  t: Translation,
  id: UnitKindId | StructureKindId,
  isStructure: boolean,
): string {
  return isStructure
    ? structureName(t, id as StructureKindId)
    : unitName(t, id as UnitKindId);
}
