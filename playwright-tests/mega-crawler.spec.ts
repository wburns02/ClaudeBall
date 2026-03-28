/**
 * Mega Crawler — hits every route in Claude Ball across 3 game stages.
 * Extracts dynamic IDs at runtime for player/team/box-score pages.
 * Reports: NaN, undefined, null, blank pages, console errors, broken images.
 *
 * Run: npx playwright test --config=playwright-tests/crawler.config.ts --project=mega-crawler
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

interface CrawlResult {
  url: string;
  pageName: string;
  stage: string;
  status: 'pass' | 'warning' | 'fail';
  issues: string[];
  loadTimeMs: number;
}

// ── Every static franchise route (from App.tsx, no redirects) ──
const STATIC_FRANCHISE_ROUTES = [
  '/franchise', '/franchise/overview', '/franchise/standings', '/franchise/roster',
  '/franchise/trade', '/franchise/free-agency', '/franchise/playoffs', '/franchise/offseason',
  '/franchise/draft', '/franchise/roster-manager', '/franchise/custom-league', '/franchise/injuries',
  '/franchise/minors', '/franchise/trade-history', '/franchise/waivers', '/franchise/leaders',
  '/franchise/records', '/franchise/power-rankings', '/franchise/team-analytics', '/franchise/depth-chart',
  '/franchise/war-room', '/franchise/create-player', '/franchise/compare', '/franchise/scoreboard',
  '/franchise/schedule', '/franchise/game-log', '/franchise/all-star', '/franchise/awards',
  '/franchise/goals', '/franchise/trade-proposals', '/franchise/history', '/franchise/player-history',
  '/franchise/scouting', '/franchise/payroll', '/franchise/lineup-editor', '/franchise/development',
  '/franchise/training', '/franchise/morale', '/franchise/news', '/franchise/hot-cold',
  '/franchise/finances', '/franchise/inbox', '/franchise/transactions', '/franchise/timeline',
  '/franchise/war', '/franchise/projections', '/franchise/trade-machine', '/franchise/season-review',
  '/franchise/report-card', '/franchise/coaching-staff', '/franchise/trade-deadline',
  '/franchise/highlights', '/franchise/season-story', '/franchise/hall-of-records',
  '/franchise/achievements', '/franchise/team-compare', '/franchise/sim-projection',
].map(path => ({ path, name: path.replace('/franchise/', '').replace('/', '') || 'Dashboard' }));

const DYNASTY_ROUTES = [
  '/dynasty/inbox', '/dynasty/conversation', '/dynasty/life-events',
  '/dynasty/career-transition', '/dynasty/prestige', '/dynasty/owner',
].map(path => ({ path, name: path.replace('/dynasty/', '') }));

const NON_FRANCHISE_ROUTES = [
  { path: '/', name: 'Main Menu' },
  { path: '/settings', name: 'Settings' },
  { path: '/saves', name: 'Save/Load' },
  { path: '/achievements', name: 'Achievements (global)' },
  { path: '/historical', name: 'Historical' },
  { path: '/historical/draft', name: 'Fantasy Draft' },
  { path: '/ideas', name: 'Ideas' },
  { path: '/game/setup', name: 'Exhibition Setup' },
  { path: '/game/quick', name: 'Quick Play' },
  { path: '/game/derby', name: 'Home Run Derby' },
  { path: '/career', name: 'Career Dashboard' },
  { path: '/career/new', name: 'Create Player (Career)' },
  { path: '/career/stats', name: 'Career Stats' },
  { path: '/career/training', name: 'Career Training' },
  { path: '/career/contract', name: 'Career Contract' },
  { path: '/career/hof', name: 'Career HoF' },
];

async function crawlPage(page: Page, url: string, pageName: string, stage: string): Promise<CrawlResult> {
  const issues: string[] = [];
  const consoleErrors: string[] = [];
  const start = Date.now();

  const errorHandler = (msg: any) => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('React DevTools') && !text.includes('favicon') && !text.includes('404')) {
        consoleErrors.push(text.slice(0, 150));
      }
    }
  };
  page.on('console', errorHandler);

  try {
    await page.goto(url, { timeout: 15000 });
    await page.waitForTimeout(3000);
  } catch {
    issues.push('Page failed to load within 15s');
    page.off('console', errorHandler);
    return { url, pageName, stage, status: 'fail', issues, loadTimeMs: Date.now() - start };
  }

  const loadTimeMs = Date.now() - start;

  // Check for blank page — handle Suspense/lazy-load fallback
  let bodyText = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
  if ((bodyText ?? '').includes('Loading')) {
    await page.waitForTimeout(5000); // Extra time for lazy chunk to resolve
    bodyText = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
  }
  if ((bodyText ?? '').trim().length < 30) {
    await page.waitForTimeout(3000); // Retry for IDB rehydration
    const retry = await page.locator('body').textContent({ timeout: 3000 }).catch(() => '');
    if ((retry ?? '').trim().length < 30) {
      issues.push('Blank page (< 30 chars after 8s+)');
    }
  }

  // Check for rendering errors in text
  const pageText = await page.locator('body').textContent().catch(() => '');
  if (pageText.includes('NaN')) issues.push('NaN found in page text');
  if (pageText.match(/\bundefined\b/) && !pageText.includes('undefined behavior')) {
    issues.push('"undefined" found in page text');
  }
  const nullCount = (pageText.match(/\bnull\b/g) ?? []).length;
  if (nullCount > 2) issues.push(`"null" appears ${nullCount} times`);

  // React error boundary
  if (pageText.includes('Something went wrong') || pageText.includes('Error boundary')) {
    issues.push('React error boundary triggered');
  }

  // Console errors
  if (consoleErrors.length > 0) {
    issues.push(`${consoleErrors.length} console error(s): ${consoleErrors[0]}`);
  }

  // Broken images
  const brokenImgs = await page.evaluate(() => {
    let broken = 0;
    for (const img of document.querySelectorAll('img')) {
      if (!img.complete || img.naturalWidth === 0) broken++;
    }
    return broken;
  });
  if (brokenImgs > 0) issues.push(`${brokenImgs} broken image(s)`);

  page.off('console', errorHandler);
  const isCritical = issues.some(i => /NaN|blank|error boundary|crash/i.test(i));
  return { url, pageName, stage, status: issues.length === 0 ? 'pass' : isCritical ? 'fail' : 'warning', issues, loadTimeMs };
}

async function simDays(page: Page, days: number) {
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  const batches = Math.ceil(days / 30);
  for (let i = 0; i < batches; i++) {
    const sim30 = page.locator('main button:has-text("Sim 30")').first();
    if (await sim30.count() > 0) {
      await sim30.click({ force: true });
      await page.waitForTimeout(4000);
      // Dismiss ALL overlays via DOM — avoids Playwright interception issues
      for (let d = 0; d < 5; d++) {
        await page.evaluate(() => {
          const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
          const dismissTexts = ['View Results', 'Dismiss', '✕ Dismiss', 'Continue', 'OK', 'Close'];
          for (const text of dismissTexts) {
            const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
            if (btn) { (btn as HTMLButtonElement).click(); }
          }
          // Also dismiss fixed overlays
          const overlay = document.querySelector('.fixed.inset-0');
          if (overlay) {
            const btn = overlay.querySelector('button');
            if (btn) (btn as HTMLButtonElement).click();
          }
        });
        await page.waitForTimeout(500);
      }
    }
    await page.waitForTimeout(500);
  }
}

/** Extract real IDs from the roster page for dynamic route testing */
async function extractDynamicIds(page: Page): Promise<{ playerIds: string[]; teamIds: string[]; gameIds: string[] }> {
  await page.goto(`${BASE}/franchise/roster`);
  await page.waitForTimeout(3000);

  // Player IDs: look for links to /franchise/player/ or /franchise/player-stats/
  const playerIds = await page.evaluate(() => {
    const ids: string[] = [];
    for (const a of document.querySelectorAll('a[href*="/franchise/player"]')) {
      const match = a.getAttribute('href')?.match(/\/franchise\/player(?:-stats)?\/([^/]+)/);
      if (match && match[1]) ids.push(match[1]);
    }
    // Also check buttons with data-player-id or onclick
    for (const btn of document.querySelectorAll('[data-player-id]')) {
      const id = btn.getAttribute('data-player-id');
      if (id) ids.push(id);
    }
    return [...new Set(ids)].slice(0, 3);
  });

  // Team IDs: from standings page
  await page.goto(`${BASE}/franchise/standings`);
  await page.waitForTimeout(2000);
  const teamIds = await page.evaluate(() => {
    const ids: string[] = [];
    for (const a of document.querySelectorAll('a[href*="/franchise/team"]')) {
      const match = a.getAttribute('href')?.match(/\/franchise\/team(?:-stats)?\/([^/]+)/);
      if (match && match[1]) ids.push(match[1]);
    }
    return [...new Set(ids)].slice(0, 3);
  });

  // Game IDs: from game log or scoreboard
  await page.goto(`${BASE}/franchise/game-log`);
  await page.waitForTimeout(2000);
  const gameIds = await page.evaluate(() => {
    const ids: string[] = [];
    for (const a of document.querySelectorAll('a[href*="/franchise/box-score"]')) {
      const match = a.getAttribute('href')?.match(/\/franchise\/box-score\/([^/]+)/);
      if (match && match[1]) ids.push(match[1]);
    }
    return [...new Set(ids)].slice(0, 3);
  });

  return { playerIds, teamIds, gameIds };
}

