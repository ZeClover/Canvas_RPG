import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  retries: 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run preview -- --port 4173 --strictPort",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // Optional escape hatch for sandboxed/offline environments that
        // pre-bake a Chromium binary under a non-standard path. Unset by
        // default, so normal machines (including the Windows build target)
        // just use Playwright's own downloaded browser via `npx playwright
        // install`.
        ...(process.env.E2E_CHROMIUM_EXECUTABLE ? { launchOptions: { executablePath: process.env.E2E_CHROMIUM_EXECUTABLE } } : {}),
      },
    },
  ],
});
