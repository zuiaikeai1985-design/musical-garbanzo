/**
 * English string table.
 *
 * This file is the SOURCE OF TRUTH for the translation key set: `zh.ts` is typed as
 * `typeof en`, so a missing or misspelled key there is a TypeScript compile error.
 */
export const en = {
  // ── App chrome ────────────────────────────────────────────────────────────
  appTitle: "RED ALERT",
  appSubtitle: "Soviet Command Network",
  languageName: "English",
  languageToggle: "中文",

  // ── Main menu ─────────────────────────────────────────────────────────────
  menuNewMission: "New Mission",
  menuContinue: "Resume",
  menuSettings: "Options",
  menuHelp: "Controls",
  menuCredits: "Credits",
  menuQuit: "Abort",
  menuDifficulty: "Difficulty",

  difficultyEasy: "Recruit",
  difficultyNormal: "Veteran",
  difficultyHard: "Commissar",

  // ── Loading ───────────────────────────────────────────────────────────────
  loading: "Loading",
  loadingSprites: "Rendering unit graphics",
  loadingTerrain: "Generating terrain",
  loadingAudio: "Loading audio",
  loadingReady: "Ready",

  // ── Briefing ──────────────────────────────────────────────────────────────
  briefingHeader: "MISSION BRIEFING",
  briefingClassified: "CLASSIFIED",
  briefingMissionLabel: "Mission 01",
  briefingMissionName: "Operation Iron Curtain",
  briefingObjectivesLabel: "Objectives",
  briefingProceed: "Proceed",
  briefingBack: "Back",
  briefingBody1:
    "Comrade Commander. Allied forces have established a forward command post across the river and are already drawing ore from the contested fields. Command will not tolerate a second Cairo.",
  briefingBody2:
    "You have a Construction Yard, two generators and a refinery. Everything else is on you. Take the ore, build the machine, and grind their base into the dirt.",
  briefingObjective1: "Establish an ore economy and expand the base",
  briefingObjective2: "Build an armoured force and defend the perimeter",
  briefingObjective3: "Destroy every Allied structure",

  // ── HUD ───────────────────────────────────────────────────────────────────
  hudCredits: "Credits",
  hudPower: "Power",
  hudPowerLow: "LOW POWER",
  hudNoRadar: "NO RADAR",
  hudSell: "Sell",
  hudRepair: "Repair",
  hudMap: "Map",
  hudReady: "READY",
  hudHold: "HOLD",
  hudBuilding: "BUILDING",
  hudPlace: "PLACE",
  hudTabStructures: "Build",
  hudTabDefense: "Defense",
  hudTabInfantry: "Infantry",
  hudTabVehicles: "Vehicles",

  // ── Pause / results ───────────────────────────────────────────────────────
  paused: "PAUSED",
  resume: "Resume",
  restart: "Restart Mission",
  abort: "Abort Mission",
  victoryTitle: "MISSION ACCOMPLISHED",
  defeatTitle: "MISSION FAILED",
  statUnitsBuilt: "Units Built",
  statUnitsLost: "Units Lost",
  statStructuresBuilt: "Structures Built",
  statStructuresLost: "Structures Lost",
  statEnemiesDestroyed: "Enemies Destroyed",
  statOreHarvested: "Ore Harvested",
  statTime: "Mission Time",
  statScore: "Score",

  // ── Settings ──────────────────────────────────────────────────────────────
  settingsTitle: "Options",
  settingsLanguage: "Language",
  settingsMusicVolume: "Music Volume",
  settingsSfxVolume: "Effects Volume",
  settingsZoom: "Zoom",
  settingsEdgeScroll: "Edge Scrolling",
  settingsOn: "On",
  settingsOff: "Off",
  settingsClose: "Close",

  // ── Help ──────────────────────────────────────────────────────────────────
  helpTitle: "Field Manual",
  helpSelect: "Select unit",
  helpMarquee: "Box-select units",
  helpAddSelect: "Add to selection",
  helpOrder: "Move / attack / harvest",
  helpGroupAssign: "Assign control group",
  helpGroupRecall: "Recall control group",
  helpStop: "Stop",
  helpGuard: "Guard",
  helpScatter: "Scatter",
  helpBase: "Jump to base",
  helpTabCycle: "Cycle sidebar tab",
  helpLanguage: "Toggle language",
  helpZoom: "Zoom in / out",
  helpPause: "Pause",
  helpMenu: "Menu / cancel",
  helpScroll: "Scroll the map",

  // ── Common ────────────────────────────────────────────────────────────────
  ok: "OK",
  cancel: "Cancel",
  yes: "Yes",
  no: "No",

  // ── Unit names ────────────────────────────────────────────────────────────
  unit_e1: "Rifle Infantry",
  unit_e2: "Grenadier",
  unit_e3: "Rocket Soldier",
  unit_e6: "Engineer",
  unit_dog: "Attack Dog",
  unit_harv: "Ore Truck",
  unit_3tnk: "Heavy Tank",
  unit_4tnk: "Mammoth Tank",
  unit_v2rl: "V2 Rocket Launcher",
  unit_mcv: "Mobile Construction Vehicle",
  unit_e1a: "Allied Rifle Infantry",
  unit_e3a: "Allied Rocket Soldier",
  unit_jeep: "Ranger",
  unit_1tnk: "Light Tank",
  unit_2tnk: "Medium Tank",
  unit_arty: "Artillery",
  unit_harva: "Allied Ore Truck",

  // ── Structure names ───────────────────────────────────────────────────────
  struct_conyard: "Construction Yard",
  struct_power: "Power Plant",
  struct_refinery: "Ore Refinery",
  struct_silo: "Ore Silo",
  struct_barracks: "Soviet Barracks",
  struct_kennel: "Kennel",
  struct_warfactory: "War Factory",
  struct_radar: "Radar Dome",
  struct_depot: "Service Depot",
  struct_flametower: "Flame Tower",
  struct_tesla: "Tesla Coil",
  struct_wall: "Concrete Wall",
  struct_nukesilo: "Missile Silo",
  struct_conyard_a: "Allied Construction Yard",
  struct_power_a: "Allied Power Plant",
  struct_refinery_a: "Allied Refinery",
  struct_barracks_a: "Allied Barracks",
  struct_warfactory_a: "Allied War Factory",
  struct_pillbox: "Pillbox",
  struct_turret: "Gun Turret",

  // ── EVA announcements ─────────────────────────────────────────────────────
  eva_constructionComplete: "Construction complete",
  eva_unitReady: "Unit ready",
  eva_buildingInfo: "Building",
  eva_newConstructionOptions: "New construction options",
  eva_insufficientFunds: "Insufficient funds",
  eva_silosNeeded: "Silos needed",
  eva_lowPower: "Low power",
  eva_baseUnderAttack: "Our base is under attack",
  eva_unitLost: "Unit lost",
  eva_structureLost: "Structure lost",
  eva_cannotDeployHere: "Cannot deploy here",
  eva_unableToComply: "Unable to comply",
  eva_primaryBuildingSelected: "Primary building selected",
  eva_missionAccomplished: "Mission accomplished",
  eva_missionFailed: "Mission failed",
  eva_nuclearWeaponAvailable: "Nuclear weapon available",
  eva_nuclearWeaponLaunched: "Nuclear weapon launched",
  eva_radarOnline: "Radar online",
  eva_radarOffline: "Radar offline",
  eva_repairing: "Repairing",
  eva_buildingCaptured: "Building captured",
  eva_ourBaseIsUnderAttack: "Warning: our base is under attack",
} as const;

export type Translation = { readonly [K in keyof typeof en]: string };
export type TranslationKey = keyof typeof en;
