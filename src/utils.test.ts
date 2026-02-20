import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock remotion's interpolate and interpolateColors
vi.mock("remotion", () => ({
  interpolate: vi.fn((value: number, input: number[], output: number[]) => {
    // Simple linear interpolation mock
    const t = (value - input[0]) / (input[1] - input[0]);
    return output[0] + t * (output[1] - output[0]);
  }),
  interpolateColors: vi.fn(
    (_value: number, _input: number[], colors: string[]) => {
      return colors[0];
    },
  ),
}));

import { applyStyle } from "./utils";

describe("applyStyle", () => {
  let element: HTMLElement;

  beforeEach(() => {
    element = document.createElement("span");
  });

  it("should set translate when translateX and translateY are provided", () => {
    applyStyle({
      element,
      keyframes: {
        translateX: [0, 100],
        translateY: [0, 50],
      },
      progress: 0.5,
      linearProgress: 0.5,
    });

    expect(element.style.translate).toBe("50px 25px");
  });

  it("should set opacity when opacity keyframe is provided", () => {
    applyStyle({
      element,
      keyframes: {
        opacity: [0, 1],
      },
      progress: 0.5,
      linearProgress: 0.7,
    });

    expect(element.style.opacity).toBe("0.7");
  });

  it("should set color when color keyframe is provided", () => {
    applyStyle({
      element,
      keyframes: {
        color: ["#000000", "#ffffff"],
      },
      progress: 0.5,
      linearProgress: 0.5,
    });

    // jsdom converts hex colors to rgb format
    expect(element.style.color).toBeTruthy();
  });

  it("should default translate to 0px 0px when no translateX/Y provided", () => {
    applyStyle({
      element,
      keyframes: {},
      progress: 0.5,
      linearProgress: 0.5,
    });

    expect(element.style.translate).toBe("0px 0px");
  });

  it("should handle all keyframes simultaneously", () => {
    applyStyle({
      element,
      keyframes: {
        translateX: [0, 200],
        translateY: [0, 100],
        color: ["#ff0000", "#0000ff"],
        opacity: [0, 1],
      },
      progress: 1,
      linearProgress: 1,
    });

    expect(element.style.translate).toBe("200px 100px");
    expect(element.style.opacity).toBe("1");
    expect(element.style.color).toBeTruthy();
  });

  it("should handle progress at 0", () => {
    applyStyle({
      element,
      keyframes: {
        translateX: [10, 100],
        translateY: [20, 200],
      },
      progress: 0,
      linearProgress: 0,
    });

    expect(element.style.translate).toBe("10px 20px");
  });
});