test('Mega Crawler: Full route audit across 3 game stages', async ({ page }) => {
  test.setTimeout(900000); // 15 min

  // === SETUP: Create Dynasty franchise ===
  await page.goto(BASE);
  await page.waitForTimeout(3000);
  try { await page.getByRole('button', { name: 'Skip Tour' }).click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(500);

  // Try Dynasty mode first, fall back to New Franchise
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

  const allResults: CrawlResult[] = [];

  // === STAGE 1: Fresh Franchise (Day 0) ===
  console.log('\n\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('   STAGE 1: FRESH FRANCHISE (Day 0)');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  for (const route of STATIC_FRANCHISE_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, route.name, 'Fresh');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '\u2717' : '\u26a0';
      console.log(`  ${icon} ${route.name} \u2014 ${result.issues.join(', ')}`);
    }
  }

  for (const route of DYNASTY_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, `Dynasty: ${route.name}`, 'Fresh');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '\u2717' : '\u26a0';
      console.log(`  ${icon} Dynasty: ${route.name} \u2014 ${result.issues.join(', ')}`);
    }
  }

  for (const route of NON_FRANCHISE_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, route.name, 'Fresh');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '\u2717' : '\u26a0';
      console.log(`  ${icon} ${route.name} \u2014 ${result.issues.join(', ')}`);
    }
  }

  const stage1Fails = allResults.filter(r => r.status === 'fail').length;
  console.log(`\n  Stage 1: ${allResults.length} pages, ${stage1Fails} fails\n`);

  // === STAGE 2: Mid-Season (Day 60) ===
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('   STAGE 2: MID-SEASON (Day 60)');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  await simDays(page, 60);
  const stage2Start = allResults.length;

  for (const route of STATIC_FRANCHISE_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, route.name, 'Day60');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '\u2717' : '\u26a0';
      console.log(`  ${icon} ${route.name} \u2014 ${result.issues.join(', ')}`);
    }
  }

  // Dynamic routes — extract real IDs
  const ids = await extractDynamicIds(page);
  console.log(`  Found ${ids.playerIds.length} player IDs, ${ids.teamIds.length} team IDs, ${ids.gameIds.length} game IDs`);

  for (const pid of ids.playerIds) {
    const r1 = await crawlPage(page, `${BASE}/franchise/player/${pid}`, `Player Editor (${pid})`, 'Day60');
    allResults.push(r1);
    if (r1.issues.length > 0) console.log(`  ${r1.status === 'fail' ? '\u2717' : '\u26a0'} Player ${pid} \u2014 ${r1.issues.join(', ')}`);

    const r2 = await crawlPage(page, `${BASE}/franchise/player-stats/${pid}`, `Player Stats (${pid})`, 'Day60');
    allResults.push(r2);
    if (r2.issues.length > 0) console.log(`  ${r2.status === 'fail' ? '\u2717' : '\u26a0'} Player Stats ${pid} \u2014 ${r2.issues.join(', ')}`);
  }
  for (const tid of ids.teamIds) {
    const r = await crawlPage(page, `${BASE}/franchise/team-stats/${tid}`, `Team Stats (${tid})`, 'Day60');
    allResults.push(r);
    if (r.issues.length > 0) console.log(`  ${r.status === 'fail' ? '\u2717' : '\u26a0'} Team Stats ${tid} \u2014 ${r.issues.join(', ')}`);
  }
  for (const gid of ids.gameIds) {
    const r = await crawlPage(page, `${BASE}/franchise/box-score/${gid}`, `Box Score (${gid})`, 'Day60');
    allResults.push(r);
    if (r.issues.length > 0) console.log(`  ${r.status === 'fail' ? '\u2717' : '\u26a0'} Box Score ${gid} \u2014 ${r.issues.join(', ')}`);
  }

  for (const route of DYNASTY_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, `Dynasty: ${route.name}`, 'Day60');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '\u2717' : '\u26a0';
      console.log(`  ${icon} Dynasty: ${route.name} \u2014 ${result.issues.join(', ')}`);
    }
  }

  const stage2Fails = allResults.slice(stage2Start).filter(r => r.status === 'fail').length;
  console.log(`\n  Stage 2: ${allResults.length - stage2Start} pages, ${stage2Fails} fails\n`);

  // === STAGE 3: Late Season (Day 150) ===
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('   STAGE 3: LATE SEASON (Day 150)');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  await simDays(page, 90);
  const stage3Start = allResults.length;

  // Key pages only at this stage — the most likely to show bugs with real data
  const LATE_SEASON_ROUTES = STATIC_FRANCHISE_ROUTES.filter(r =>
    ['Dashboard', 'standings', 'roster', 'leaders', 'records', 'power-rankings',
     'war', 'projections', 'awards', 'hot-cold', 'morale', 'timeline',
     'season-story', 'highlights', 'team-analytics', 'report-card',
     'schedule', 'game-log', 'scoreboard', 'depth-chart', 'player-history',
     'hall-of-records', 'achievements', 'season-review'].includes(r.name)
  );

  for (const route of LATE_SEASON_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, route.name, 'Day150');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '\u2717' : '\u26a0';
      console.log(`  ${icon} ${route.name} \u2014 ${result.issues.join(', ')}`);
    }
  }

  const stage3Fails = allResults.slice(stage3Start).filter(r => r.status === 'fail').length;
  console.log(`\n  Stage 3: ${allResults.length - stage3Start} pages, ${stage3Fails} fails\n`);

  // === SUMMARY ===
  const fails = allResults.filter(r => r.status === 'fail');
  const warnings = allResults.filter(r => r.status === 'warning');
  const passes = allResults.filter(r => r.status === 'pass');

  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log('   MEGA CRAWLER SUMMARY');
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550');
  console.log(`  Total pages crawled: ${allResults.length}`);
  console.log(`  \u2713 Pass:    ${passes.length}`);
  console.log(`  \u26a0 Warning: ${warnings.length}`);
  console.log(`  \u2717 Fail:    ${fails.length}`);

  if (fails.length > 0) {
    console.log('\n  FAILURES:');
    for (const f of fails) console.log(`    \u2717 [${f.stage}] ${f.pageName}: ${f.issues.join(', ')}`);
  }
  if (warnings.length > 0) {
    console.log('\n  WARNINGS:');
    for (const w of warnings) console.log(`    \u26a0 [${w.stage}] ${w.pageName}: ${w.issues.join(', ')}`);
  }
  console.log('\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\n');

  // Hard fail on critical issues
  expect(fails.length, `${fails.length} critical failures found`).toBe(0);
});
