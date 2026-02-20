import { describe, it, expect } from "vitest";
import { callout } from "./Callout";

describe("callout annotation handler", () => {
  describe("transform", () => {
    it("should transform an inline annotation to a block annotation", () => {
      const annotation = {
        name: "callout",
        query: "const x: number",
        lineNumber: 5,
        fromColumn: 10,
        toColumn: 20,
        data: { character: 10, codeblock: null },
      };

      const result = callout.transform!(annotation as any);

      expect(result).toEqual({
        name: "callout",
        query: "const x: number",
        fromLineNumber: 5,
        toLineNumber: 5,
        data: {
          character: 10,
          codeblock: null,
          column: 15, // (10 + 20) / 2
        },
      });
    });

    it("should calculate column as midpoint of fromColumn and toColumn", () => {
      const annotation = {
        name: "callout",
        query: "test",
        lineNumber: 1,
        fromColumn: 0,
        toColumn: 10,
        data: {},
      };

      const result = callout.transform!(annotation as any);
      expect(result).toHaveProperty("data.column", 5);
    });

    it("should preserve existing data properties", () => {
      const annotation = {
        name: "callout",
        query: "test",
        lineNumber: 3,
        fromColumn: 2,
        toColumn: 8,
        data: { character: 2, codeblock: "some-code", extra: "value" },
      };

      const result = callout.transform!(annotation as any) as any;
      expect(result.data.character).toBe(2);
      expect(result.data.codeblock).toBe("some-code");
      expect(result.data.extra).toBe("value");
      expect(result.data.column).toBe(5);
    });

    it("should set fromLineNumber and toLineNumber to the same line", () => {
      const annotation = {
        name: "callout",
        query: "test",
        lineNumber: 42,
        fromColumn: 0,
        toColumn: 10,
        data: {},
      };

      const result = callout.transform!(annotation as any) as any;
      expect(result.fromLineNumber).toBe(42);
      expect(result.toLineNumber).toBe(42);
    });
  });

  it("should have the name 'callout'", () => {
    expect(callout.name).toBe("callout");
  });
});
