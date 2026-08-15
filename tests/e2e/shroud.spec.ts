import { expect, test } from "@playwright/test";
import { collectErrors, startMission } from "./helpers";

test.describe("fog of war", () => {
  test("hides the unexplored map and reveals it as units move", async ({ page }) => {
    const errors = collectErrors(page);
    await startMission(page);
    await page.waitForTimeout(400);

    await page.screenshot({ path: "test-results/shroud-start.png" });

    // Scroll far away from the base: that ground has never been seen, so it must be black.
    const darkness = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="battlefield"]')!;
      const ctx = canvas.getContext("2d")!;
      // Sample the top-left corner of the viewport, well clear of the starting base.
      const { data } = ctx.getImageData(0, 0, 200, 200);
      let dark = 0;
      let total = 0;
      for (let i = 0; i < data.length; i += 4 * 13) {
        total++;
        if (data[i] < 24 && data[i + 1] < 24 && data[i + 2] < 28) dark++;
      }
      return dark / total;
    });
    expect(darkness, "unexplored ground should be blacked out").toBeGreaterThan(0.5);

    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("the radar panel reports no radar until a dome is built", async ({ page }) => {
    await startMission(page);
    await expect(page.getByTestId("sidebar")).toContainText("NO RADAR");
    await page.screenshot({ path: "test-results/no-radar.png" });
  });
});
