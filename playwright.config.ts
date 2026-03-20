import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright-tests',
  timeout: 60000,
  retries: 0,
  globalSetup: './playwright-tests/global-setup.ts',
  reporter: [['list'], ['json', { outputFile: 'qa-results.json' }]],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'on',
    video: 'off',
    storageState: 'playwright-tests/franchise-state.json',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: undefined, // Server already running
});
