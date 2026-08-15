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
} as const;

export type Translation = { readonly [K in keyof typeof en]: string };
export type TranslationKey = keyof typeof en;
