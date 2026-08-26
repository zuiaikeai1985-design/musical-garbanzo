import { expect, type Page } from "@playwright/test";

/**
 * Menu → briefing → battlefield.
 *
 * Centralised so that inserting another screen into the flow (as the mission briefing was)
 * cannot silently break a dozen unrelated specs.
 */
export async function startMission(page: Page, lang: "en" | "zh" = "en"): Promise<void> {
  await page.goto("/");
  if (lang === "zh") await page.getByTestId("lang-toggle").click();
  await page.getByTestId("start").click();
  await expect(page.getByTestId("briefing")).toBeVisible();
  await page.getByTestId("briefing-proceed").click();
  await expect(page.getByTestId("loading")).toBeHidden({ timeout: 30_000 });
  await expect(page.getByTestId("battlefield")).toBeVisible();
  // Let the first few frames render before anything is asserted on.
  await page.waitForTimeout(400);
}

/** Collects page errors, console errors and failed requests for an "it stayed clean" assertion. */
export function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(String(e)));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  page.on("requestfailed", (r) => errors.push(`request failed: ${r.url()}`));
  page.on("response", (r) => {
    if (r.status() >= 400) errors.push(`HTTP ${r.status()} ${r.url()}`);
  });
  return errors;
}
