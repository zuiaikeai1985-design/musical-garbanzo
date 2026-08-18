export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/**
 * 《守爱》60s — Logo 闭环
 * 1 Logo 起 → 2 一群人 → 3 更多人 → 4 回归 Logo
 */
export const SCENE = {
  logo: 10 * FPS,
  few: 15 * FPS,
  many: 20 * FPS,
  returnLogo: 15 * FPS,
} as const;

export const DURATION_IN_FRAMES =
  SCENE.logo + SCENE.few + SCENE.many + SCENE.returnLogo;

export const START = {
  logo: 0,
  few: SCENE.logo,
  many: SCENE.logo + SCENE.few,
  returnLogo: SCENE.logo + SCENE.few + SCENE.many,
} as const;

export const palette = {
  void: "#061018",
  mist: "#0B2A36",
  teal: "#1A4A5C",
  fog: "#6B93A3",
  gold: "#E0B45A",
  goldBright: "#F5D98A",
  goldDeep: "#8A6428",
  cream: "#F3E7C8",
  lotus: "#E8A24A",
  path: "#F0C56A",
};

export const copy = {
  filmTitle: "守爱",
  english: "guard the love",
  brand: "九世善珠",
  slogan: "为爱付出，护佑一生",
  fewLine: "先是一群人。",
  fewSub: "金刚兄弟 · 同行一念",
  manyLine: "然后，是更多人。",
  manySub: "百寺行 · 守岁计划",
  returnLine: "爱走出去，仍回到这一念。",
  lockup: "金刚兄弟 · 百寺行",
};
