import { describe, it, expect } from "vitest";
import { errorInline, errorMessage } from "./Error";

describe("errorInline annotation handler", () => {
  it("should have the name 'error'", () => {
    expect(errorInline.name).toBe("error");
  });

  describe("transform", () => {
    it("should return the original annotation and an error-message annotation", () => {
      const annotation = {
        name: "error",
        query: "Type 'string' is not assignable to type 'number'",
        lineNumber: 10,
        fromColumn: 5,
        toColumn: 15,
        data: { character: 5 },
      };

      const result = errorInline.transform!(annotation as any);

      expect(Array.isArray(result)).toBe(true);
      const arr = result as any[];
      expect(arr).toHaveLength(2);

      // First element should be the original annotation
      expect(arr[0]).toBe(annotation);

      // Second element should be the error-message annotation
      expect(arr[1]).toEqual({
        name: "error-message",
        query: "Type 'string' is not assignable to type 'number'",
        fromLineNumber: 10,
        toLineNumber: 10,
        data: { character: 5 },
      });
    });

    it("should pass through the query text to error-message", () => {
      const annotation = {
        name: "error",
        query: "Cannot find name 'foo'",
        lineNumber: 1,
        fromColumn: 0,
        toColumn: 3,
        data: { character: 0 },
      };

      const result = errorInline.transform!(annotation as any) as any[];
      expect(result[1].query).toBe("Cannot find name 'foo'");
    });

    it("should set correct line numbers on error-message", () => {
      const annotation = {
        name: "error",
        query: "test error",
        lineNumber: 25,
        fromColumn: 0,
        toColumn: 5,
        data: { character: 0 },
      };

      const result = errorInline.transform!(annotation as any) as any[];
      expect(result[1].fromLineNumber).toBe(25);
      expect(result[1].toLineNumber).toBe(25);
    });
  });
});

describe("errorMessage annotation handler", () => {
  it("should have the name 'error-message'", () => {
    expect(errorMessage.name).toBe("error-message");
  });
});
