import { en, type Translation, type TranslationKey } from "./en";
import { zh } from "./zh";

export type Lang = "en" | "zh";

export const LANGS: readonly Lang[] = ["en", "zh"] as const;

const TABLES: Record<Lang, Translation> = { en, zh };

export function table(lang: Lang): Translation {
  return TABLES[lang];
}

export function translate(lang: Lang, key: TranslationKey): string {
  return TABLES[lang][key];
}

export type { Translation, TranslationKey };
export { en, zh };

const STORAGE_KEY = "ra.lang";

export function loadLang(): Lang {
  if (typeof localStorage === "undefined") return "en";
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw === "zh" || raw === "en" ? raw : detectLang();
}

export function saveLang(lang: Lang): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, lang);
}

function detectLang(): Lang {
  if (typeof navigator === "undefined") return "en";
  return navigator.language.toLowerCase().startsWith("zh") ? "zh" : "en";
}

export function otherLang(lang: Lang): Lang {
  return lang === "en" ? "zh" : "en";
}
