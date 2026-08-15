import { expect, test } from "@playwright/test";
import { collectErrors, startMission } from "./helpers";

test("the missile silo arms, launches and flattens the target", async ({ page }) => {
  const errors = collectErrors(page);
  await startMission(page);

  const aim = await page.evaluate(() => window.__ra!.armNuke());
  expect(aim, "the test bridge should have placed a silo").not.toBeNull();
  await page.waitForTimeout(400);

  const panel = page.getByTestId("superweapon");
  await expect(panel).toHaveAttribute("data-state", "ready", { timeout: 10_000 });
  await page.screenshot({ path: "test-results/nuke-ready.png" });

  await panel.click();
  await expect(panel).toHaveAttribute("data-state", "targeting");

  const canvas = page.locator('[data-testid="battlefield"]');
  const box = (await canvas.boundingBox())!;
  const enemyHpBefore = await page.evaluate(() => window.__ra!.totalHp("allied"));

  await page.mouse.click(box.x + aim!.x, box.y + aim!.y);

  // The launch warning and countdown appear immediately.
  await expect(page.getByTestId("nuke-alert")).toBeVisible({ timeout: 5000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: "test-results/nuke-countdown.png" });
  const countdown = Number(await page.getByTestId("nuke-countdown").textContent());
  expect(countdown).toBeGreaterThan(0);
  expect(countdown).toBeLessThanOrEqual(10);

  // Wait for impact.
  await expect(page.getByTestId("nuke-alert")).toBeHidden({ timeout: 30_000 });
  await page.waitForTimeout(400);
  await page.screenshot({ path: "test-results/nuke-impact.png" });

  const enemyHpAfter = await page.evaluate(() => window.__ra!.totalHp("allied"));
  expect(enemyHpAfter, "the warhead should have gutted the enemy base").toBeLessThan(
    enemyHpBefore * 0.75,
  );

  expect(errors, errors.join("\n")).toHaveLength(0);
});
