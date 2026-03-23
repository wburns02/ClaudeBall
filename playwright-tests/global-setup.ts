/**
 * Global setup — creates a franchise, sims 30 days, saves storage state.
 * All tests load from this state so each test starts with franchise data.
 */
import { chromium } from '@playwright/test';
import { execSync } from 'child_process';

const BASE = 'http://localhost:5173';
export const STATE_FILE = 'playwright-tests/franchise-state.json';

export default async function globalSetup() {
  execSync('mkdir -p /tmp/deep-audit');

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  await page.goto(BASE);
  await page.waitForTimeout(2000);

  // Dismiss onboarding overlay if present
  const skipTour = page.locator('button, a, span').filter({ hasText: /Skip Tour/i }).first();
  if (await skipTour.count() > 0) {
    await skipTour.click();
    await page.waitForTimeout(500);
  }

  // Create franchise if needed
  const newBtn = page.locator('button:has-text("New Franchise")');
  if (await newBtn.count() > 0) {
    await newBtn.click();
    await page.waitForTimeout(600);
    const team = page.locator('button').filter({ hasText: /Austin/ }).first();
    if (await team.count() > 0) {
      await team.click();
      await page.waitForTimeout(400);
    }
    const start = page.locator('button:has-text("Start Season")');
    if (await start.count() > 0) {
      await start.click();
      await page.waitForTimeout(2000);
    }
    await page.keyboard.press('Escape');
    await page.waitForTimeout(500);
  }

  // Navigate to franchise dashboard
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(1000);

  // Sim 30 days to get meaningful stats
  const sim30 = page.locator('button:has-text("Sim 30 Days")');
  if (await sim30.count() > 0) {
    await sim30.click();
    await page.waitForTimeout(6000);
  }

  // Save the storage state (localStorage + cookies)
  await context.storageState({ path: STATE_FILE });
  await browser.close();
}
