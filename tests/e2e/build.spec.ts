import { expect, test, type Page } from "@playwright/test";
import { startMission } from "./helpers";

/**
 * Queues a structure, waits for the cameo to flash READY, then places it on a site the engine
 * itself vouches for (hard-coded drop points land on existing buildings as soon as anything moves).
 */
async function buildAndPlace(page: Page, id: string) {
  const icon = page.getByTestId(`build-${id}`);
  await expect(icon).toBeEnabled();
  await icon.click();

  await expect(icon).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
  await icon.click(); // enter placement mode

  const spot = await page.evaluate((kind) => window.__ra?.placementSpot(kind) ?? null, id);
  expect(spot, `no legal build site on screen for ${id}`).not.toBeNull();

  const canvas = page.locator('[data-testid="battlefield"]');
  const box = (await canvas.boundingBox())!;
  await page.mouse.move(box.x + spot!.x, box.y + spot!.y);
  await page.waitForTimeout(150);
  await page.screenshot({ path: `test-results/place-${id}.png` });
  await page.mouse.click(box.x + spot!.x, box.y + spot!.y);
  await page.waitForTimeout(400);
}

test.describe("build system", () => {
  test("builds a base through the sidebar", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });

    await startMission(page);

    // Fund the build order so the test measures the build system, not the economy.
    await page.evaluate(() => window.__ra?.grantCredits(20000));

    const before = await page.evaluate(() => window.__ra?.structureCounts() ?? {});
    await buildAndPlace(page, "power");
    const afterPower = await page.evaluate(() => window.__ra?.structureCounts() ?? {});
    expect(afterPower.power ?? 0).toBe((before.power ?? 0) + 1);

    // Barracks unlocks the infantry tab.
    await buildAndPlace(page, "barracks");
    const afterBarracks = await page.evaluate(() => window.__ra?.structureCounts() ?? {});
    expect(afterBarracks.barracks ?? 0).toBe(1);

    await page.screenshot({ path: "test-results/base-built.png" });
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("produces a unit from the barracks", async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => window.__ra?.grantCredits(20000));
    await buildAndPlace(page, "barracks");

    await page.getByTestId("tab-infantry").click();
    const rifle = page.getByTestId("build-e1");
    await expect(rifle).toBeEnabled();

    const before = await page.evaluate(
      () => window.__ra?.unitPositions().filter((u) => u.kind === "e1").length ?? 0,
    );
    await rifle.click();

    await expect
      .poll(
        async () =>
          page.evaluate(
            () => window.__ra?.unitPositions().filter((u) => u.kind === "e1").length ?? 0,
          ),
        { timeout: 60_000, intervals: [500] },
      )
      .toBeGreaterThan(before);

    await page.screenshot({ path: "test-results/unit-built.png" });
  });

  test("shows locked items greyed out until their prerequisite exists", async ({ page }) => {
    await startMission(page);
    // Tesla Coil needs a Radar Dome, which mission 01 does not start with.
    await page.getByTestId("tab-defense").click();
    await expect(page.getByTestId("build-tesla")).toBeDisabled();
    await expect(page.getByTestId("build-tesla")).toHaveAttribute("data-state", "locked");
    await page.screenshot({ path: "test-results/tech-locked.png" });
  });

  test("renders the sidebar in Chinese", async ({ page }) => {
    await startMission(page, "zh");
    await expect(page.getByTestId("tab-structures")).toHaveText("建筑");
    await expect(page.getByTestId("build-power")).toContainText("发电厂");
    await page.screenshot({ path: "test-results/sidebar-zh.png" });
  });
});
