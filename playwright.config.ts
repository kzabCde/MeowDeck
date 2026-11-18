import { defineConfig, devices } from '@playwright/test';

// Development-mode regression suite preserves the P2/P3 seeded QA parameters.
// Those query flags are intentionally disabled in Next.js production builds.
export default defineConfig({
  testDir: './e2e',
  // Only UI dev regressions belong here. Production and offline PWA tests run
  // with playwright.production.config.ts against a built Next.js server.
  testMatch: ['**/gameplay.spec.ts', '**/p3.spec.ts', '**/p4.spec.ts', '**/p4-5-visual.spec.ts', '**/p4-6-onboarding.spec.ts', '**/p4-7-game-feel.spec.ts', '**/p4-8-quality.spec.ts', '**/p5-blackjack.spec.ts', '**/music-loop.spec.ts', '**/unified-cardroom.spec.ts'],
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
