import { expect, test } from "@playwright/test";

// Headless Chrome blocks audio until a gesture; this flag lets the suite verify playback.
test.use({
  launchOptions: {
    executablePath: process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome",
    args: [
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--use-gl=swiftshader",
      "--autoplay-policy=no-user-gesture-required",
    ],
  },
});

test.describe("audio", () => {
  test("decodes every clip, plays music and fires combat cues", async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e)));
    page.on("response", (r) => {
      if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
    });

    await page.goto("/");
    await page.getByTestId("start").click();
    await expect(page.getByTestId("loading")).toBeHidden({ timeout: 30_000 });

    // Every generated clip must decode; a typo in a filename would silently disable a sound.
    await expect
      .poll(async () => page.evaluate(() => window.__raAudioState?.().buffersDecoded ?? 0), {
        timeout: 30_000,
        intervals: [500],
      })
      .toBeGreaterThan(0);

    const state = await page.evaluate(() => window.__raAudioState?.());
    expect(state).toBeDefined();
    expect(state!.contextState).toBe("running");
    expect(state!.buffersDecoded).toBe(state!.expectedBuffers);
    expect(state!.musicTrack).toBe("theme");

    const before = state!.playCount;
    await page.evaluate(() => window.__ra?.spawnSkirmish());
    await page.waitForTimeout(3000);

    const after = await page.evaluate(() => window.__raAudioState?.().playCount ?? 0);
    expect(after, "gunfire should have triggered sound cues").toBeGreaterThan(before);

    expect(errors, errors.join("\n")).toHaveLength(0);
  });

  test("respects the volume settings and persists them", async ({ page }) => {
    await page.goto("/");
    await page.evaluate(() => {
      localStorage.setItem("ra.audio", JSON.stringify({ musicVolume: 0.11, sfxVolume: 0.22 }));
    });
    await page.reload();
    await page.getByTestId("start").click();
    await expect(page.getByTestId("loading")).toBeHidden({ timeout: 30_000 });

    const settings = await page.evaluate(() => window.__raAudioState?.().settings);
    expect(settings?.musicVolume).toBeCloseTo(0.11, 5);
    expect(settings?.sfxVolume).toBeCloseTo(0.22, 5);
  });
});
