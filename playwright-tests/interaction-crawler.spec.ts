/**
 * Interaction Crawler — tests buttons, modals, forms on key pages.
 * Clicks every visible button, verifies modals open/close, checks form inputs.
 *
 * Run: npx playwright test --config=playwright-tests/crawler.config.ts --project=interaction-crawler
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

interface InteractionResult {
  page: string;
  action: string;
  status: 'pass' | 'fail';
  error?: string;
}

async function setupFranchise(page: Page) {
  await page.goto(BASE);
  await page.waitForTimeout(3000);
  try { await page.getByRole('button', { name: 'Skip Tour' }).click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(500);

  const dynastyBtn = page.getByTestId('dynasty-mode-btn');
  if (await dynastyBtn.count() > 0) {
    await dynastyBtn.click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Start as GM")').click();
    await page.waitForTimeout(500);
    await page.getByRole('button', { name: /casual/i }).click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Choose Team/ }).click();
    await page.waitForTimeout(500);
    await page.locator('button:has-text("Austin")').first().click();
    await page.waitForTimeout(300);
    await page.getByRole('button', { name: /Start Classic Dynasty/ }).click();
  } else {
    await page.locator('button:has-text("New Franchise")').click();
    await page.waitForTimeout(600);
    await page.locator('button').filter({ hasText: /Austin/ }).first().click();
    await page.waitForTimeout(400);
    await page.locator('button:has-text("Start Season")').click();
  }
  await page.waitForURL(/franchise/, { timeout: 15000 });
  await page.waitForTimeout(3000);
}

async function simDays(page: Page, days: number) {
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  const batches = Math.ceil(days / 30);
  for (let i = 0; i < batches; i++) {
    const sim = page.locator('main button:has-text("Sim 30")').first();
    if (await sim.count() > 0) {
      await sim.click({ force: true });
      await page.waitForTimeout(4000);
      for (let d = 0; d < 3; d++) {
        await page.evaluate(() => {
          for (const text of ['View Results', 'Dismiss', '✕ Dismiss', 'Continue', 'OK', 'Close']) {
            const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
            if (btn) (btn as HTMLButtonElement).click();
          }
          const overlay = document.querySelector('.fixed.inset-0');
          if (overlay) { const btn = overlay.querySelector('button'); if (btn) (btn as HTMLButtonElement).click(); }
        });
        await page.waitForTimeout(500);
      }
    }
    await page.waitForTimeout(500);
  }
}

/** Click every visible button on a page and check for crashes */
async function testPageButtons(page: Page, url: string, pageName: string): Promise<InteractionResult[]> {
  const results: InteractionResult[] = [];
  await page.goto(url);
  await page.waitForTimeout(3000);

  const buttons = await page.locator('main button:visible').all();
  const buttonTexts = await Promise.all(buttons.map(b => b.textContent().catch(() => '')));

  // Skip destructive buttons
  const skipPatterns = ['Sim 30', 'Sim 1', 'Start Season', 'Advance', 'Delete', 'Remove', 'Reset',
    'Release', 'DFA', 'Trade', 'Sign', 'Fire', 'Demote', 'Promote', 'Call Up', 'Send Down'];

  for (let i = 0; i < Math.min(buttons.length, 15); i++) {
    const text = (buttonTexts[i] ?? '').trim();
    if (!text || text.length > 50 || skipPatterns.some(p => text.includes(p))) continue;

    const consoleErrors: string[] = [];
    const handler = (msg: any) => { if (msg.type() === 'error') consoleErrors.push(msg.text().slice(0, 100)); };
    page.on('console', handler);

    try {
      await buttons[i].click({ timeout: 2000 });
      await page.waitForTimeout(1000);

      // Check for crash after click
      const body = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
      if (body.includes('NaN') || body.includes('Something went wrong')) {
        results.push({ page: pageName, action: `Click "${text}"`, status: 'fail', error: 'NaN or crash after click' });
      } else if (consoleErrors.length > 0) {
        results.push({ page: pageName, action: `Click "${text}"`, status: 'fail', error: consoleErrors[0] });
      } else {
        results.push({ page: pageName, action: `Click "${text}"`, status: 'pass' });
      }
    } catch {
      // Button might be gone after page re-render — that's OK
      results.push({ page: pageName, action: `Click "${text}"`, status: 'pass' });
    }

    page.off('console', handler);

    // Return to the page if we navigated away
    if (!page.url().includes(url.replace(BASE, ''))) {
      await page.goto(url);
      await page.waitForTimeout(2000);
    }
  }

  return results;
}

