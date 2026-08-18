export const FPS = 30;
export const WIDTH = 1920;
export const HEIGHT = 1080;

export const SCENE = {
  opening: 8 * FPS,
  lifetime: 5 * FPS,
  fate: 12 * FPS,
  finale: 10 * FPS,
} as const;

export const LIFETIME_COUNT = 9;

export const DURATION_IN_FRAMES =
  SCENE.opening + SCENE.lifetime * LIFETIME_COUNT + SCENE.fate + SCENE.finale;

export const palette = {
  ink: "#070604",
  inkSoft: "#14100B",
  paper: "#F4E6C8",
  gold: "#D4B45A",
  goldBright: "#F0D78A",
  goldDeep: "#8A6A28",
  cinnabar: "#A33A32",
  jade: "#3E6F5E",
  water: "#6B8CAE",
  dusk: "#C48A5A",
};

export type ElementKey = "water" | "wood" | "fire" | "earth" | "metal";

export const elementColor: Record<ElementKey, string> = {
  water: palette.water,
  wood: palette.jade,
  fire: palette.cinnabar,
  earth: palette.dusk,
  metal: "#D8C9A8",
};

export type MotifId =
  | "dew"
  | "jade"
  | "silkroad"
  | "trousseau"
  | "rain"
  | "token"
  | "ocean"
  | "lamp"
  | "palms";

export type Lifetime = {
  id: number;
  numeral: string;
  era: string;
  title: string;
  line: string;
  element: ElementKey;
  motif: MotifId;
};

export const LIFETIMES: Lifetime[] = [
  {
    id: 1,
    numeral: "壹",
    era: "洪荒 · 水边",
    title: "露",
    line: "第一世，珠是一滴露。母亲用掌心接住晨光。",
    element: "water",
    motif: "dew",
  },
  {
    id: 2,
    numeral: "贰",
    era: "商周 · 祭坛",
    title: "玉",
    line: "第二世，珠是一粒祭玉。女儿把祈愿系进母亲的衣襟。",
    element: "metal",
    motif: "jade",
  },
  {
    id: 3,
    numeral: "叁",
    era: "汉唐 · 丝路",
    title: "沙",
    line: "第三世，珠随驼铃西去。它记得故乡灶火的温度。",
    element: "earth",
    motif: "silkroad",
  },
  {
    id: 4,
    numeral: "肆",
    era: "两宋 · 闺阁",
    title: "绣",
    line: "第四世，珠作嫁妆。绣线绕过它，绕过一生的叮嘱。",
    element: "wood",
    motif: "trousseau",
  },
  {
    id: 5,
    numeral: "伍",
    era: "元明 · 雨巷",
    title: "雨",
    line: "第五世，珠绾在发间。江南雨落，母女共撑一把伞。",
    element: "water",
    motif: "rain",
  },
  {
    id: 6,
    numeral: "陆",
    era: "清末 · 离乱",
    title: "信",
    line: "第六世，珠成信物。离散的夜里，它替人守着回家的路。",
    element: "fire",
    motif: "token",
  },
  {
    id: 7,
    numeral: "柒",
    era: "民国 · 远洋",
    title: "潮",
    line: "第七世，珠漂向异乡。信封里夹着它，和一句「好好吃饭」。",
    element: "water",
    motif: "ocean",
  },
  {
    id: 8,
    numeral: "捌",
    era: "新时代 · 灯火",
    title: "灯",
    line: "第八世，珠传给女儿。车间灯亮着，像母亲没说完的话。",
    element: "fire",
    motif: "lamp",
  },
  {
    id: 9,
    numeral: "玖",
    era: "今世 · 归掌",
    title: "归",
    line: "第九世，珠落回掌心。女儿为母亲戴上，光，圆满了。",
    element: "earth",
    motif: "palms",
  },
];

export const lifetimeStart = (index: number) =>
  SCENE.opening + index * SCENE.lifetime;

export const FATE_START = SCENE.opening + SCENE.lifetime * LIFETIME_COUNT;
export const FINALE_START = FATE_START + SCENE.fate;
