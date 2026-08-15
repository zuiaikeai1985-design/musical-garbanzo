import { expect, test } from "@playwright/test";

test("the harvester earns credits in a live browser session", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("loading")).toBeHidden({ timeout: 30_000 });

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
