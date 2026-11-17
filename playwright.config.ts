import { defineConfig, devices } from '@playwright/test';

// Development-mode regression suite preserves the P2/P3 seeded QA parameters.
// Those query flags are intentionally disabled in Next.js production builds.
export default defineConfig({
  testDir: './e2e',
  // Offline reopening requires a production build and installed service worker.\n  testIgnore: ['**/production.spec.ts', '**/offline.spec.ts'],
  timeout: 180_000,
  expect: { timeout: 10_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: { baseURL: 'http://127.0.0.1:3000', trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev -- --hostname 127.0.0.1 --port 3000',
    url: 'http://127.0.0.1:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 150_000
  }
});
