import { describe, it, expect } from "vitest";
import { themeSchema } from "./theme";

describe("themeSchema", () => {
  const validThemes = [
    "dark-plus",
    "dracula-soft",
    "dracula",
    "github-dark",
    "github-dark-dimmed",
    "github-light",
    "light-plus",
    "material-darker",
    "material-default",
    "material-lighter",
    "material-ocean",
    "material-palenight",
    "min-dark",
    "min-light",
    "monokai",
    "nord",
    "one-dark-pro",
    "poimandres",
    "slack-dark",
    "slack-ochin",
    "solarized-dark",
    "solarized-light",
  ];

  it.each(validThemes)("should accept valid theme: %s", (theme) => {
    const result = themeSchema.safeParse(theme);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(theme);
    }
  });

  it("should reject invalid theme name", () => {
    const result = themeSchema.safeParse("invalid-theme");
    expect(result.success).toBe(false);
  });

  it("should reject empty string", () => {
    const result = themeSchema.safeParse("");
    expect(result.success).toBe(false);
  });

  it("should reject non-string values", () => {
    expect(themeSchema.safeParse(42).success).toBe(false);
    expect(themeSchema.safeParse(null).success).toBe(false);
    expect(themeSchema.safeParse(undefined).success).toBe(false);
  });

  it("should have exactly 22 valid themes", () => {
    expect(validThemes.length).toBe(22);
  });
});
