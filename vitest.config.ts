import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/sim/**/*.test.ts"],
    testTimeout: 120_000,
    hookTimeout: 60_000,
  },
});
