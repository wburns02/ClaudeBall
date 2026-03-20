import { test, expect } from '@playwright/test';
const base = 'http://localhost:5173';

async function spa(page: any, path: string) {
  await page.evaluate((p: string) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
}

test('Compare Players - all 3 slots have inputs', async ({ page }) => {
  await page.goto(base);
  await page.waitForTimeout(2000);
  
  // Setup franchise first
  const startBtn = page.locator('button:has-text("Start New Franchise")');
  if (await startBtn.count() > 0) {
    await startBtn.click();
    await page.waitForTimeout(500);
    const teamBtn = page.locator('button').filter({ hasText: /Austin Thunderhawks/ }).first();
    if (await teamBtn.count() > 0) {
      await teamBtn.click();
      await page.waitForTimeout(300);
    }
    const startSeason = page.locator('button:has-text("Start Season")');
    if (await startSeason.count() > 0) {
      await startSeason.click();
      await page.waitForTimeout(1000);
    }
  }
  
  await spa(page, '/franchise/compare');
  await page.waitForTimeout(1500);
  
  // Count search inputs
  const inputs = page.locator('input[placeholder*="Search"]');
  const count = await inputs.count();
  console.log(`COMPARE_SLOT_COUNT=${count}`);
  
  // Take screenshot
  await page.screenshot({ path: '/tmp/compare-slots.png', fullPage: true });
  
  // Try typing in slot 1
  if (count > 0) {
    await inputs.nth(0).fill('J');
    await page.waitForTimeout(300);
    const dropdown = page.locator('[class*="rounded-lg shadow-xl"]');
    const hasDropdown = await dropdown.count() > 0;
    console.log(`SLOT1_DROPDOWN=${hasDropdown}`);
  }
});
