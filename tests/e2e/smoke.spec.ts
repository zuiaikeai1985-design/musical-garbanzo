import { expect, test } from "@playwright/test";

test.describe("boot", () => {
  test("main menu renders in both languages", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("console", (m) => {
      if (m.type() === "error") errors.push(m.text());
    });
    page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
    });

    await page.goto("/");

    await expect(page.getByTestId("app-title")).toHaveText("RED ALERT");
    await expect(page.getByTestId("title-banner")).toBeVisible();
    await page.screenshot({ path: "test-results/menu-en.png" });

    await page.getByTestId("lang-toggle").click();
    await expect(page.getByTestId("app-title")).toHaveText("红色警报");
    await page.screenshot({ path: "test-results/menu-zh.png" });

    // Back to English, then through the briefing and into the mission.
    await page.getByTestId("lang-toggle").click();
    await page.getByTestId("start").click();
    await expect(page.getByTestId("briefing")).toBeVisible();
    await page.getByTestId("briefing-proceed").click();
    await expect(page.getByTestId("battlefield")).toBeVisible();
    await page.screenshot({ path: "test-results/game.png" });

    expect(errors, `console/page errors: ${errors.join("\n")}`).toHaveLength(0);
  });
});
