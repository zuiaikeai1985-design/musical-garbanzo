export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

/** 60-second 《守爱》 brand film */
export const SCENE = {
  lotus: 8 * FPS,
  depart: 8 * FPS,
  path: 12 * FPS,
  temples: 12 * FPS,
  cradle: 8 * FPS,
  finale: 12 * FPS,
} as const;

export const DURATION_IN_FRAMES =
  SCENE.lotus +
  SCENE.depart +
  SCENE.path +
  SCENE.temples +
  SCENE.cradle +
  SCENE.finale;

export const START = {
  lotus: 0,
  depart: SCENE.lotus,
  path: SCENE.lotus + SCENE.depart,
  temples: SCENE.lotus + SCENE.depart + SCENE.path,
  cradle: SCENE.lotus + SCENE.depart + SCENE.path + SCENE.temples,
  finale:
    SCENE.lotus +
    SCENE.depart +
    SCENE.path +
    SCENE.temples +
    SCENE.cradle,
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
  vertical: "为爱付出",
  brothers: "金刚兄弟",
  pilgrimage: "百寺行",
  shousui: "守岁计划",
  ask: "有人问，爱要怎么守？",
  walk: "把它走成路。",
  cradle: "为爱付出，护佑一生。",
  lockup: "金刚兄弟 · 百寺行",
};
