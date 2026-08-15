import { describe, expect, it } from "vitest";
import { en } from "../../src/i18n/en";
import { zh } from "../../src/i18n/zh";
import { LANGS, otherLang, table, translate } from "../../src/i18n";

describe("i18n", () => {
  it("has identical key sets in every language", () => {
    const enKeys = Object.keys(en).sort();
    const zhKeys = Object.keys(zh).sort();
    expect(zhKeys).toEqual(enKeys);
  });

  it("has no empty or placeholder strings", () => {
    for (const lang of LANGS) {
      const tbl = table(lang);
      for (const [key, value] of Object.entries(tbl)) {
        expect(typeof value, `${lang}.${key} must be a string`).toBe("string");
        expect(value.trim().length, `${lang}.${key} must not be empty`).toBeGreaterThan(0);
        expect(value, `${lang}.${key} still looks like a TODO`).not.toMatch(/TODO|FIXME|xxx/i);
      }
    }
  });

  it("actually translates: zh differs from en for user-facing copy", () => {
    // A handful of keys are intentionally identical across languages (none right now),
    // but the bulk must genuinely differ or the translation is not wired up.
    const keys = Object.keys(en) as (keyof typeof en)[];
    const different = keys.filter((k) => en[k] !== zh[k]);
    expect(different.length / keys.length).toBeGreaterThan(0.9);
  });

  it("contains CJK characters in the Chinese table", () => {
    const cjk = /[\u4e00-\u9fff]/;
    const withCjk = Object.values(zh).filter((v) => cjk.test(v));
    expect(withCjk.length / Object.values(zh).length).toBeGreaterThan(0.85);
  });

  it("exposes working helpers", () => {
    expect(otherLang("en")).toBe("zh");
    expect(otherLang("zh")).toBe("en");
    expect(translate("en", "appTitle")).toBe("RED ALERT");
    expect(translate("zh", "appTitle")).toBe("红色警报");
  });
});
