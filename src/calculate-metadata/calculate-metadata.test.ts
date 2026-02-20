import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock all external dependencies
vi.mock("@code-hike/lighter", () => ({
  getThemeColors: vi.fn().mockResolvedValue({
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    editor: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
      lineHighlightBackground: "#2a2d2e",
      rangeHighlightBackground: "#2a2d2e",
    },
    icon: { foreground: "#c5c5c5" },
  }),
}));

vi.mock("@remotion/layout-utils", () => ({
  measureText: vi.fn().mockReturnValue({ width: 24 }),
}));

vi.mock("@remotion/studio", () => ({
  getStaticFiles: vi.fn().mockReturnValue([]),
}));

vi.mock("@remotion/google-fonts/RobotoMono", () => ({
  loadFont: vi.fn().mockReturnValue({
    fontFamily: "Roboto Mono",
    waitUntilDone: vi.fn().mockResolvedValue(undefined),
  }),
}));

vi.mock("./get-files", () => ({
  getFiles: vi.fn().mockResolvedValue([
    { filename: "code1.tsx", value: 'const x = 1;\nconsole.log("hello");' },
    { filename: "code2.tsx", value: "function add(a: number, b: number) {\n  return a + b;\n}" },
  ]),
}));

vi.mock("./process-snippet", () => ({
  processSnippet: vi.fn().mockImplementation(async (step: any) => ({
    tokens: [],
    annotations: [],
    lang: "tsx",
    meta: step.filename,
    value: step.value,
  })),
}));

vi.mock("codehike/code", () => ({
  highlight: vi.fn(),
}));

import { calculateMetadata } from "./calculate-metadata";
import { measureText } from "@remotion/layout-utils";

describe("calculateMetadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(measureText).mockReturnValue({ width: 24 } as any);
  });

  it("should calculate duration based on number of code files", async () => {
    const result = await calculateMetadata({
      props: {
        theme: "dark-plus",
        width: { type: "auto" },
        steps: null,
        themeColors: null,
        codeWidth: null,
      },
      abortSignal: new AbortController().signal,
      compositionId: "test",
      defaultProps: {} as any,
    } as any);

    // 2 files * 90 frames = 180
    expect(result.durationInFrames).toBe(180);
  });

  it("should return processed steps in props", async () => {
    const result = await calculateMetadata({
      props: {
        theme: "dark-plus",
        width: { type: "auto" },
        steps: null,
        themeColors: null,
        codeWidth: null,
      },
      abortSignal: new AbortController().signal,
      compositionId: "test",
      defaultProps: {} as any,
    } as any);

    expect(result.props?.steps).toHaveLength(2);
  });

  it("should return theme colors in props", async () => {
    const result = await calculateMetadata({
      props: {
        theme: "github-dark",
        width: { type: "auto" },
        steps: null,
        themeColors: null,
        codeWidth: null,
      },
      abortSignal: new AbortController().signal,
      compositionId: "test",
      defaultProps: {} as any,
    } as any);

    expect(result.props?.themeColors).toBeTruthy();
    expect(result.props?.themeColors?.background).toBe("#1e1e1e");
  });

  it("should enforce minimum width of 1080 for auto mode", async () => {
    // With small code, natural width will be small
    vi.mocked(measureText).mockReturnValue({ width: 5 } as any);

    const result = await calculateMetadata({
      props: {
        theme: "dark-plus",
        width: { type: "auto" },
        steps: null,
        themeColors: null,
        codeWidth: null,
      },
      abortSignal: new AbortController().signal,
      compositionId: "test",
      defaultProps: {} as any,
    } as any);

    expect(result.width).toBeGreaterThanOrEqual(1080);
  });

  it("should use fixed width when specified", async () => {
    vi.mocked(measureText).mockReturnValue({ width: 5 } as any);

    const result = await calculateMetadata({
      props: {
        theme: "dark-plus",
        width: { type: "fixed", value: 1920 },
        steps: null,
        themeColors: null,
        codeWidth: null,
      },
      abortSignal: new AbortController().signal,
      compositionId: "test",
      defaultProps: {} as any,
    } as any);

    expect(result.width).toBe(1920);
  });

  it("should ensure width is even (MP4 requirement)", async () => {
    const result = await calculateMetadata({
      props: {
        theme: "dark-plus",
        width: { type: "auto" },
        steps: null,
        themeColors: null,
        codeWidth: null,
      },
      abortSignal: new AbortController().signal,
      compositionId: "test",
      defaultProps: {} as any,
    } as any);

    expect(result.width! % 2).toBe(0);
  });
});
