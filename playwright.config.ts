import { defineConfig } from "@playwright/test";

/**
 * The VM ships Google Chrome at /usr/local/bin/google-chrome, so we reuse it instead of
 * downloading Playwright's own browser bundle.
 */
const CHROME_PATH = process.env.CHROME_PATH ?? "/usr/local/bin/google-chrome";

export default defineConfig({
  testDir: "./tests/e2e",
  outputDir: "./test-results",
  timeout: 90_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:5173",
    viewport: { width: 1600, height: 900 },
    launchOptions: {
      executablePath: CHROME_PATH,
      args: ["--no-sandbox", "--disable-dev-shm-usage", "--use-gl=swiftshader"],
    },
    screenshot: "off",
    video: "off",
    trace: "off",
  },
  webServer: {
    command: "npm run dev",
    url: "http://127.0.0.1:5173",
    reuseExistingServer: true,
    timeout: 120_000,
  },
});
