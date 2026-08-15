import { expect, test, type Page } from "@playwright/test";

async function startMission(page: Page) {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });

  await page.goto("/");
  await page.getByTestId("start").click();
  // Sprite baking runs behind a loading screen; wait for it to disappear.
  await expect(page.getByTestId("loading")).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId("battlefield")).toBeVisible();
  // Let a few frames render.
  await page.waitForTimeout(600);
  return errors;
}

test.describe("battlefield", () => {
  test("renders the map, sidebar and minimap", async ({ page }) => {
    const errors = await startMission(page);
    await page.screenshot({ path: "test-results/battlefield.png" });
    await expect(page.getByTestId("minimap")).toBeVisible();
    await expect(page.getByTestId("credits")).toContainText("$");
    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("the canvas is actually painted (not a blank frame)", async ({ page }) => {
    await startMission(page);
    const stats = await page.evaluate(() => {
      const canvas = document.querySelector<HTMLCanvasElement>('[data-testid="battlefield"]');
      if (!canvas) return null;
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const seen = new Set<number>();
      let nonBlack = 0;
      for (let i = 0; i < data.length; i += 4 * 97) {
        const key = (data[i] << 16) | (data[i + 1] << 8) | data[i + 2];
        seen.add(key);
        if (key !== 0x05060a && key !== 0) nonBlack++;
      }
      return { distinctColors: seen.size, nonBlack, width: canvas.width, height: canvas.height };
    });

    expect(stats).not.toBeNull();
    expect(stats!.width).toBeGreaterThan(400);
    // A real terrain render has a spread of palette colours; a blank frame has one or two.
    expect(stats!.distinctColors).toBeGreaterThan(20);
    expect(stats!.nonBlack).toBeGreaterThan(100);
  });

  test("scrolls the camera with the keyboard", async ({ page }) => {
    await startMission(page);
    const before = await page.locator('[data-testid="battlefield"]').screenshot();
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(700);
    await page.keyboard.up("ArrowRight");
    await page.waitForTimeout(200);
    const after = await page.locator('[data-testid="battlefield"]').screenshot();
    expect(Buffer.compare(before, after), "camera should have moved").not.toBe(0);
  });

  test("box-selects units and orders them to move", async ({ page }) => {
    await startMission(page);
    const canvas = page.locator('[data-testid="battlefield"]');
    const box = (await canvas.boundingBox())!;

    // Drag a marquee across the middle of the view where the starting base sits.
    await page.mouse.move(box.x + box.width * 0.15, box.y + box.height * 0.15);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width * 0.85, box.y + box.height * 0.85, { steps: 12 });
    await page.screenshot({ path: "test-results/marquee.png" });
    await page.mouse.up();
    await page.waitForTimeout(200);

    const selected = await page.evaluate(() => window.__ra?.selectionSize() ?? -1);
    expect(selected, "marquee should have selected the starting units").toBeGreaterThan(0);

    await page.screenshot({ path: "test-results/selected.png" });

    const positionsBefore = await page.evaluate(() => window.__ra?.unitPositions() ?? []);
    await page.mouse.click(box.x + box.width * 0.75, box.y + box.height * 0.3, { button: "right" });
    await page.waitForTimeout(2500);
    const positionsAfter = await page.evaluate(() => window.__ra?.unitPositions() ?? []);

    const moved = positionsAfter.filter((p, i) => {
      const b = positionsBefore[i];
      return b && Math.hypot(p.x - b.x, p.y - b.y) > 8;
    });
    expect(moved.length, "ordered units should have moved").toBeGreaterThan(0);
    await page.screenshot({ path: "test-results/moved.png" });
  });
});
