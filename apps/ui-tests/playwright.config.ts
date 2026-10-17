import { defineConfig } from '@playwright/test';

/**
 * Responsive layout checks. Both apps run on their own dev servers with a fake API host
 * (http://api.mock), which tests answer from lib/mock-api.ts: no real accounts, no cloud data.
 */
export const DASHBOARD = 'http://localhost:5199';
export const WEB = 'http://localhost:5198';
const MOCK_ENV = {
  VITE_API_URL: 'http://api.mock',
  VITE_SUPABASE_URL: 'http://supabase.mock',
  VITE_SUPABASE_PUBLISHABLE_KEY: 'mock-publishable-key',
  VITE_WEB_URL: 'https://dvote.app',
};

export default defineConfig({
  testDir: './tests',
  outputDir: './test-results',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 6,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  use: { trace: 'retain-on-failure', reducedMotion: 'reduce' },
  webServer: [
    {
      command: 'npx vite --port 5199 --strictPort',
      cwd: '../dashboard',
      url: DASHBOARD,
      env: MOCK_ENV,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
    {
      command: 'npx vite --port 5198 --strictPort',
      cwd: '../web',
      url: WEB,
      env: MOCK_ENV,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
    },
  ],
});
