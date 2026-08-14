export type ModelSettings = {
  apiKey: string;
  baseUrl: string;
  model: string;
};

export const DEFAULT_SETTINGS: ModelSettings = {
  apiKey: "",
  baseUrl: "https://api.openai.com/v1",
  model: "gpt-4o-mini",
};

const STORAGE_KEY = "huayu-settings";

export function loadSettings(): ModelSettings {
  if (typeof window === "undefined") {
    return DEFAULT_SETTINGS;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_SETTINGS;
    }
    const parsed = JSON.parse(raw) as Partial<ModelSettings>;
    return {
      apiKey: parsed.apiKey ?? "",
      baseUrl: parsed.baseUrl || DEFAULT_SETTINGS.baseUrl,
      model: parsed.model || DEFAULT_SETTINGS.model,
    };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(settings: ModelSettings) {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
