import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright-tests',
  timeout: 1200000,
  retries: 0,
  reporter: 'line',
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    video: 'off',
    // No storageState — career sim creates its own franchise
  },
  projects: [
    {
      name: 'career-sim',
      use: { ...devices['Desktop Chrome'] },
      testMatch: 'dynasty-career-sim.spec.ts',
    },
  ],
});
