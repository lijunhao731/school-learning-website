import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright config for the K12 learning platform E2E suite.
 *
 * The dev server is started automatically (and reused across local runs
 * via `reuseExistingServer`) so a separate `npm run dev` is not required.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30000,
  fullyParallel: true,
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL: "http://localhost:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: "npm run dev",
    url: "http://localhost:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
