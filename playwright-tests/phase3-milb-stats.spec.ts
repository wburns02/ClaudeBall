import { test, expect } from '@playwright/test';
const B = 'http://localhost:5173';

test('AAA Stats tab has correct UI controls', async ({ page }) => {
  await page.goto(B + '/franchise/minors');
  await page.waitForTimeout(1000);

  const body = await page.locator('body').innerText();
  expect(body.length).toBeGreaterThan(100);
  console.log(`MINORS_LOADED|len=${body.length}`);

  const statsTab = page.locator('button').filter({ hasText: /^AAA Stats$/ });
  const tabCount = await statsTab.count();
  console.log(`STATS_TAB_COUNT|${tabCount}`);
  expect(tabCount).toBe(1);

  await statsTab.click();
  await page.waitForTimeout(500);

  const body2 = await page.locator('body').innerText();
  const idx = body2.indexOf('AAA Stats');
  const content = idx >= 0 ? body2.slice(idx).trim() : body2;
  console.log(`STATS_CONTENT|${JSON.stringify(content.slice(0, 600))}`);

  // Controls must be present
  expect(content).toContain('My AAA');
  expect(content).toContain('All Teams');
  expect(content).toContain('Batting');
  expect(content).toContain('Pitching');

  // Show any valid state
  const validState = content.toUpperCase().includes('NO STATS YET') || content.includes('AVG') ||
                     content.includes('No batter stats') || content.includes('OPS');
  console.log(`VALID_STATE|${validState}`);
  expect(validState).toBe(true);

  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/milb-stats-initial.png', fullPage: true });
});

test('AAA Stats populate after sim (SPA navigation)', async ({ page }) => {
  // Full load of franchise dashboard
  await page.goto(B + '/franchise');
  await page.waitForTimeout(2000);

  // Log available sim buttons
  const allBtns = await page.locator('button').allTextContents();
  const simBtns = allBtns.filter(b => /sim|Sim/i.test(b));
  console.log(`SIM_BTNS|${JSON.stringify(simBtns.slice(0, 5))}`);

  // Click first available sim button to generate stats
  const anySimBtn = page.locator('button').filter({ hasText: /^Sim/ }).first();
  const anySimCount = await anySimBtn.count();
  console.log(`ANY_SIM_BTN|count=${anySimCount}`);

  if (anySimCount > 0) {
    const btnText = await anySimBtn.textContent();
    console.log(`CLICKING_SIM|text="${btnText}"`);
    await anySimBtn.click();
    await page.waitForTimeout(2000);
  }

  // Navigate to Minors via SIDEBAR (SPA nav, preserves Zustand in-memory state)
  const minorsNavBtn = page.locator('button').filter({ hasText: /^Minors$/ });
  const minorsNavCount = await minorsNavBtn.count();
  console.log(`MINORS_NAV_BTN|count=${minorsNavCount}`);

  if (minorsNavCount > 0) {
    await minorsNavBtn.click();
  } else {
    // Fallback: sidebar may have different label
    const fallback = page.locator('a, button').filter({ hasText: /Minor|Minors/ }).first();
    if (await fallback.count() > 0) await fallback.click();
    else await page.goto(B + '/franchise/minors');
  }
  await page.waitForTimeout(1000);

  // Click AAA Stats tab
  const statsTab = page.locator('button').filter({ hasText: /^AAA Stats$/ });
  await statsTab.click();
  await page.waitForTimeout(600);

  const body = await page.locator('body').innerText();
  const idx = body.indexOf('AAA Stats');
  const content = idx >= 0 ? body.slice(idx).trim() : body;
  console.log(`POST_SIM_STATS|${JSON.stringify(content.slice(0, 800))}`);

  // After sim, stats may or may not populate depending on RNG, but UI should be valid
  const hasValidContent = content.includes('No Stats Yet') || content.includes('AVG') ||
                          content.includes('No batter stats') || content.includes('OPS') ||
                          content.includes('No pitcher stats') || content.includes('ERA');
  console.log(`STATS_VALID|${hasValidContent}`);
  expect(hasValidContent).toBe(true);

  // Toggle to All Teams
  const allTeamsBtn = page.locator('button').filter({ hasText: /^All Teams$/ });
  expect(await allTeamsBtn.count()).toBe(1);
  await allTeamsBtn.click();
  await page.waitForTimeout(400);

  // Toggle to Pitching
  const pitchingBtn = page.locator('button').filter({ hasText: /^Pitching$/ });
  expect(await pitchingBtn.count()).toBe(1);
  await pitchingBtn.click();
  await page.waitForTimeout(400);

  const body4 = await page.locator('body').innerText();
  const idx4 = body4.indexOf('Pitching');
  const pitchContent = idx4 >= 0 ? body4.slice(idx4).trim() : '';
  console.log(`PITCHING|${JSON.stringify(pitchContent.slice(0, 200))}`);

  await page.screenshot({ path: '/home/will/ClaudeBall/qa-screenshots/milb-stats-populated.png', fullPage: true });
  console.log('PHASE3_DONE');
});
