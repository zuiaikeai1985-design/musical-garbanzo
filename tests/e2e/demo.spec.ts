import { expect, test, type Page } from "@playwright/test";
import { startMission } from "./helpers";

/**
 * Scripted playthrough recorded to video.
 *
 * This is a demo artifact rather than an assertion-heavy test: it walks the whole game — menu,
 * both languages, briefing, base building, unit production, a firefight, a nuclear strike and the
 * victory tally — so the result can be watched end to end.
 */
test.use({
  video: { mode: "on", size: { width: 1280, height: 720 } },
  viewport: { width: 1280, height: 720 },
});

async function beat(page: Page, ms: number) {
  await page.waitForTimeout(ms);
}

test("full playthrough demo", async ({ page }) => {
  // ── Main menu, in both languages ──────────────────────────────────────────
  await page.goto("/");
  await beat(page, 1800);
  await page.getByTestId("lang-toggle").click();
  await beat(page, 1600);
  await page.getByTestId("lang-toggle").click();
  await beat(page, 900);

  await page.getByTestId("difficulty-hard").click();
  await beat(page, 700);
  await page.getByTestId("difficulty-normal").click();
  await beat(page, 900);

  // ── Options ───────────────────────────────────────────────────────────────
  await page.getByTestId("open-settings").click();
  await beat(page, 1200);
  await page.getByTestId("settings-music").fill("40");
  await beat(page, 500);
  await page.getByTestId("settings-close").click();
  await beat(page, 700);

  // ── Briefing ──────────────────────────────────────────────────────────────
  await page.getByTestId("start").click();
  await expect(page.getByTestId("briefing")).toBeVisible();
  await beat(page, 4500);
  await page.getByTestId("briefing-proceed").click();
  await expect(page.getByTestId("loading")).toBeHidden({ timeout: 30_000 });
  await beat(page, 1800);

  const canvas = page.locator('[data-testid="battlefield"]');
  const box = (await canvas.boundingBox())!;

  // ── Build out the base ────────────────────────────────────────────────────
  await page.evaluate(() => window.__ra!.grantCredits(40_000));
  await beat(page, 600);

  for (const kind of ["power", "barracks", "warfactory"]) {
    const icon = page.getByTestId(`build-${kind}`);
    await icon.click();
    await expect(icon).toHaveAttribute("data-state", "ready", { timeout: 60_000 });
    await icon.click();
    const spot = await page.evaluate((k) => window.__ra!.placementSpot(k), kind);
    if (spot) {
      await page.mouse.move(box.x + spot.x, box.y + spot.y);
      await beat(page, 700);
      await page.mouse.click(box.x + spot.x, box.y + spot.y);
    }
    await beat(page, 900);
  }

  // ── Produce armour ────────────────────────────────────────────────────────
  await page.getByTestId("tab-vehicles").click();
  await beat(page, 700);
  const tank = page.getByTestId("build-3tnk");
  for (let i = 0; i < 4; i++) {
    await tank.click();
    await beat(page, 250);
  }
  await beat(page, 6000);

  // ── Select and manoeuvre ──────────────────────────────────────────────────
  await page.mouse.move(box.x + box.width * 0.12, box.y + box.height * 0.12);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.78, box.y + box.height * 0.82, { steps: 22 });
  await beat(page, 500);
  await page.mouse.up();
  await beat(page, 900);
  await page.mouse.click(box.x + box.width * 0.62, box.y + box.height * 0.34, { button: "right" });
  await beat(page, 2600);

  // ── Firefight ─────────────────────────────────────────────────────────────
  await page.evaluate(() => window.__ra!.spawnSkirmish());
  await beat(page, 9000);

  // ── Nuclear strike ────────────────────────────────────────────────────────
  const aim = await page.evaluate(() => window.__ra!.armNuke());
  await beat(page, 1200);
  const silo = page.getByTestId("superweapon");
  await expect(silo).toHaveAttribute("data-state", "ready", { timeout: 10_000 });
  await beat(page, 900);
  await silo.click();
  await beat(page, 600);
  if (aim) await page.mouse.click(box.x + aim.x, box.y + aim.y);
  await expect(page.getByTestId("nuke-alert")).toBeVisible();
  await beat(page, 11_500);
  await beat(page, 3500);

  // ── Victory ───────────────────────────────────────────────────────────────
  await page.evaluate(() => window.__ra!.wipeSide("allied"));
  await expect(page.getByTestId("result")).toBeVisible({ timeout: 15_000 });
  await beat(page, 4000);
});
