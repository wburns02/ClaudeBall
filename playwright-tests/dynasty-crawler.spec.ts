/**
 * Smart Dynasty Crawler — automatically discovers all pages, visits each one,
 * checks for rendering errors, empty states, NaN values, and console errors.
 *
 * Multi-stage: Fresh → Day 30 → Day 120 → Offseason
 *
 * Run: npx playwright test --config=playwright-career.config.ts dynasty-crawler
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

// Known acceptable empty states (pages that legitimately show "no data" before games)
const ACCEPTABLE_EMPTY = [
  'No games played yet',
  'Season not started',
  'No game log entries',
  'Play games to unlock',
  'No playoff data',
  'No life events yet',
  'Select an item',
  'No milestones yet',
];

interface CrawlResult {
  url: string;
  pageName: string;
  status: 'pass' | 'warning' | 'fail';
  issues: string[];
}

async function discoverSidebarLinks(page: Page): Promise<{ name: string; path: string }[]> {
  return page.evaluate(() => {
    const nav = document.querySelector('nav');
    if (!nav) return [];
    const links: { name: string; path: string }[] = [];
    const buttons = nav.querySelectorAll('button');
    for (const btn of buttons) {
      const text = btn.textContent?.trim() ?? '';
      // Skip non-navigation buttons
      if (!text || text === 'Collapse' || text.length > 30) continue;
      links.push({ name: text.replace(/\d+$/, '').trim(), path: '' });
    }
    return links;
  });
}

async function crawlPage(page: Page, url: string, pageName: string): Promise<CrawlResult> {
  const issues: string[] = [];
  const consoleErrors: string[] = [];

  // Collect console errors during page load
  const errorHandler = (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('React DevTools') && !text.includes('favicon')) {
        consoleErrors.push(text.slice(0, 100));
      }
    }
  };
  page.on('console', errorHandler);

  try {
    await page.goto(url, { timeout: 10000 });
    await page.waitForTimeout(2000);
  } catch {
    issues.push('Page failed to load');
    page.off('console', errorHandler);
    return { url, pageName, status: 'fail', issues };
  }

  // Check for blank page (React crash)
  const mainContent = await page.locator('main').textContent({ timeout: 5000 }).catch(() => '');
  if (!mainContent || mainContent.trim().length < 10) {
    // Check if it's just a loading state
    const bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
    if (bodyText.includes('Loading')) {
      // Wait longer
      await page.waitForTimeout(3000);
      const retryContent = await page.locator('main').textContent({ timeout: 3000 }).catch(() => '');
      if (!retryContent || retryContent.trim().length < 10) {
        issues.push('Page appears blank (possible React crash)');
      }
    } else if (!bodyText || bodyText.trim().length < 20) {
      issues.push('Page is completely blank');
    }
  }

  // Check for NaN, undefined, null in visible text
  const pageText = await page.locator('body').textContent().catch(() => '');
  if (pageText.includes('NaN')) issues.push('NaN found in page text');
  if (pageText.match(/\bundefined\b/) && !pageText.includes('undefined behavior')) {
    issues.push('"undefined" found in page text');
  }
  if (pageText.match(/\bnull\b/) && !pageText.includes('null hypothesis')) {
    // Only flag if it looks like a rendering error, not content
    const nullCount = (pageText.match(/\bnull\b/g) ?? []).length;
    if (nullCount > 2) issues.push(`"null" appears ${nullCount} times — possible rendering error`);
  }

  // Check for suspicious empty states that shouldn't be empty
  const suspiciousEmpty = ['No batting data', 'No pitching data', 'No roster data', 'Error'];
  for (const phrase of suspiciousEmpty) {
    if (pageText.includes(phrase)) {
      issues.push(`Suspicious empty state: "${phrase}"`);
    }
  }

  // Check for console errors
  if (consoleErrors.length > 0) {
    issues.push(`${consoleErrors.length} console error(s): ${consoleErrors[0]}`);
  }

  // Check for broken images
  const brokenImages = await page.evaluate(() => {
    const imgs = document.querySelectorAll('img');
    let broken = 0;
    for (const img of imgs) {
      if (!img.complete || img.naturalWidth === 0) broken++;
    }
    return broken;
  });
  if (brokenImages > 0) issues.push(`${brokenImages} broken image(s)`);

  page.off('console', errorHandler);

  const status = issues.length === 0 ? 'pass' : issues.some(i => i.includes('crash') || i.includes('blank') || i.includes('NaN')) ? 'fail' : 'warning';
  return { url, pageName, status, issues };
}

async function simDays(page: Page, days: number) {
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);

  const batches = Math.ceil(days / 30);
  for (let i = 0; i < batches; i++) {
    await page.evaluate(async () => {
      const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
      const main = document.querySelector('main');
      if (!main) return;
      const sim30 = [...main.querySelectorAll('button')].find(b => b.textContent?.includes('Sim 30'));
      if (sim30) {
        sim30.click();
        await sleep(3000);
        for (let d = 0; d < 3; d++) {
          await sleep(300);
          for (const text of ['View Results', 'Dismiss', '✕ Dismiss']) {
            const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.trim().includes(text));
            if (btn) { btn.click(); await sleep(300); }
          }
          const overlay = document.querySelector('.fixed.inset-0.bg-black');
          if (overlay) {
            const btn = overlay.querySelector('button');
            if (btn) { btn.click(); await sleep(300); }
          }
        }
      }
    });
    await page.waitForTimeout(1000);
  }
}

// All franchise routes to crawl
const FRANCHISE_ROUTES = [
  { path: '/franchise', name: 'Dashboard' },
  { path: '/franchise/overview', name: 'Overview' },
  { path: '/franchise/standings', name: 'Standings' },
  { path: '/franchise/roster', name: 'Roster' },
  { path: '/franchise/depth-chart', name: 'Depth Chart' },
  { path: '/franchise/development', name: 'Development Hub' },
  { path: '/franchise/projections', name: 'Projections' },
  { path: '/franchise/training', name: 'Training Center' },
  { path: '/franchise/coaching', name: 'Coaching Staff' },
  { path: '/franchise/lineup', name: 'Lineup Editor' },
  { path: '/franchise/power-rankings', name: 'Power Rankings' },
  { path: '/franchise/leaders', name: 'League Leaders' },
  { path: '/franchise/war-dashboard', name: 'WAR Dashboard' },
  { path: '/franchise/team-stats', name: 'Team Stats' },
  { path: '/franchise/records', name: 'Records' },
  { path: '/franchise/war-room', name: 'GM War Room' },
  { path: '/franchise/scouting', name: 'Scouting Hub' },
  { path: '/franchise/finances', name: 'Finances' },
  { path: '/franchise/payroll', name: 'Payroll' },
  { path: '/franchise/trades', name: 'Trades' },
  { path: '/franchise/trade-machine', name: 'Trade Machine' },
  { path: '/franchise/free-agency', name: 'Free Agency' },
  { path: '/franchise/schedule', name: 'Schedule' },
  { path: '/franchise/game-log', name: 'Game Log' },
  { path: '/franchise/scoreboard', name: 'Scoreboard' },
  { path: '/franchise/goals', name: "Owner's Office" },
  { path: '/franchise/report-card', name: 'Report Card' },
  { path: '/franchise/morale', name: 'Team Morale' },
  { path: '/franchise/hot-cold', name: 'Hot & Cold' },
  { path: '/franchise/awards', name: 'Awards' },
  { path: '/franchise/injuries', name: 'Injuries' },
  { path: '/franchise/minors', name: 'Minors' },
  { path: '/franchise/trade-proposals', name: 'Trade Proposals' },
  { path: '/franchise/trade-history', name: 'Trade History' },
  { path: '/franchise/transactions', name: 'Transactions' },
  { path: '/franchise/news', name: 'League News' },
  { path: '/franchise/highlights', name: 'League Highlights' },
  { path: '/franchise/season-story', name: 'Season Story' },
  { path: '/franchise/season-timeline', name: 'Season Timeline' },
  { path: '/franchise/history', name: 'Franchise History' },
  { path: '/franchise/hall-of-records', name: 'Hall of Records' },
  // Dynasty-specific
  { path: '/dynasty/inbox', name: 'Hot Stove Inbox' },
  { path: '/dynasty/conversation', name: 'Conversations' },
  { path: '/dynasty/life-events', name: 'Life Events' },
  { path: '/dynasty/career-transition', name: 'Career Transition' },
  { path: '/dynasty/prestige', name: 'Legacy & Prestige' },
];

test('Smart Crawler: Multi-stage franchise page audit', async ({ page }) => {
  test.setTimeout(600000); // 10 min

  // === SETUP: Create franchise ===
  await page.goto(BASE);
  await page.waitForTimeout(3000);
  try { await page.getByRole('button', { name: 'Skip Tour' }).click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(500);
  await page.getByTestId('dynasty-mode-btn').click();
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
  await page.waitForURL(/franchise/, { timeout: 15000 });
  await page.waitForTimeout(2000);

  const allResults: CrawlResult[] = [];

  // === STAGE 1: Fresh franchise (Day 0) ===
  console.log('\n=== STAGE 1: Fresh Franchise (Day 0) ===');
  for (const route of FRANCHISE_ROUTES.slice(0, 15)) { // First 15 pages
    const result = await crawlPage(page, `${BASE}${route.path}`, `[Fresh] ${route.name}`);
    allResults.push(result);
    const icon = result.status === 'pass' ? '✓' : result.status === 'warning' ? '⚠' : '✗';
    console.log(`  ${icon} ${route.name}${result.issues.length > 0 ? ' — ' + result.issues.join(', ') : ''}`);
  }

  // === STAGE 2: Mid-season (Day 30) ===
  console.log('\n=== STAGE 2: Mid-Season (Day 30) ===');
  await simDays(page, 30);
  for (const route of FRANCHISE_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, `[Day30] ${route.name}`);
    allResults.push(result);
    const icon = result.status === 'pass' ? '✓' : result.status === 'warning' ? '⚠' : '✗';
    if (result.issues.length > 0) {
      console.log(`  ${icon} ${route.name} — ${result.issues.join(', ')}`);
    }
  }

  // === STAGE 3: Late season (Day 120) ===
  console.log('\n=== STAGE 3: Late Season (Day 120) ===');
  await simDays(page, 90);
  for (const route of FRANCHISE_ROUTES.slice(0, 20)) { // Key pages only
    const result = await crawlPage(page, `${BASE}${route.path}`, `[Day120] ${route.name}`);
    allResults.push(result);
    const icon = result.status === 'pass' ? '✓' : result.status === 'warning' ? '⚠' : '✗';
    if (result.issues.length > 0) {
      console.log(`  ${icon} ${route.name} — ${result.issues.join(', ')}`);
    }
  }

  // === STAGE 4: Offseason ===
  console.log('\n=== STAGE 4: Offseason ===');
  await simDays(page, 90); // Finish season
  // Try to get to offseason
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  try {
    await page.locator('main button:has-text("Go to Playoffs")').first().click({ timeout: 3000 });
    await page.waitForTimeout(2000);
    try { await page.locator('main button:has-text("Sim Wild")').first().click({ timeout: 3000 }); } catch {}
    await page.waitForTimeout(2000);
  } catch {}
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  try {
    await page.locator('main button:has-text("Offseason Hub")').first().click({ timeout: 3000 });
    await page.waitForTimeout(1500);
  } catch {}

  const offseasonRoutes = [
    { path: '/franchise/offseason', name: 'Offseason' },
    { path: '/franchise/free-agency', name: 'Free Agency' },
    { path: '/franchise/draft', name: 'Draft' },
    { path: '/dynasty/inbox', name: 'Hot Stove Inbox' },
    { path: '/dynasty/life-events', name: 'Life Events' },
    { path: '/dynasty/career-transition', name: 'Career Transition' },
    { path: '/dynasty/prestige', name: 'Legacy & Prestige' },
  ];
  for (const route of offseasonRoutes) {
    const result = await crawlPage(page, `${BASE}${route.path}`, `[Offseason] ${route.name}`);
    allResults.push(result);
    const icon = result.status === 'pass' ? '✓' : result.status === 'warning' ? '⚠' : '✗';
    console.log(`  ${icon} ${route.name}${result.issues.length > 0 ? ' — ' + result.issues.join(', ') : ''}`);
  }

  // === SUMMARY ===
  const fails = allResults.filter(r => r.status === 'fail');
  const warnings = allResults.filter(r => r.status === 'warning');
  const passes = allResults.filter(r => r.status === 'pass');

  console.log('\n========= CRAWLER SUMMARY =========');
  console.log(`Total pages crawled: ${allResults.length}`);
  console.log(`  ✓ Pass: ${passes.length}`);
  console.log(`  ⚠ Warning: ${warnings.length}`);
  console.log(`  ✗ Fail: ${fails.length}`);

  if (fails.length > 0) {
    console.log('\nFAILURES:');
    for (const f of fails) console.log(`  ✗ ${f.pageName}: ${f.issues.join(', ')}`);
  }
  if (warnings.length > 0) {
    console.log('\nWARNINGS:');
    for (const w of warnings) console.log(`  ⚠ ${w.pageName}: ${w.issues.join(', ')}`);
  }
  console.log('====================================\n');

  // Hard fail if any page crashes or shows NaN
  expect(fails.filter(f => f.issues.some(i => i.includes('NaN') || i.includes('blank') || i.includes('crash')))).toHaveLength(0);
});
