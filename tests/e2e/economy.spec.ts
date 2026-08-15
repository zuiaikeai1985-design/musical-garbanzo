import { expect, test } from "@playwright/test";
import { collectErrors, startMission } from "./helpers";

test("the harvester earns credits in a live browser session", async ({ page }) => {
  const errors = collectErrors(page);
  await startMission(page);

  // Zero the treasury through the bridge so the reading is purely harvested income.
  await page.evaluate(() => window.__ra?.grantCredits(-window.__ra.credits()));
  await page.waitForTimeout(500);
  const start = await page.evaluate(() => window.__ra?.credits() ?? -1);

  // A single Ore Truck needs the better part of a minute for its first delivery.
  await expect
    .poll(async () => page.evaluate(() => window.__ra?.credits() ?? -1), {
      timeout: 120_000,
      intervals: [2000],
    })
    .toBeGreaterThan(start);

  await page.screenshot({ path: "test-results/economy.png" });
  expect(errors, errors.join("\n")).toHaveLength(0);
});