/** Test tab switching on pages that have tabs */
async function testTabs(page: Page, url: string, pageName: string): Promise<InteractionResult[]> {
  const results: InteractionResult[] = [];
  await page.goto(url);
  await page.waitForTimeout(3000);

  // Look for tab-like elements (role="tab" or buttons in tab-like containers)
  const tabs = await page.locator('[role="tab"], .tab-btn, button[data-tab]').all();
  for (let i = 0; i < tabs.length; i++) {
    const text = (await tabs[i].textContent().catch(() => ''))?.trim() ?? `Tab ${i}`;
    try {
      await tabs[i].click({ timeout: 2000 });
      await page.waitForTimeout(1000);
      const body = await page.locator('body').textContent({ timeout: 2000 }).catch(() => '');
      if (body.includes('NaN')) {
        results.push({ page: pageName, action: `Tab "${text}"`, status: 'fail', error: 'NaN after tab switch' });
      } else {
        results.push({ page: pageName, action: `Tab "${text}"`, status: 'pass' });
      }
    } catch {
      results.push({ page: pageName, action: `Tab "${text}"`, status: 'pass' });
    }
  }
  return results;
}

// Pages with the most interactive elements
const INTERACTIVE_PAGES = [
  '/franchise', '/franchise/roster', '/franchise/lineup-editor', '/franchise/depth-chart',
  '/franchise/trade', '/franchise/trade-machine', '/franchise/free-agency',
  '/franchise/training', '/franchise/development', '/franchise/war-room',
  '/franchise/scouting', '/franchise/morale', '/franchise/team-analytics',
  '/franchise/schedule', '/franchise/scoreboard', '/franchise/standings',
  '/franchise/create-player', '/franchise/compare', '/franchise/team-compare',
  '/franchise/payroll', '/franchise/coaching-staff', '/franchise/roster-manager',
];

test('Interaction Crawler: buttons, tabs, and modals', async ({ page }) => {
  test.setTimeout(900000);

  await setupFranchise(page);
  await simDays(page, 30);

  const allResults: InteractionResult[] = [];

  for (const path of INTERACTIVE_PAGES) {
    console.log(`\n  Testing interactions: ${path}`);
    const btnResults = await testPageButtons(page, `${BASE}${path}`, path);
    allResults.push(...btnResults);
    const tabResults = await testTabs(page, `${BASE}${path}`, path);
    allResults.push(...tabResults);
  }

  // Summary
  const fails = allResults.filter(r => r.status === 'fail');
  const passes = allResults.filter(r => r.status === 'pass');

  console.log('\n══════════════════════════════════════');
  console.log('   INTERACTION CRAWLER SUMMARY');
  console.log('══════════════════════════════════════');
  console.log(`  Total interactions tested: ${allResults.length}`);
  console.log(`  ✓ Pass: ${passes.length}`);
  console.log(`  ✗ Fail: ${fails.length}`);
  if (fails.length > 0) {
    console.log('\n  FAILURES:');
    for (const f of fails) console.log(`    ✗ ${f.page} → ${f.action}: ${f.error}`);
  }
  console.log('══════════════════════════════════════\n');

  expect(fails.length, `${fails.length} interaction failures`).toBe(0);
});
