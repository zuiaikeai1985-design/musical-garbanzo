import type { Translation } from "./en";

/**
 * 简体中文 string table. Typed as `Translation`, so a missing key here fails `tsc`.
 */
export const zh: Translation = {
  // ── App chrome ────────────────────────────────────────────────────────────
  appTitle: "红色警报",
  appSubtitle: "苏维埃指挥网络",
  languageName: "中文",
  languageToggle: "EN",

  // ── Main menu ─────────────────────────────────────────────────────────────
  menuNewMission: "新的任务",
  menuContinue: "继续任务",
  menuSettings: "选项设置",
  menuHelp: "操作说明",
  menuCredits: "制作名单",
  menuQuit: "退出",
  menuDifficulty: "难度",

  difficultyEasy: "新兵",
  difficultyNormal: "老兵",
  difficultyHard: "政委",

  // ── Loading ───────────────────────────────────────────────────────────────
  loading: "载入中",
  loadingSprites: "绘制单位图像",
  loadingTerrain: "生成地形",
  loadingAudio: "载入音频",
  loadingReady: "准备就绪",

  // ── Briefing ──────────────────────────────────────────────────────────────
  briefingHeader: "任务简报",
  briefingClassified: "绝密",
  briefingMissionLabel: "任务 01",
  briefingMissionName: "铁幕行动",
  briefingObjectivesLabel: "任务目标",
  briefingProceed: "开始行动",
  briefingBack: "返回",

  // ── HUD ───────────────────────────────────────────────────────────────────
  hudCredits: "资金",
  hudPower: "电力",
  hudPowerLow: "电力不足",
  hudNoRadar: "无雷达",
  hudSell: "出售",
  hudRepair: "维修",
  hudMap: "地图",
  hudReady: "就绪",
  hudHold: "暂停",
  hudBuilding: "建造中",
  hudPlace: "放置",
  hudTabStructures: "建筑",
  hudTabDefense: "防御",
  hudTabInfantry: "步兵",
  hudTabVehicles: "战车",

  // ── Pause / results ───────────────────────────────────────────────────────
  paused: "已暂停",
  resume: "继续",
  restart: "重新开始",
  abort: "放弃任务",
  victoryTitle: "任务完成",
  defeatTitle: "任务失败",
  statUnitsBuilt: "生产单位",
  statUnitsLost: "损失单位",
  statStructuresBuilt: "建造建筑",
  statStructuresLost: "损失建筑",
  statEnemiesDestroyed: "歼灭敌军",
  statOreHarvested: "采集矿石",
  statTime: "任务用时",
  statScore: "得分",

  // ── Settings ──────────────────────────────────────────────────────────────
  settingsTitle: "选项设置",
  settingsLanguage: "语言",
  settingsMusicVolume: "音乐音量",
  settingsSfxVolume: "音效音量",
  settingsZoom: "缩放",
  settingsEdgeScroll: "边缘滚屏",
  settingsOn: "开",
  settingsOff: "关",
  settingsClose: "关闭",

  // ── Help ──────────────────────────────────────────────────────────────────
  helpTitle: "作战手册",
  helpSelect: "选择单位",
  helpMarquee: "框选单位",
  helpAddSelect: "追加选择",
  helpOrder: "移动 / 攻击 / 采矿",
  helpGroupAssign: "设定编队",
  helpGroupRecall: "呼叫编队",
  helpStop: "停止",
  helpGuard: "警戒",
  helpScatter: "散开",
  helpBase: "回到基地",
  helpTabCycle: "切换侧栏页签",
  helpLanguage: "切换语言",
  helpZoom: "放大 / 缩小",
  helpPause: "暂停",
  helpMenu: "菜单 / 取消",
  helpScroll: "滚动地图",

  // ── Common ────────────────────────────────────────────────────────────────
  ok: "确定",
  cancel: "取消",
  yes: "是",
  no: "否",
};
