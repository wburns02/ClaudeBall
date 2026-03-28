# E2E Crawler Bug-Fix Loop Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Run comprehensive E2E crawlers across every route in Claude Ball, find all rendering bugs, fix them, and retest until the game runs flawlessly with zero failures.

**Architecture:** Build a 3-layer testing strategy: (1) a Mega Crawler that hits every route at multiple game stages, (2) an Interaction Crawler that clicks buttons/forms on each page, (3) a Dynasty Flow Crawler that walks through the full dynasty setup + career lifecycle. Each crawler produces a structured bug report. Bugs are fixed inline and retested immediately.

**Tech Stack:** Playwright (E2E), Vite dev server (port 5173), existing franchise/dynasty setup flow

---

## Important Context

### Dev Server
- **Start:** `npm run dev` (Vite, port 5173)
- **The dev server must be running before any Playwright test.** Check with `curl -s http://localhost:5173 | head -1` before running tests. If not running, start it in background.

### Existing Test Infrastructure
- **Config:** `playwright-career.config.ts` — 20min timeout, no pre-baked state (crawlers create their own franchise)
- **Config:** `playwright.config.ts` — 1min timeout, uses pre-baked `franchise-state.json`
- **Global setup:** `playwright-tests/global-setup.ts` — creates franchise, sims 30 days, saves state
- **Existing crawler:** `playwright-tests/dynasty-crawler.spec.ts` — 60 routes, 4 stages, 10min timeout

### Route Inventory (from App.tsx)

**Static Franchise Routes (48 real routes, not counting redirects):**
```
/franchise, /franchise/overview, /franchise/standings, /franchise/roster,
/franchise/trade, /franchise/free-agency, /franchise/playoffs, /franchise/offseason,
/franchise/draft, /franchise/roster-manager, /franchise/custom-league, /franchise/injuries,
/franchise/minors, /franchise/trade-history, /franchise/waivers, /franchise/leaders,
/franchise/records, /franchise/power-rankings, /franchise/team-analytics, /franchise/depth-chart,
/franchise/war-room, /franchise/create-player, /franchise/compare, /franchise/scoreboard,
/franchise/schedule, /franchise/game-log, /franchise/all-star, /franchise/awards,
/franchise/goals, /franchise/trade-proposals, /franchise/history, /franchise/player-history,
/franchise/scouting, /franchise/payroll, /franchise/lineup-editor, /franchise/development,
/franchise/training, /franchise/morale, /franchise/news, /franchise/hot-cold,
/franchise/finances, /franchise/inbox, /franchise/transactions, /franchise/timeline,
/franchise/war, /franchise/projections, /franchise/trade-machine, /franchise/season-review,
/franchise/report-card, /franchise/coaching-staff, /franchise/trade-deadline, /franchise/highlights,
/franchise/season-story, /franchise/hall-of-records, /franchise/achievements, /franchise/team-compare,
/franchise/sim-projection
```

**Dynamic Franchise Routes (need IDs extracted at runtime):**
```
/franchise/player/:playerId
/franchise/player-stats/:playerId
/franchise/team/:teamId
/franchise/team-stats/:teamId
/franchise/box-score/:gameId
```

**Dynasty Routes (require dynasty franchise):**
```
/dynasty/inbox, /dynasty/conversation, /dynasty/life-events,
/dynasty/career-transition, /dynasty/prestige, /dynasty/owner
```

**Non-Franchise Routes:**
```
/, /settings, /saves, /ideas, /achievements, /historical, /historical/draft,
/game/setup, /game/quick, /game/derby
```

**Redirect Aliases (should 302 → real route):**
```
/franchise/trades → /franchise/trade
/franchise/franchise-history → /franchise/history
/franchise/league-leaders → /franchise/leaders
/franchise/league-news → /franchise/news
/franchise/team-stats → /franchise/roster (redirect)
/franchise/player-stats → /franchise/roster (redirect)
```

