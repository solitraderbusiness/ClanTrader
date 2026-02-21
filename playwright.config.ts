import { defineConfig, devices } from "@playwright/test";

const BASE_URL = process.env.TEST_BASE_URL || "http://localhost:3000";
const RUN_MODE = process.env.TEST_RUN_MODE || "HEADLESS";
const SLOW_MO = parseInt(process.env.TEST_SLOW_MO || "0");
const WORKERS = parseInt(process.env.TEST_WORKERS || "2");

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: WORKERS,
  reporter: [["html", { open: "never" }], ["list"]],
  use: {
    baseURL: BASE_URL,
    trace: process.env.TEST_TRACE === "true" ? "on" : "off",
    video: process.env.TEST_VIDEO === "true" ? "on" : "off",
    screenshot: "only-on-failure",
    headless: RUN_MODE !== "HEADED",
    launchOptions: {
      slowMo: RUN_MODE === "HEADED" ? SLOW_MO : 0,
    },
  },
  projects: [
    {
      name: "smoke",
      testMatch: /smoke\/.+\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "full-e2e",
      testMatch: /e2e\/.+\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "simulator",
      testMatch: /simulator\/.+\.spec\.ts/,
      timeout: 60_000,
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
