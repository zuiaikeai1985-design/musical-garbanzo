import { expect, test } from "@playwright/test";
import { startMission } from "./helpers";

test.describe("mission results", () => {
  test("shows the victory tally when the enemy is wiped out", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await startMission(page);
    await page.evaluate(() => window.__ra?.wipeSide("allied"));

    await expect(page.getByTestId("result")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("result-title")).toHaveText("MISSION ACCOMPLISHED");
    // The tally counts up, so give it a moment to settle before capturing.
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "test-results/victory.png" });
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("shows the defeat tally in Chinese and can restart", async ({ page }) => {
    await startMission(page, "zh");

    await page.evaluate(() => window.__ra?.wipeSide("soviet"));
    await expect(page.getByTestId("result")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("result-title")).toHaveText("任务失败");
    await page.waitForTimeout(1200);
    await page.screenshot({ path: "test-results/defeat-zh.png" });

    // Restarting rebuilds the whole mission.
    await page.getByTestId("result-restart").click();
    await expect(page.getByTestId("loading")).toBeHidden({ timeout: 30_000 });
    await expect(page.getByTestId("result")).toBeHidden();
    await expect
      .poll(async () => page.evaluate(() => window.__ra?.structureCounts().conyard ?? 0), {
        timeout: 15_000,
      })
      .toBe(1);
  });
});
