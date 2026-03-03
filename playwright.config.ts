import { defineConfig, devices } from "@playwright/test";

const ACCESS_SECRET = "e2e-test-secret";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL: "http://localhost:3099",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: `ACCESS_SECRET=${ACCESS_SECRET} npm run dev -- --port 3099`,
    url: "http://localhost:3099",
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
    env: {
      ACCESS_SECRET,
    },
  },
});
