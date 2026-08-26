import { expect, test } from "@playwright/test";

/**
 * Renders the developer sprite sheet and saves it as an artifact so unit and structure artwork can
 * be reviewed at 3x instead of squinting at 10-pixel units in gameplay screenshots.
 */
// The sheet is taller than a normal viewport; capturing it in one piece needs a matching viewport.
test.use({ viewport: { width: 1780, height: 2420 } });

test("sprite sheet renders", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  await page.goto("/?sprites");
  const sheet = page.getByTestId("sprite-sheet");
  await expect(sheet).toBeVisible();
  await page.waitForTimeout(3000);
  await sheet.screenshot({ path: "test-results/sprite-sheet.png" });
  expect(errors, errors.join("\n")).toHaveLength(0);
});
