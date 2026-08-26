import { expect, test } from "@playwright/test";
import { collectErrors, startMission } from "./helpers";

/**
 * Frame-rate regression guard.
 *
 * Headless Chrome renders through SwiftShader (software rasterisation), so the absolute numbers
 * are pessimistic compared to a real GPU — the thresholds below are deliberately conservative and
 * are there to catch an order-of-magnitude regression, not to certify a target frame rate.
 */
test.describe("performance", () => {
  test("holds a usable frame rate with a large battle on screen", async ({ page }) => {
    const errors = collectErrors(page);
    await startMission(page);

    // Baseline with just the starting forces.
    await page.waitForTimeout(1500);
    const idle = await page.evaluate(() => window.__ra!.perf());
    expect(idle.sampleCount).toBeGreaterThan(30);

    const spawned = await page.evaluate(() => window.__ra!.stressTest(100));
    expect(spawned, "the stress test should have spawned 200 units").toBe(200);

    // Give the battle a few seconds to develop, then measure the steady state.
    await page.waitForTimeout(4000);
    const heavy = await page.evaluate(() => window.__ra!.perf());
    const unitCount = await page.evaluate(() => window.__ra!.unitCount());

    // eslint-disable-next-line no-console
    console.log(
      `perf: idle ${idle.fps.toFixed(1)}fps (${idle.frameMs.toFixed(1)}ms) -> ` +
        `battle ${heavy.fps.toFixed(1)}fps (${heavy.frameMs.toFixed(1)}ms) with ${unitCount} units`,
    );

    await page.screenshot({ path: "test-results/stress.png" });

    expect(heavy.fps, "a 200-unit battle must stay comfortably interactive").toBeGreaterThan(24);
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("does not leak entities or effects during a long battle", async ({ page }) => {
    await startMission(page);
    await page.evaluate(() => window.__ra!.stressTest(60));
    await page.waitForTimeout(2000);
    const early = await page.evaluate(() => ({
      units: window.__ra!.unitCount(),
      effects: window.__ra!.effectCount(),
      projectiles: window.__ra!.projectileCount(),
    }));

    await page.waitForTimeout(12_000);
    const late = await page.evaluate(() => ({
      units: window.__ra!.unitCount(),
      effects: window.__ra!.effectCount(),
      projectiles: window.__ra!.projectileCount(),
    }));

    // Units only die, never spontaneously appear beyond production.
    expect(late.units).toBeLessThanOrEqual(early.units + 20);
    // Effects and projectiles are pooled by lifetime and must not grow without bound.
    expect(late.effects).toBeLessThan(3000);
    expect(late.projectiles).toBeLessThan(300);
  });
});
