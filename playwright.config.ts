import { defineConfig } from "@playwright/test";

const baseURL = process.env.APP_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./tests/e2e",
  globalSetup: "./tests/e2e/global-setup.ts",
  fullyParallel: true,
  reporter: "list",
  // Neon's serverless compute can be cold on the very first query of a
  // freshly-started dev server (observed 5-15s connection latency in the
  // integration suite) — Playwright's 5s/30s defaults are too tight for
  // that, especially once latency compounds across several sequential
  // steps in one test.
  timeout: 120000,
  expect: { timeout: 20000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run dev",
    url: baseURL,
    reuseExistingServer: true,
  },
});
