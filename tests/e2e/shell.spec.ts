import { expect, test, type Page } from "@playwright/test";
import { startMission } from "./helpers";

async function toBriefing(page: Page) {
  await page.goto("/");
  await page.getByTestId("start").click();
  await expect(page.getByTestId("briefing")).toBeVisible();
}

const toGame = startMission;

test.describe("shell", () => {
  test("briefing types out its dossier and can be skipped", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));

    await toBriefing(page);
    const text = page.getByTestId("briefing-text");
    const partial = (await text.textContent()) ?? "";

    // Clicking the backdrop skips to the full text.
    await page.mouse.click(60, 60);
    await page.waitForTimeout(150);
    const full = (await text.textContent()) ?? "";
    expect(full.length).toBeGreaterThan(partial.length);
    expect(full).toContain("Allied forces");

    await page.screenshot({ path: "test-results/briefing.png" });
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("briefing renders in Chinese", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("lang-toggle").click();
    await page.getByTestId("start").click();
    await expect(page.getByTestId("briefing")).toBeVisible();
    await page.mouse.click(60, 60);
    await page.waitForTimeout(200);
    await expect(page.getByTestId("briefing")).toContainText("盟军");
    await page.screenshot({ path: "test-results/briefing-zh.png" });
  });

  test("Esc pauses the simulation and resuming continues it", async ({ page }) => {
    await toGame(page);

    await page.keyboard.press("Escape");
    await expect(page.getByTestId("pause-menu")).toBeVisible();
    await page.screenshot({ path: "test-results/pause.png" });

    const frozen = await page.evaluate(() => window.__ra?.tick() ?? 0);
    await page.waitForTimeout(900);
    const stillFrozen = await page.evaluate(() => window.__ra?.tick() ?? 0);
    expect(stillFrozen, "the clock must stop while paused").toBe(frozen);

    await page.getByTestId("pause-resume").click();
    await expect(page.getByTestId("pause-menu")).toBeHidden();
    await page.waitForTimeout(800);
    const resumed = await page.evaluate(() => window.__ra?.tick() ?? 0);
    expect(resumed).toBeGreaterThan(frozen);
  });

  test("F1 opens the field manual", async ({ page }) => {
    await toGame(page);
    await page.keyboard.press("F1");
    await expect(page.getByTestId("help")).toBeVisible();
    await expect(page.getByTestId("help")).toContainText("Ctrl + 1-9");
    await page.screenshot({ path: "test-results/help.png" });
    await page.getByTestId("help-close").click();
    await expect(page.getByTestId("help")).toBeHidden();
  });

  test("options adjust and persist the mixer", async ({ page }) => {
    await page.goto("/");
    await page.getByTestId("open-settings").click();
    await expect(page.getByTestId("settings")).toBeVisible();

    await page.getByTestId("settings-music").fill("20");
    await page.getByTestId("settings-sfx").fill("80");
    await page.screenshot({ path: "test-results/settings.png" });
    await page.getByTestId("settings-close").click();

    const stored = await page.evaluate(() => localStorage.getItem("ra.audio"));
    expect(stored).toContain("0.2");
    expect(stored).toContain("0.8");
  });
});
