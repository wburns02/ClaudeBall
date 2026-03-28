// playwright-tests/crawler.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './playwright-tests',
  timeout: 900000, // 15 min per test
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'crawler-results.json' }]],
  use: {
    baseURL: 'http://localhost:5173',
    headless: true,
    viewport: { width: 1280, height: 800 },
    screenshot: 'only-on-failure',
    video: 'off',
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: true,
    timeout: 30000,
  },
  projects: [
    { name: 'mega-crawler', use: { ...devices['Desktop Chrome'] }, testMatch: 'mega-crawler.spec.ts' },
    { name: 'interaction-crawler', use: { ...devices['Desktop Chrome'] }, testMatch: 'interaction-crawler.spec.ts' },
    { name: 'dynasty-living', use: { ...devices['Desktop Chrome'] }, testMatch: 'dynasty-living-crawler.spec.ts' },
  ],
});
