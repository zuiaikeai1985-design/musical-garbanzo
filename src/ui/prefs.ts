const STORAGE_KEY = "ra.prefs";

export interface Preferences {
  edgeScroll: boolean;
}

const DEFAULTS: Preferences = { edgeScroll: true };

let cached: Preferences | null = null;

export function getPrefs(): Preferences {
  if (cached) return cached;
  cached = { ...DEFAULTS };
  if (typeof localStorage !== "undefined") {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<Preferences>;
        cached = { edgeScroll: parsed.edgeScroll ?? DEFAULTS.edgeScroll };
      }
    } catch {
      // Corrupt or unavailable storage falls back to defaults.
    }
  }
  return cached;
}

export function setPrefs(next: Partial<Preferences>): Preferences {
  cached = { ...getPrefs(), ...next };
  if (typeof localStorage !== "undefined") {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));
    } catch {
      // Preferences simply will not persist.
    }
  }
  return cached;
}
