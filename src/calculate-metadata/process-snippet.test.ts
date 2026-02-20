import { describe, it, expect, vi, beforeEach } from "vitest";

// Use vi.hoisted so the mock is available when vi.mock runs (hoisted)
const { mockRun } = vi.hoisted(() => ({
  mockRun: vi.fn().mockResolvedValue({
    code: "const x = 1;",
    queries: [],
    errors: [],
  }),
}));

// Mock the external dependencies
vi.mock("codehike/code", () => ({
  highlight: vi.fn().mockResolvedValue({
    tokens: [],
    annotations: [],
    lang: "ts",
    meta: "",
    value: "",
  }),
}));

vi.mock("twoslash-cdn", () => ({
  createTwoslashFromCDN: vi.fn(() => ({
    run: mockRun,
  })),
}));

import { processSnippet } from "./process-snippet";
import { highlight } from "codehike/code";

describe("processSnippet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset default mock behavior
    mockRun.mockResolvedValue({
      code: "const x = 1;",
      queries: [],
      errors: [],
    });
    vi.mocked(highlight).mockResolvedValue({
      tokens: [],
      annotations: [],
      lang: "ts",
      meta: "",
      value: "",
    } as any);
  });

  it("should extract extension from filename", async () => {
    await processSnippet(
      { filename: "code1.tsx", value: "const x = 1;" },
      "dark-plus",
    );

    expect(highlight).toHaveBeenCalledWith(
      expect.objectContaining({ lang: "tsx" }),
      "dark-plus",
    );
  });

  it("should handle .ts files with twoslash", async () => {
    await processSnippet(
      { filename: "test.ts", value: "const x = 1;" },
      "github-dark",
    );

    // For .ts files, twoslash should run
    expect(mockRun).toHaveBeenCalled();
    // highlight uses the twoslash output code
    expect(highlight).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: "ts",
        value: "const x = 1;",
      }),
      "github-dark",
    );
  });

  it("should skip twoslash for non-TS files like .swift", async () => {
    vi.mocked(highlight).mockResolvedValueOnce({
      tokens: [],
      annotations: [],
      lang: "swift",
      meta: "",
      value: "let x = 1",
    } as any);

    const result = await processSnippet(
      { filename: "code4.swift", value: "let x = 1" },
      "monokai",
    );

    // twoslash should NOT run for .swift files
    expect(mockRun).not.toHaveBeenCalled();
    expect(highlight).toHaveBeenCalledWith(
      expect.objectContaining({
        lang: "swift",
        value: "let x = 1",
      }),
      "monokai",
    );
    expect(result.annotations).toEqual([]);
  });

  it("should handle filenames with multiple dots", async () => {
    await processSnippet(
      { filename: "my.component.tsx", value: "<div />" },
      "dark-plus",
    );

    expect(highlight).toHaveBeenCalledWith(
      expect.objectContaining({ lang: "tsx" }),
      "dark-plus",
    );
  });

  it("should add callout annotations from twoslash queries", async () => {
    mockRun.mockResolvedValueOnce({
      code: "const x = 1;",
      queries: [{ text: "number", line: 0, character: 6, length: 1 }],
      errors: [],
    });

    const mockHighlight = vi.mocked(highlight);
    mockHighlight.mockResolvedValueOnce({
      tokens: [],
      annotations: [],
      lang: "ts",
      meta: "",
      value: "const x = 1;",
    } as any);
    // For the callout codeblock highlight call
    mockHighlight.mockResolvedValueOnce({
      tokens: [],
      annotations: [],
      lang: "ts",
      meta: "callout",
      value: "number",
    } as any);

    const result = await processSnippet(
      { filename: "test.ts", value: "const x = 1;" },
      "dark-plus",
    );

    // The second highlight call should be for the callout codeblock
    expect(mockHighlight).toHaveBeenCalledTimes(2);
    expect(mockHighlight).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ meta: "callout", value: "number", lang: "ts" }),
      "dark-plus",
    );

    // The result should have a callout annotation
    expect(result.annotations).toContainEqual(
      expect.objectContaining({
        name: "callout",
        query: "number",
        lineNumber: 1,
      }),
    );
  });

  it("should add error annotations from twoslash errors", async () => {
    mockRun.mockResolvedValueOnce({
      code: "const x: number = 'hello';",
      queries: [],
      errors: [
        {
          text: "Type 'string' is not assignable",
          line: 0,
          character: 18,
          length: 7,
        },
      ],
    });

    vi.mocked(highlight).mockResolvedValueOnce({
      tokens: [],
      annotations: [],
      lang: "ts",
      meta: "",
      value: "const x: number = 'hello';",
    } as any);

    const result = await processSnippet(
      { filename: "test.ts", value: "const x: number = 'hello';" },
      "dark-plus",
    );

    expect(result.annotations).toContainEqual(
      expect.objectContaining({
        name: "error",
        query: "Type 'string' is not assignable",
        lineNumber: 1,
        fromColumn: 18,
        toColumn: 25,
      }),
    );
  });
});
