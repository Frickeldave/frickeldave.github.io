import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for the site e2e smoke tests.
 *
 * The webServer builds the static site (`npm run build`) and serves it with
 * `astro preview`, so the tests hit real, built URLs. `npm run build` also
 * triggers the `postbuild` pagefind indexing step.
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: 'http://localhost:4321',
    headless: true,
    trace: 'retain-on-failure',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run build && npx astro preview --host 0.0.0.0 --port 4321',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    // The timeout covers the build, not just the test run. Measured cold
    // `npm run build` on the self-hosted `fd` runner: 376 s at 3 vCPU / 8 GiB,
    // 493 s at 2 vCPU on the same shared host. 600 s keeps ~20 % headroom over
    // the worst measurement instead of failing on a busy node.
    timeout: 600_000,
  },
});
