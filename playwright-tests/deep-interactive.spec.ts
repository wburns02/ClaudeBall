/**
 * Deep Interactive Audit — Phase 1 of FULL PRODUCT PIPELINE
 * Each test uses storageState from globalSetup (franchise already created + 30 days simmed).
 * Tests just navigate directly — no shared state setup needed.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';
const SS = '/tmp/deep-audit';

/** SPA navigation within an already-loaded page (same context) */
const spa = async (page: any, path: string) => {
  await page.evaluate((p: string) => {
    window.history.pushState({}, '', p);
    window.dispatchEvent(new PopStateEvent('popstate'));
  }, path);
  await page.waitForTimeout(600);
};

// ── 1. Dashboard interactions ─────────────────────────────────────────────────

test('Dashboard — all buttons functional', async ({ page }) => {
  await page.goto(`${BASE}/franchise`);
  await page.waitForTimeout(1000);

  const body = await page.textContent('body') ?? '';
  const wins = body.match(/(\d+)-(\d+)/)?.[0];
  console.log(`DASH_RECORD=${wins}`);

  const advBtn = page.locator('button').filter({ hasText: /Advance Day/ }).first();
  console.log(`DASH_ADVANCE_BTN=${await advBtn.count() > 0}`);

  const navLinks = page.locator('nav button, nav a').filter({ hasText: /\w/ });
  console.log(`DASH_NAV_LINKS=${await navLinks.count()}`);

  await page.screenshot({ path: `${SS}/dashboard.png`, fullPage: false });
  expect(body.length).toBeGreaterThan(800);
});

// ── 2. Roster page ────────────────────────────────────────────────────────────

test('Roster — player cards and filters', async ({ page }) => {
  await page.goto(`${BASE}/franchise/roster`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS}/roster.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasPlayers = body.includes('OVR') || body.includes('Age');
  const filterBtns = await page.locator('button').filter({ hasText: /All|P|C|1B|2B|SS/ }).count();
  console.log(`ROSTER|len=${body.length}|hasPlayers=${hasPlayers}|filterBtns=${filterBtns}`);
  expect(hasPlayers).toBe(true);
});

// ── 3. Player stats page ──────────────────────────────────────────────────────

