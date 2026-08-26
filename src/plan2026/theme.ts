export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/**
 * 《传灯》2026 年度策划概念动板
 * S1 标版醒来 → S2 主题揭示（守爱→传灯）→ S3 九灯次第点亮 → S4 九灯归一落版
 */
export const SCENE = {
  awaken: 10 * FPS,
  theme: 10 * FPS,
  lamps: 26 * FPS,
  finale: 14 * FPS,
} as const;

export const DURATION_IN_FRAMES =
  SCENE.awaken + SCENE.theme + SCENE.lamps + SCENE.finale;

export const START = {
  awaken: 0,
  theme: SCENE.awaken,
  lamps: SCENE.awaken + SCENE.theme,
  finale: SCENE.awaken + SCENE.theme + SCENE.lamps,
} as const;

/** 黑棚 + 暖金体系（2200–2600K），黑位死黑 */
export const palette = {
  black: "#040302",
  ember: "#1A0F04",
  goldDeep: "#8A6428",
  gold: "#E0B45A",
  goldBright: "#F5D98A",
  flame: "#FFB65C",
  flameHot: "#FFD9A0",
  cream: "#F3E7C8",
  dim: "#6B5836",
};

export const copy = {
  brand: "九世善珠",
  english: "guard the love",
  slogan: "为爱付出，护佑一生",
  yearTag: "二〇二六年度策划",
  lastYear: "二〇二五 · 守爱",
  themeWord: "传灯",
  themeEn: "pass the light, guard the love",
  themeSub: "把一念爱，点成九盏灯。",
  lampsTitle: "九灯计划",
  lampsSub: "九世 · 九灯 · 九个节点",
  finaleLine: "灯，是会走路的。",
  footnote: "九灯计划 · 金刚兄弟 · 百寺行",
  yearMark: "2026 · 传灯",
};

export type Lamp = {
  name: string;
  node: string;
  date: string;
};

/** 九灯：九个已核准的 2026 传统节点 */
export const NINE_LAMPS: Lamp[] = [
  { name: "起灯", node: "腊八", date: "01 · 26" },
  { name: "守岁", node: "除夕", date: "02 · 16" },
  { name: "思亲", node: "清明", date: "04 · 05" },
  { name: "洗心", node: "浴佛", date: "05 · 24" },
  { name: "同舟", node: "端午", date: "06 · 19" },
  { name: "报恩", node: "中元", date: "08 · 27" },
  { name: "团圆", node: "中秋", date: "09 · 25" },
  { name: "敬老", node: "重阳", date: "10 · 18" },
  { name: "归一", node: "冬至", date: "12 · 22" },
];

/** 九灯在画面中的珠链弧线位置（悬链下垂形，如一串珠） */
export const lampPosition = (index: number) => {
  const t = index / (NINE_LAMPS.length - 1);
  const x = 220 + t * (WIDTH - 440);
  const y = 430 + 190 * (4 * t * (1 - t));
  return { x, y };
};
