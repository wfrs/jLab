import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright covers the one thing the unit tests cannot: whether the
 * millimetres in `label-layout.ts` survive a real layout engine and come out of
 * a real print pipeline. Everything else about labels is tested in Jest.
 *
 * Specs live in `tests/e2e` and are excluded from the Jest run
 * (`testPathIgnorePatterns` in jest.config.js), since Jest's testMatch also
 * claims `*.spec.ts`.
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? 'github' : 'list',

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },

  projects: [
    {
      // Chromium only: this suite measures print layout, and `page.pdf()` is
      // Chromium-only in Playwright.
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
