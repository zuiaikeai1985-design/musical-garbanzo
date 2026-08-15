import { expect, test } from "@playwright/test";

test("a live firefight damages both sides and renders effects", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("loading")).toBeHidden({ timeout: 30_000 });
  await page.waitForTimeout(400);

  // Only the skirmish force is measured — `totalHp` for a side would also include the whole
  // enemy base on the far side of the map and swamp the signal.
  const force = await page.evaluate(() => window.__ra!.spawnSkirmish());
  await page.waitForTimeout(300);
  await page.screenshot({ path: "test-results/combat-start.png" });

  const hostileBefore = await page.evaluate((ids) => window.__ra!.hpOf(ids), force.hostile);
  const friendlyBefore = await page.evaluate((ids) => window.__ra!.hpOf(ids), force.friendly);
  expect(hostileBefore).toBeGreaterThan(0);

  // Grab a mid-fight frame while shells are still in the air.
  await page.waitForTimeout(2500);
  await page.screenshot({ path: "test-results/combat-mid.png" });
  const effects = await page.evaluate(() => window.__ra!.effectCount());
  expect(effects, "explosions, tracers and smoke should be on screen").toBeGreaterThan(0);

  await expect
    .poll(async () => page.evaluate((ids) => window.__ra!.hpOf(ids), force.hostile), {
      timeout: 60_000,
      intervals: [1000],
    })
    .toBeLessThan(hostileBefore * 0.4);

  const friendlyAfter = await page.evaluate((ids) => window.__ra!.hpOf(ids), force.friendly);
  expect(friendlyAfter, "the enemy should have fought back").toBeLessThan(friendlyBefore);

  await page.screenshot({ path: "test-results/combat-end.png" });
  expect(errors, errors.join("\n")).toHaveLength(0);
});
