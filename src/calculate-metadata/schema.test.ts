import { describe, it, expect } from "vitest";
import { schema, width } from "./schema";

describe("width schema", () => {
  it('should accept type "auto"', () => {
    const result = width.safeParse({ type: "auto" });
    expect(result.success).toBe(true);
  });

  it('should accept type "fixed" with a valid value', () => {
    const result = width.safeParse({ type: "fixed", value: 1920 });
    expect(result.success).toBe(true);
  });

  it('should reject type "fixed" without a value', () => {
    const result = width.safeParse({ type: "fixed" });
    expect(result.success).toBe(false);
  });

  it("should reject unknown type", () => {
    const result = width.safeParse({ type: "unknown" });
    expect(result.success).toBe(false);
  });

  it("should reject empty object", () => {
    const result = width.safeParse({});
    expect(result.success).toBe(false);
  });

  it('should reject "fixed" with non-integer step value', () => {
    const result = width.safeParse({ type: "fixed", value: 1920.5 });
    expect(result.success).toBe(false);
  });

  it('should accept "fixed" with value 0', () => {
    const result = width.safeParse({ type: "fixed", value: 0 });
    expect(result.success).toBe(true);
  });
});

describe("schema (full)", () => {
  it("should accept valid theme with auto width", () => {
    const result = schema.safeParse({
      theme: "dark-plus",
      width: { type: "auto" },
    });
    expect(result.success).toBe(true);
  });

  it("should accept valid theme with fixed width", () => {
    const result = schema.safeParse({
      theme: "github-dark",
      width: { type: "fixed", value: 1080 },
    });
    expect(result.success).toBe(true);
  });

  it("should reject invalid theme name", () => {
    const result = schema.safeParse({
      theme: "nonexistent-theme",
      width: { type: "auto" },
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing theme", () => {
    const result = schema.safeParse({
      width: { type: "auto" },
    });
    expect(result.success).toBe(false);
  });

  it("should reject missing width", () => {
    const result = schema.safeParse({
      theme: "monokai",
    });
    expect(result.success).toBe(false);
  });
});