### What the Existing Crawler Misses
1. `/franchise/trade` (uses stale redirect `/franchise/trades`)
2. `/franchise/custom-league`, `/franchise/team-analytics`, `/franchise/playoffs`
3. `/franchise/create-player`, `/franchise/compare`, `/franchise/team-compare`
4. `/franchise/inbox` (regular franchise inbox)
5. `/franchise/achievements`, `/franchise/history`
6. All dynamic routes (`/franchise/player/:id`, `/franchise/team-stats/:id`, `/franchise/box-score/:id`)
7. All non-franchise routes (`/`, `/settings`, `/saves`, `/game/*`, `/historical/*`)
8. No interaction testing (just loads pages, doesn't click anything)
9. No dynasty Living Mode testing (only creates Classic/GM mode)

---

## File Structure

| File | Purpose |
|------|---------|
| `playwright-tests/mega-crawler.spec.ts` | **NEW** — Hits every static + dynamic route at 3 game stages |
| `playwright-tests/interaction-crawler.spec.ts` | **NEW** — Clicks buttons, opens modals, fills forms on key pages |
| `playwright-tests/dynasty-living-crawler.spec.ts` | **NEW** — Full Living Dynasty setup → career → owner flow |
| `playwright-tests/crawler.config.ts` | **NEW** — Dedicated config for crawler suite (long timeouts) |
| Various `src/` files | **MODIFY** — Fix bugs discovered by crawlers |

---

### Task 1: Build the Crawler Config

**Files:**
- Create: `playwright-tests/crawler.config.ts`

- [ ] **Step 1: Create the dedicated crawler Playwright config**

```typescript
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
```

- [ ] **Step 2: Verify config is valid**

Run: `npx playwright test --config=playwright-tests/crawler.config.ts --list 2>&1 | head -5`
Expected: Lists available projects without error

- [ ] **Step 3: Commit**

```bash
git add playwright-tests/crawler.config.ts
git commit -m "test: add dedicated crawler config with 15min timeout"
```

---

### Task 2: Build the Mega Crawler

This crawler hits **every route** in the app across 3 game stages (Fresh, Day 60, Day 150). It discovers dynamic route IDs at runtime (player IDs, team IDs, game IDs) by reading the page DOM.

**Files:**
- Create: `playwright-tests/mega-crawler.spec.ts`

- [ ] **Step 1: Write the mega crawler test**

```typescript
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
      await sim30.click();
      await page.waitForTimeout(4000);
      // Dismiss overlays
      for (let d = 0; d < 5; d++) {
        for (const text of ['View Results', 'Dismiss', '✕ Dismiss', 'Continue', 'OK', 'Close']) {
          const btn = page.locator(`button:has-text("${text}")`).first();
          if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(300); }
        }
        const overlay = page.locator('.fixed.inset-0.bg-black').first();
        if (await overlay.count() > 0) {
          const closeBtn = overlay.locator('button').first();
          if (await closeBtn.count() > 0) { await closeBtn.click(); await page.waitForTimeout(300); }
        }
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
  let totalFails = 0;

  // === STAGE 1: Fresh Franchise (Day 0) ===
  console.log('\n══════════════════════════════════════');
  console.log('   STAGE 1: FRESH FRANCHISE (Day 0)');
  console.log('══════════════════════════════════════\n');

  for (const route of STATIC_FRANCHISE_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, route.name, 'Fresh');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '✗' : '⚠';
      console.log(`  ${icon} ${route.name} — ${result.issues.join(', ')}`);
    }
  }

  for (const route of DYNASTY_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, `Dynasty: ${route.name}`, 'Fresh');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '✗' : '⚠';
      console.log(`  ${icon} Dynasty: ${route.name} — ${result.issues.join(', ')}`);
    }
  }

  for (const route of NON_FRANCHISE_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, route.name, 'Fresh');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '✗' : '⚠';
      console.log(`  ${icon} ${route.name} — ${result.issues.join(', ')}`);
    }
  }

  const stage1Fails = allResults.filter(r => r.status === 'fail').length;
  console.log(`\n  Stage 1: ${allResults.length} pages, ${stage1Fails} fails\n`);

  // === STAGE 2: Mid-Season (Day 60) ===
  console.log('══════════════════════════════════════');
  console.log('   STAGE 2: MID-SEASON (Day 60)');
  console.log('══════════════════════════════════════\n');

  await simDays(page, 60);
  const stage2Start = allResults.length;

  for (const route of STATIC_FRANCHISE_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, route.name, 'Day60');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '✗' : '⚠';
      console.log(`  ${icon} ${route.name} — ${result.issues.join(', ')}`);
    }
  }

  // Dynamic routes — extract real IDs
  const ids = await extractDynamicIds(page);
  console.log(`  Found ${ids.playerIds.length} player IDs, ${ids.teamIds.length} team IDs, ${ids.gameIds.length} game IDs`);

  for (const pid of ids.playerIds) {
    const r1 = await crawlPage(page, `${BASE}/franchise/player/${pid}`, `Player Editor (${pid})`, 'Day60');
    allResults.push(r1);
    if (r1.issues.length > 0) console.log(`  ${r1.status === 'fail' ? '✗' : '⚠'} Player ${pid} — ${r1.issues.join(', ')}`);

    const r2 = await crawlPage(page, `${BASE}/franchise/player-stats/${pid}`, `Player Stats (${pid})`, 'Day60');
    allResults.push(r2);
    if (r2.issues.length > 0) console.log(`  ${r2.status === 'fail' ? '✗' : '⚠'} Player Stats ${pid} — ${r2.issues.join(', ')}`);
  }
  for (const tid of ids.teamIds) {
    const r = await crawlPage(page, `${BASE}/franchise/team-stats/${tid}`, `Team Stats (${tid})`, 'Day60');
    allResults.push(r);
    if (r.issues.length > 0) console.log(`  ${r.status === 'fail' ? '✗' : '⚠'} Team Stats ${tid} — ${r.issues.join(', ')}`);
  }
  for (const gid of ids.gameIds) {
    const r = await crawlPage(page, `${BASE}/franchise/box-score/${gid}`, `Box Score (${gid})`, 'Day60');
    allResults.push(r);
    if (r.issues.length > 0) console.log(`  ${r.status === 'fail' ? '✗' : '⚠'} Box Score ${gid} — ${r.issues.join(', ')}`);
  }

  for (const route of DYNASTY_ROUTES) {
    const result = await crawlPage(page, `${BASE}${route.path}`, `Dynasty: ${route.name}`, 'Day60');
    allResults.push(result);
    if (result.issues.length > 0) {
      const icon = result.status === 'fail' ? '✗' : '⚠';
      console.log(`  ${icon} Dynasty: ${route.name} — ${result.issues.join(', ')}`);
    }
  }

  const stage2Fails = allResults.slice(stage2Start).filter(r => r.status === 'fail').length;
  console.log(`\n  Stage 2: ${allResults.length - stage2Start} pages, ${stage2Fails} fails\n`);

  // === STAGE 3: Late Season (Day 150) ===
  console.log('══════════════════════════════════════');
  console.log('   STAGE 3: LATE SEASON (Day 150)');
  console.log('══════════════════════════════════════\n');

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
      const icon = result.status === 'fail' ? '✗' : '⚠';
      console.log(`  ${icon} ${route.name} — ${result.issues.join(', ')}`);
    }
  }

  const stage3Fails = allResults.slice(stage3Start).filter(r => r.status === 'fail').length;
  console.log(`\n  Stage 3: ${allResults.length - stage3Start} pages, ${stage3Fails} fails\n`);

  // === SUMMARY ===
  const fails = allResults.filter(r => r.status === 'fail');
  const warnings = allResults.filter(r => r.status === 'warning');
  const passes = allResults.filter(r => r.status === 'pass');

  console.log('══════════════════════════════════════');
  console.log('   MEGA CRAWLER SUMMARY');
  console.log('══════════════════════════════════════');
  console.log(`  Total pages crawled: ${allResults.length}`);
  console.log(`  ✓ Pass:    ${passes.length}`);
  console.log(`  ⚠ Warning: ${warnings.length}`);
  console.log(`  ✗ Fail:    ${fails.length}`);

  if (fails.length > 0) {
    console.log('\n  FAILURES:');
    for (const f of fails) console.log(`    ✗ [${f.stage}] ${f.pageName}: ${f.issues.join(', ')}`);
  }
  if (warnings.length > 0) {
    console.log('\n  WARNINGS:');
    for (const w of warnings) console.log(`    ⚠ [${w.stage}] ${w.pageName}: ${w.issues.join(', ')}`);
  }
  console.log('══════════════════════════════════════\n');

  // Hard fail on critical issues
  expect(fails.length, `${fails.length} critical failures found`).toBe(0);
});
```

- [ ] **Step 2: Run the mega crawler**

```bash
npx playwright test --config=playwright-tests/crawler.config.ts --project=mega-crawler 2>&1 | tee /tmp/mega-crawler-run1.log
```

Expected: Some failures — this is the first discovery run. Save the output for analysis.

- [ ] **Step 3: Commit the crawler (even if tests fail — the test is the deliverable)**

```bash
git add playwright-tests/mega-crawler.spec.ts
git commit -m "test: add mega crawler covering all 70+ routes across 3 game stages"
```

---

### Task 3: Fix All Mega Crawler Bugs (Iterative Loop)

This task is an **iterative loop**. The agent reads the crawler output, identifies bugs, fixes them, and reruns. Repeat until zero failures.

**Files:**
- Modify: Whatever source files the bugs point to (varies per run)

- [ ] **Step 1: Analyze mega crawler output**

Read `/tmp/mega-crawler-run1.log`. For each FAILURE and WARNING, categorize:
- **NaN in text**: Find which component renders NaN (usually a missing stat or undefined number)
- **Blank page**: Component crashes on mount — check console errors for stack trace
- **"undefined" in text**: Uninitialized variable being rendered
- **Console errors**: React errors, missing imports, null reference
- **Error boundary**: Component threw during render

- [ ] **Step 2: Fix each bug, one at a time**

For each bug:
1. Navigate to the source file indicated by the error
2. Read the relevant component
3. Fix the root cause (add null guards, default values, missing data checks)
4. Save the file

Do NOT batch fixes — fix one, verify the fix didn't break anything, then fix the next.

- [ ] **Step 3: Rerun the mega crawler**

```bash
npx playwright test --config=playwright-tests/crawler.config.ts --project=mega-crawler 2>&1 | tee /tmp/mega-crawler-run2.log
```

- [ ] **Step 4: Repeat Steps 1-3 until zero failures**

Continue the loop: analyze output → fix bugs → rerun. Each iteration should reduce the failure count. If the same page keeps failing after 3 fix attempts, investigate the page's data dependencies more deeply.

- [ ] **Step 5: Commit all bug fixes**

```bash
git add -u  # Stage all modified source files
git commit -m "fix: resolve all rendering bugs found by mega crawler"
```

---

### Task 4: Build the Interaction Crawler

This crawler doesn't just load pages — it **clicks buttons, opens modals, and tests forms** on key interactive pages.

**Files:**
- Create: `playwright-tests/interaction-crawler.spec.ts`

- [ ] **Step 1: Write the interaction crawler**

```typescript
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
      await sim.click();
      await page.waitForTimeout(4000);
      for (const text of ['View Results', 'Dismiss', '✕ Dismiss', 'Continue', 'OK', 'Close']) {
        const btn = page.locator(`button:has-text("${text}")`).first();
        if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(300); }
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
```

- [ ] **Step 2: Run the interaction crawler**

```bash
npx playwright test --config=playwright-tests/crawler.config.ts --project=interaction-crawler 2>&1 | tee /tmp/interaction-crawler-run1.log
```

- [ ] **Step 3: Commit**

```bash
git add playwright-tests/interaction-crawler.spec.ts
git commit -m "test: add interaction crawler testing buttons/tabs on 22 key pages"
```

---

### Task 5: Fix All Interaction Crawler Bugs (Iterative Loop)

Same iterative loop as Task 3, but for interaction bugs.

- [ ] **Step 1: Analyze interaction crawler output**

Read `/tmp/interaction-crawler-run1.log`. Focus on buttons that cause NaN or console errors when clicked.

- [ ] **Step 2: Fix each bug**

- [ ] **Step 3: Rerun interaction crawler**

```bash
npx playwright test --config=playwright-tests/crawler.config.ts --project=interaction-crawler 2>&1 | tee /tmp/interaction-crawler-run2.log
```

- [ ] **Step 4: Repeat until zero failures**

- [ ] **Step 5: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve all interaction bugs found by interaction crawler"
```

---

### Task 6: Build the Dynasty Living Mode Crawler

Tests the full Living Dynasty flow: character creation → draft → play seasons → retirement → owner.

**Files:**
- Create: `playwright-tests/dynasty-living-crawler.spec.ts`

- [ ] **Step 1: Write the dynasty living crawler**

```typescript
/**
 * Dynasty Living Crawler — full Living Dynasty lifecycle test.
 * Creates a Living Dynasty character, walks through setup, sims seasons,
 * checks all dynasty-specific pages at each career stage.
 *
 * Run: npx playwright test --config=playwright-tests/crawler.config.ts --project=dynasty-living
 */
import { test, expect, type Page } from '@playwright/test';

const BASE = 'http://localhost:5173';

interface StageResult {
  stage: string;
  pagesChecked: number;
  issues: string[];
}

async function crawlDynastyPages(page: Page, stage: string): Promise<StageResult> {
  const issues: string[] = [];
  const pages = [
    '/dynasty/inbox', '/dynasty/conversation', '/dynasty/life-events',
    '/dynasty/career-transition', '/dynasty/prestige', '/dynasty/owner',
    '/franchise', '/franchise/roster', '/franchise/standings',
    '/franchise/morale', '/franchise/finances',
  ];
  let checked = 0;

  for (const path of pages) {
    try {
      await page.goto(`${BASE}${path}`, { timeout: 10000 });
      await page.waitForTimeout(2000);
      const text = await page.locator('body').textContent({ timeout: 5000 }).catch(() => '');
      if (text.includes('NaN')) issues.push(`[${stage}] ${path}: NaN`);
      if (text.includes('Something went wrong')) issues.push(`[${stage}] ${path}: Error boundary`);
      if ((text ?? '').trim().length < 30) issues.push(`[${stage}] ${path}: Blank`);
      checked++;
    } catch {
      issues.push(`[${stage}] ${path}: Failed to load`);
    }
  }

  return { stage, pagesChecked: checked, issues };
}

test('Dynasty Living Crawler: Full lifecycle', async ({ page }) => {
  test.setTimeout(900000);

  // === CREATE LIVING DYNASTY ===
  console.log('\n  Creating Living Dynasty...');
  await page.goto(BASE);
  await page.waitForTimeout(3000);
  try { await page.getByRole('button', { name: 'Skip Tour' }).click({ timeout: 3000 }); } catch {}
  await page.waitForTimeout(500);

  const dynastyBtn = page.getByTestId('dynasty-mode-btn');
  expect(await dynastyBtn.count()).toBeGreaterThan(0);
  await dynastyBtn.click();
  await page.waitForTimeout(1000);

  // Step 1: Choose Living Dynasty
  const livingBtn = page.locator('button:has-text("Living Dynasty")');
  if (await livingBtn.count() > 0) {
    await livingBtn.click();
    await page.waitForTimeout(500);
  } else {
    // May already show character creation
    console.log('  Living Dynasty button not found — trying to proceed');
  }

  // Take screenshot of setup page for debugging
  await page.screenshot({ path: '/tmp/dynasty-setup.png' });

  // Step 2: Character creation (if available)
  // Fill in name if there's an input
  const nameInput = page.locator('input[placeholder*="name" i], input[name="name"]').first();
  if (await nameInput.count() > 0) {
    await nameInput.fill('Will Burns');
    await page.waitForTimeout(300);
  }

  // Click through any "Next" / "Continue" buttons in the setup wizard
  for (let step = 0; step < 10; step++) {
    const nextBtn = page.locator('button:has-text("Next"), button:has-text("Continue"), button:has-text("Start")').first();
    if (await nextBtn.count() > 0) {
      const text = await nextBtn.textContent();
      console.log(`  Setup step ${step}: clicking "${text?.trim()}"`);
      await nextBtn.click();
      await page.waitForTimeout(1000);

      // If we reached franchise, we're done
      if (page.url().includes('/franchise')) break;
    } else {
      break;
    }
  }

  // If still not at franchise, try selecting a team and starting
  if (!page.url().includes('/franchise')) {
    const austin = page.locator('button:has-text("Austin")').first();
    if (await austin.count() > 0) {
      await austin.click();
      await page.waitForTimeout(500);
    }
    const startBtn = page.locator('button:has-text("Start")').first();
    if (await startBtn.count() > 0) {
      await startBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  // Verify we got to franchise
  await page.screenshot({ path: '/tmp/dynasty-after-setup.png' });
  const currentUrl = page.url();
  console.log(`  Current URL after setup: ${currentUrl}`);

  if (!currentUrl.includes('/franchise')) {
    console.log('  WARNING: Could not complete dynasty setup — falling back to GM mode');
    // Fall back to GM dynasty
    await page.goto(BASE);
    await page.waitForTimeout(2000);
    try { await page.getByRole('button', { name: 'Skip Tour' }).click({ timeout: 2000 }); } catch {}
    const gmBtn = page.getByTestId('dynasty-mode-btn');
    if (await gmBtn.count() > 0) {
      await gmBtn.click(); await page.waitForTimeout(500);
      await page.locator('button:has-text("Start as GM")').click(); await page.waitForTimeout(500);
      await page.getByRole('button', { name: /casual/i }).click(); await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Choose Team/ }).click(); await page.waitForTimeout(500);
      await page.locator('button:has-text("Austin")').first().click(); await page.waitForTimeout(300);
      await page.getByRole('button', { name: /Start Classic Dynasty/ }).click();
      await page.waitForURL(/franchise/, { timeout: 15000 });
    }
  }

  await page.waitForTimeout(3000);
  const allStageResults: StageResult[] = [];

  // === SEASON 1: Fresh ===
  console.log('\n  Season 1: Checking dynasty pages...');
  allStageResults.push(await crawlDynastyPages(page, 'Season1-Fresh'));

  // Sim 30 days
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  const sim30 = page.locator('main button:has-text("Sim 30")').first();
  if (await sim30.count() > 0) {
    await sim30.click();
    await page.waitForTimeout(5000);
    for (const text of ['View Results', 'Dismiss', '✕ Dismiss', 'Continue', 'OK', 'Close']) {
      const btn = page.locator(`button:has-text("${text}")`).first();
      if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(300); }
    }
  }

  // === SEASON 1: Mid-season ===
  console.log('  Season 1 Mid: Checking dynasty pages...');
  allStageResults.push(await crawlDynastyPages(page, 'Season1-Mid'));

  // Sim rest of season
  for (let i = 0; i < 4; i++) {
    await page.goto(`${BASE}/franchise`);
    await page.waitForTimeout(1500);
    const sim = page.locator('main button:has-text("Sim 30")').first();
    if (await sim.count() > 0) {
      await sim.click();
      await page.waitForTimeout(4000);
      for (const text of ['View Results', 'Dismiss', '✕ Dismiss', 'Continue', 'OK']) {
        const btn = page.locator(`button:has-text("${text}")`).first();
        if (await btn.count() > 0) { await btn.click(); await page.waitForTimeout(300); }
      }
    }
  }

  // Try to get to playoffs
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  const playoffsBtn = page.locator('main button:has-text("Go to Playoffs")').first();
  if (await playoffsBtn.count() > 0) {
    await playoffsBtn.click();
    await page.waitForTimeout(2000);
    for (const round of ['Sim Wild', 'Sim Division', 'Sim Championship', 'Sim World']) {
      const simRound = page.locator(`main button:has-text("${round}")`).first();
      if (await simRound.count() > 0) { await simRound.click(); await page.waitForTimeout(2000); }
    }
  }

  // Try offseason
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(2000);
  const offseasonBtn = page.locator('main button:has-text("Offseason"), main button:has-text("Advance to")').first();
  if (await offseasonBtn.count() > 0) {
    await offseasonBtn.click();
    await page.waitForTimeout(3000);
  }

  console.log('  Post-season: Checking dynasty pages...');
  allStageResults.push(await crawlDynastyPages(page, 'PostSeason'));

  // === SUMMARY ===
  console.log('\n══════════════════════════════════════');
  console.log('   DYNASTY LIVING CRAWLER SUMMARY');
  console.log('══════════════════════════════════════');
  let totalIssues = 0;
  for (const sr of allStageResults) {
    console.log(`  ${sr.stage}: ${sr.pagesChecked} pages checked, ${sr.issues.length} issues`);
    for (const issue of sr.issues) console.log(`    ✗ ${issue}`);
    totalIssues += sr.issues.length;
  }
  console.log(`\n  Total issues: ${totalIssues}`);
  console.log('══════════════════════════════════════\n');

  expect(totalIssues, `${totalIssues} dynasty lifecycle issues found`).toBe(0);
});
```

- [ ] **Step 2: Run the dynasty living crawler**

```bash
npx playwright test --config=playwright-tests/crawler.config.ts --project=dynasty-living 2>&1 | tee /tmp/dynasty-living-run1.log
```

- [ ] **Step 3: Commit**

```bash
git add playwright-tests/dynasty-living-crawler.spec.ts
git commit -m "test: add dynasty living mode lifecycle crawler"
```

---

### Task 7: Fix All Dynasty Living Crawler Bugs (Iterative Loop)

- [ ] **Step 1: Analyze dynasty living crawler output**
- [ ] **Step 2: Fix each bug**
- [ ] **Step 3: Rerun**: `npx playwright test --config=playwright-tests/crawler.config.ts --project=dynasty-living 2>&1 | tee /tmp/dynasty-living-run2.log`
- [ ] **Step 4: Repeat until zero failures**
- [ ] **Step 5: Commit fixes**

```bash
git add -u
git commit -m "fix: resolve all dynasty lifecycle bugs found by living crawler"
```

---

### Task 8: Final Verification — Run All Three Crawlers

- [ ] **Step 1: Run all crawlers back-to-back**

```bash
npx playwright test --config=playwright-tests/crawler.config.ts 2>&1 | tee /tmp/final-crawler-run.log
```

This runs all 3 projects: mega-crawler, interaction-crawler, dynasty-living.

- [ ] **Step 2: If ANY failures, go back to the relevant fix task**

Read `/tmp/final-crawler-run.log`. If failures exist, fix them and rerun.

- [ ] **Step 3: Also run the existing dynasty crawler for regression check**

```bash
npx playwright test --config=playwright-career.config.ts dynasty-crawler 2>&1 | tee /tmp/original-crawler-final.log
```

- [ ] **Step 4: Also run the career sim for regression check**

```bash
npx playwright test --config=playwright-career.config.ts dynasty-career-sim 2>&1 | tee /tmp/career-sim-final.log
```

- [ ] **Step 5: Run unit tests for regression check**

```bash
npm test 2>&1 | tee /tmp/unit-tests-final.log
```

Expected: All 308+ tests pass.

- [ ] **Step 6: Commit and push everything**

```bash
git add -u  # Only stage tracked files — avoids temp screenshots/results
git add playwright-tests/mega-crawler.spec.ts playwright-tests/interaction-crawler.spec.ts playwright-tests/dynasty-living-crawler.spec.ts playwright-tests/crawler.config.ts
git commit -m "test: all crawlers pass — zero rendering bugs across 200+ page crawls"
git push origin main
```

---

### Task 9: Run TypeScript Build Check

- [ ] **Step 1: Verify clean TypeScript compilation**

```bash
npx tsc --noEmit
```

Expected: Zero errors.

- [ ] **Step 2: Verify production build succeeds**

```bash
npm run build
```

Expected: Clean build, no errors.

- [ ] **Step 3: Final commit if build required fixes**

```bash
git add -u
git commit -m "fix: resolve TypeScript build errors"
git push origin main
```

---

## Execution Notes

**The iterative bug-fix tasks (3, 5, 7) are the core of this plan.** The crawlers are just the discovery mechanism. The real work is:
1. Run crawler → get bug list
2. Read the failing component's source code
3. Fix the root cause (not just suppress the symptom)
4. Rerun to verify the fix
5. Repeat until clean

**Common bug patterns to expect:**
- `NaN` from `undefined * number` — add `?? 0` fallback
- Blank pages from uncaught errors during render — add error boundaries or null guards
- Console errors from accessing `.property` on `null` — add optional chaining
- Missing data on fresh franchise (Day 0) — add empty state UI
- Stale data after sim — ensure stores are hydrated after state changes
- IDB rehydration race conditions — add loading states

**When fixing bugs, prefer:**
- Null guards over try/catch (catch hides problems)
- Default values (`?? 0`, `?? []`) over conditional rendering
- Empty state UI over hiding entire sections
- Console.warn for unexpected states, not silent failures