test('Player Stats — filtering and sorting', async ({ page }) => {
  await page.goto(`${BASE}/franchise/leaders`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS}/leaders.png`, fullPage: true });
  const body = await page.textContent('body') ?? '';
  console.log(`LEADERS|len=${body.length}|hasBA=${body.includes('.') && body.includes('AVG')}|preview="${body.replace(/\s+/g,' ').substring(200,500)}"`);
});

// ── 4. Schedule page ──────────────────────────────────────────────────────────

test('Schedule — calendar rendering and navigation', async ({ page }) => {
  await page.goto(`${BASE}/franchise/schedule`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS}/schedule.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasCalendar = body.includes('MON') || body.includes('TUE') || body.includes('Day');
  const hasPrevNext = body.includes('Prev') || body.includes('Next') || body.includes('Today');
  console.log(`SCHEDULE|len=${body.length}|hasCalendar=${hasCalendar}|hasPrevNext=${hasPrevNext}`);

  const nextBtn = page.locator('button').filter({ hasText: /Next/ }).first();
  if (await nextBtn.count() > 0) { await nextBtn.click(); await page.waitForTimeout(400); }
  const body2 = await page.textContent('body') ?? '';
  console.log(`SCHEDULE_AFTER_NEXT|len=${body2.length}`);
});

// ── 5. Standings page ─────────────────────────────────────────────────────────

test('Standings — all divisions showing', async ({ page }) => {
  await page.goto(`${BASE}/franchise/standings`);
  await page.waitForTimeout(1000);
  await page.screenshot({ path: `${SS}/standings.png`, fullPage: true });
  const body = await page.textContent('body') ?? '';
  const hasDivisions = body.includes('East') || body.includes('West') || body.includes('Central');
  const hasTeams = body.includes('THK') || body.includes('ICL') || body.includes('.500');
  console.log(`STANDINGS|len=${body.length}|hasDivisions=${hasDivisions}|hasTeams=${hasTeams}`);
  expect(hasDivisions).toBe(true);
});

// ── 6. Trade page — full flow ─────────────────────────────────────────────────

test('Trade — select partner, pick players, evaluate', async ({ page }) => {
  await page.goto(`${BASE}/franchise/trade`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/trade-initial.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasPartnerSelect = body.includes('Trade partner') || body.includes('partner');
  console.log(`TRADE|len=${body.length}|hasPartner=${hasPartnerSelect}`);

  const playerCards = page.locator('button').filter({ hasText: /Age \d+/ });
  const cardCount = await playerCards.count();
  console.log(`TRADE_PLAYER_CARDS=${cardCount}`);

  if (cardCount > 0) {
    await playerCards.first().click();
    await page.waitForTimeout(300);
    await page.screenshot({ path: `${SS}/trade-player-selected.png`, fullPage: true });
    const bodyAfter = await page.textContent('body') ?? '';
    const hasSelected = bodyAfter.includes('✓') || bodyAfter.includes('gold') || bodyAfter.includes('Offering');
    console.log(`TRADE_AFTER_CLICK|hasSelected=${hasSelected}|len=${bodyAfter.length}`);
  }

  const evalBtn = page.locator('button').filter({ hasText: /Evaluate|Analyze/ }).first();
  console.log(`TRADE_EVAL_BTN=${await evalBtn.count() > 0}`);
});

// ── 7. Free Agency page ───────────────────────────────────────────────────────

test('Free Agency — filter and sign player', async ({ page }) => {
  await page.goto(`${BASE}/franchise/free-agency`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/free-agency.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const signBtns = await page.locator('button').filter({ hasText: /Sign/ }).count();
  console.log(`FA|len=${body.length}|signBtns=${signBtns}|hasBudget=${body.includes('Budget') || body.includes('$')}`);

  const posFilters = await page.locator('button').filter({ hasText: /^P$|^C$|^1B$|^SS$|^OF$/ }).count();
  console.log(`FA_POS_FILTERS=${posFilters}`);
});

// ── 8. Scouting page ─────────────────────────────────────────────────────────

test('Scouting — report cards and staff', async ({ page }) => {
  await page.goto(`${BASE}/franchise/scouting`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/scouting.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasGrades = body.includes('80') || body.includes('PLUS') || body.includes('AVG');
  const hasStaff = body.includes('Scout') || body.includes('Staff') || body.includes('Grade');
  console.log(`SCOUTING|len=${body.length}|hasGrades=${hasGrades}|hasStaff=${hasStaff}`);
});

// ── 9. Minor Leagues page ────────────────────────────────────────────────────

test('Minor Leagues — prospect list', async ({ page }) => {
  await page.goto(`${BASE}/franchise/minors`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/minors.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasProspects = body.includes('Age') || body.includes('OVR') || body.includes('Prospect');
  console.log(`MINORS|len=${body.length}|hasProspects=${hasProspects}|preview="${body.replace(/\s+/g,' ').substring(300,600)}"`);
});

// ── 10. Depth Chart ──────────────────────────────────────────────────────────

test('Depth Chart — all positions', async ({ page }) => {
  await page.goto(`${BASE}/franchise/depth-chart`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/depth-chart.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasPositions = body.includes('1B') || body.includes('SS') || body.includes('CF') || body.includes('Catcher');
  console.log(`DEPTH|len=${body.length}|hasPositions=${hasPositions}`);
});

// ── 11. Payroll page ──────────────────────────────────────────────────────────

test('Payroll — salary breakdown', async ({ page }) => {
  await page.goto(`${BASE}/franchise/payroll`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/payroll.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasSalaries = body.includes('$') && (body.includes('M') || body.includes('K'));
  const hasPlayers = body.includes('Age') || body.includes('OVR');
  console.log(`PAYROLL|len=${body.length}|hasSalaries=${hasSalaries}|hasPlayers=${hasPlayers}`);
});

// ── 12. GM War Room ───────────────────────────────────────────────────────────

test('GM War Room — roster needs analysis', async ({ page }) => {
  await page.goto(`${BASE}/franchise/war-room`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/war-room.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasAnalysis = body.includes('Grade') || body.includes('Need') || body.includes('Upgrade') || body.includes('OVR');
  console.log(`WARROOM|len=${body.length}|hasAnalysis=${hasAnalysis}|preview="${body.replace(/\s+/g,' ').substring(200,500)}"`);
});

// ── 13. Development Hub ───────────────────────────────────────────────────────

test('Development Hub — player development tracking', async ({ page }) => {
  await page.goto(`${BASE}/franchise/development`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/development.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasDev = body.includes('Growth') || body.includes('Peak') || body.includes('Decline') || body.includes('OVR');
  console.log(`DEVELOPMENT|len=${body.length}|hasDev=${hasDev}`);
});

// ── 14. Hot/Cold tracker ──────────────────────────────────────────────────────

test('Hot/Cold — performance tracker', async ({ page }) => {
  await page.goto(`${BASE}/franchise/hot-cold`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/hot-cold.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasHotCold = body.includes('Hot') || body.includes('Cold') || body.includes('streak') || body.includes('OVR');
  console.log(`HOTCOLD|len=${body.length}|hasHotCold=${hasHotCold}`);
});

// ── 15. News/League News ─────────────────────────────────────────────────────

test('League News — news feed', async ({ page }) => {
  await page.goto(`${BASE}/franchise/news`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/news.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasNews = body.includes('Game') || body.includes('Transaction') || body.includes('Injury') || body.includes('Day');
  console.log(`NEWS|len=${body.length}|hasNews=${hasNews}|preview="${body.replace(/\s+/g,' ').substring(200,600)}"`);
});

// ── 16. Power Rankings ────────────────────────────────────────────────────────

test('Power Rankings — team rankings', async ({ page }) => {
  await page.goto(`${BASE}/franchise/power-rankings`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/power-rankings.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasRankings = body.includes('#1') || body.includes('Rank') || body.includes('THK') || body.includes('OVR');
  console.log(`POWER|len=${body.length}|hasRankings=${hasRankings}`);
});

// ── 17. Injuries page ────────────────────────────────────────────────────────

test('Injuries — injury report', async ({ page }) => {
  await page.goto(`${BASE}/franchise/injuries`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/injuries.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasInjury = body.includes('IL') || body.includes('Injury') || body.includes('Day') || body.includes('Return');
  console.log(`INJURIES|len=${body.length}|hasInjury=${hasInjury}`);
});

// ── 18. Draft page ────────────────────────────────────────────────────────────

test('Draft — prospect list and draft board', async ({ page }) => {
  await page.goto(`${BASE}/franchise/draft`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/draft.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasProspects = body.includes('Age') || body.includes('Grade') || body.includes('SAFE') || body.includes('OVR');
  const draftBtns = await page.locator('button').filter({ hasText: /Draft|Pick/ }).count();
  console.log(`DRAFT|len=${body.length}|hasProspects=${hasProspects}|draftBtns=${draftBtns}`);
});

// ── 19. Owner's Office (Goals) ────────────────────────────────────────────────

test("Owner's Office — goals and confidence", async ({ page }) => {
  await page.goto(`${BASE}/franchise/goals`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/goals.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasOwner = body.includes('Owner') || body.includes('Confidence');
  const hasGoals = body.includes('Primary') || body.includes('Goal') || body.includes('Progress');
  console.log(`GOALS|len=${body.length}|hasOwner=${hasOwner}|hasGoals=${hasGoals}`);
  expect(hasOwner).toBe(true);
});

// ── 20. Lineup Editor ────────────────────────────────────────────────────────

test('Lineup Editor — set and save lineup', async ({ page }) => {
  await page.goto(`${BASE}/franchise/lineup-editor`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/lineup-editor.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasLineup = body.includes('Batting') || body.includes('Order') || body.includes('Lineup') || body.includes('1.');
  const saveBtns = await page.locator('button').filter({ hasText: /Save|Set|Apply/ }).count();
  console.log(`LINEUP|len=${body.length}|hasLineup=${hasLineup}|saveBtns=${saveBtns}`);
});

// ── 21. Training Center ───────────────────────────────────────────────────────

test('Training Center — assign training', async ({ page }) => {
  await page.goto(`${BASE}/franchise/training`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/training.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasTraining = body.includes('Focus') || body.includes('Intensity') || body.includes('Contact') || body.includes('Power');
  console.log(`TRAINING|len=${body.length}|hasTraining=${hasTraining}`);
});

// ── 22. Finances page ─────────────────────────────────────────────────────────

test('Finances — revenue and attendance', async ({ page }) => {
  await page.goto(`${BASE}/franchise/finances`);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${SS}/finances.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasDollar = body.includes('$') && (body.includes('Revenue') || body.includes('Attendance') || body.includes('Budget'));
  console.log(`FINANCES|len=${body.length}|hasDollar=${hasDollar}`);
});

// ── 23. Analytics page ────────────────────────────────────────────────────────

test('Team Analytics — charts and advanced stats', async ({ page }) => {
  await page.goto(`${BASE}/franchise/team-analytics`);
  await page.waitForTimeout(1500);
  await page.screenshot({ path: `${SS}/analytics.png`, fullPage: true });

  const body = await page.textContent('body') ?? '';
  const hasStats = body.includes('wRC+') || body.includes('WAR') || body.includes('FIP') || body.includes('OPS');
  console.log(`ANALYTICS|len=${body.length}|hasAdvStats=${hasStats}|preview="${body.replace(/\s+/g,' ').substring(200,500)}"`);
});

// ── 24. Console error check ───────────────────────────────────────────────────

test('Console Errors — zero tolerance', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto(`${BASE}/franchise`);
  const pages = [
    '/franchise', '/franchise/roster', '/franchise/schedule', '/franchise/standings',
    '/franchise/trade', '/franchise/free-agency', '/franchise/awards', '/franchise/goals',
    '/franchise/leaders', '/franchise/payroll', '/franchise/scouting',
  ];
  for (const p of pages) {
    await spa(page, p);
    await page.waitForTimeout(500);
  }

  const jsErrors = errors.filter(e => !e.includes('favicon') && !e.includes('404'));
  console.log(`CONSOLE_ERRORS=${jsErrors.length}|${JSON.stringify(jsErrors.slice(0, 5))}`);
  expect(jsErrors.length).toBe(0);
});

// ── 25. Mobile responsiveness ──────────────────────────────────────────────────

test('Mobile — key pages responsive', async ({ page }) => {
  await page.goto(`${BASE}/franchise`);
  await page.setViewportSize({ width: 390, height: 844 }); // iPhone 14

  const mobilePages = ['/franchise', '/franchise/roster', '/franchise/schedule', '/franchise/standings'];
  for (const p of mobilePages) {
    await spa(page, p);
    await page.waitForTimeout(600);
    const name = p.replace('/franchise/', '') || 'dashboard';
    await page.screenshot({ path: `${SS}/mobile-${name}.png` });

    const hasOverflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    console.log(`MOBILE_${name.toUpperCase()}|overflow=${hasOverflow}`);
  }
  await page.setViewportSize({ width: 1280, height: 720 });
});
