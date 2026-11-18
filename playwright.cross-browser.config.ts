import { defineConfig, devices } from '@playwright/test';

/** Focused non-mutating smoke across browser engines, including iPhone WebKit emulation.
 * Physical Safari/Android validation remains a separate manual release gate. */
export default defineConfig({
  testDir: './e2e',
  testMatch: ['**/p4-8-cross-browser.spec.ts'],
  timeout: 90_000,
  expect: { timeout: 12_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [
    { name: 'chromium-smoke', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox-smoke', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit-smoke', use: { ...devices['Desktop Safari'] } },
    { name: 'iphone-webkit-smoke', use: { ...devices['iPhone 13'] } }
  ],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 150_000
  }
});
