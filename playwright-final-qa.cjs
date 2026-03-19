const { chromium } = require('playwright');
const BASE = 'http://localhost:5173';

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const allErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') allErrors.push(msg.text()); });
  page.on('pageerror', err => allErrors.push(`PAGE: ${err.message}`));

  let pass = 0, fail = 0;
  function check(name, cond, detail = '') {
    if (cond) { console.log(`✅ ${name}`); pass++; }
    else { console.log(`❌ ${name} ${detail ? '— ' + detail : ''}`); fail++; }
  }

  // ── Start franchise ──────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("New Franchise")').click();
  await page.waitForTimeout(800);
  const teamBtns = await page.locator('button').all();
  for (const btn of teamBtns) {
    const text = await btn.innerText().catch(() => '');
    if (text.includes('\n') && text.length < 50) { await btn.click(); break; }
  }
  await page.waitForTimeout(400);
  await page.locator('button:has-text("Start Season")').click();
  await page.waitForTimeout(1500);
  check('Franchise starts and reaches dashboard', page.url().includes('/franchise'));

  // ── Test all sidebar nav pages ─────────────────────────────────────────
  console.log('\n── Sidebar navigation ──');
  const sidebarPages = [
    { link: 'Dashboard', expect: 'AUSTIN' },
    { link: 'Roster', expect: ['Roster', 'Austin'] },
    { link: 'Standings', expect: ['Standings', 'AMERICAN', 'NATIONAL'] },
    { link: 'Leaders', expect: ['Leaders', 'League'] },
    { link: 'Scouting Hub', expect: ['Scouting', '20-80', 'NEEDS'] },
    { link: 'Trades', expect: ['Trade'] },
    { link: 'Free Agency', expect: ['Free'] },
    { link: 'Schedule', expect: ['Schedule', 'Day 0'] },
    { link: 'Game Log', expect: ['Game Log'] },
    { link: 'Trade Proposals', expect: ['Trade Proposals'] },
    { link: 'Injuries', expect: ['Injur'] },
    { link: 'Minors', expect: ['Minor'] },
    { link: 'Franchise History', expect: ['History', 'franchise'] },
  ];

  for (const { link, expect } of sidebarPages) {
    const lnk = page.locator(`text="${link}"`).first();
    if (await lnk.count() === 0) {
      check(`Nav: ${link}`, false, 'link not found in sidebar');
      continue;
    }
    await lnk.click();
    await page.waitForTimeout(600);
    const txt = await page.locator('body').innerText();
    const expected = Array.isArray(expect) ? expect : [expect];
    const hasContent = expected.some(e => txt.toLowerCase().includes(e.toLowerCase()));
    check(`Nav: ${link}`, hasContent, `URL: ${page.url().split('/').slice(-2).join('/')}`);
  }

  // ── BUG 1: Playoffs doesn't auto-sim ──────────────────────────────────
  console.log('\n── Bug fixes ──');
  await page.locator('text="Playoffs"').first().click();
  await page.waitForTimeout(800);
  const playoffText = await page.locator('body').innerText();
  check('BUG1: Playoffs shows season-in-progress, not auto-sim',
    playoffText.includes('regular season is still in progress'));

  // ── BUG 2: State persists via localStorage ─────────────────────────────
  await page.goto(`${BASE}/franchise/schedule`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(800);
  const schedTxt = await page.locator('body').innerText();
  check('BUG2: Schedule loads via direct URL (state persists)',
    !schedTxt.includes('Back to Menu') || schedTxt.length > 500);

  // ── BUG 3: Career form guidance ────────────────────────────────────────
  await page.goto(`${BASE}/career/new`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);
  const careerTxt = await page.locator('body').innerText();
  check('BUG3: Career form has name/archetype fields', careerTxt.includes('FIRST NAME') || careerTxt.includes('CHOOSE ARCHETYPE'));

  const nameInputs = await page.locator('input').all();
  if (nameInputs.length >= 2) {
    await nameInputs[0].fill('Test');
    await nameInputs[1].fill('Player');
  }
  const btn = page.locator('[data-testid="begin-career-btn"]');
  const dis1 = await btn.getAttribute('disabled').catch(() => null);
  check('BUG3: Button disabled until archetype selected', dis1 !== null);

  // Click archetype
  const archBtns = page.locator('button').filter({ hasText: /Power Hitter|Contact|Speed Demon/i });
  if (await archBtns.count() > 0) await archBtns.first().click();
  await page.waitForTimeout(200);
  const dis2 = await btn.getAttribute('disabled').catch(() => null);
  check('BUG3: Button enabled after all fields filled', dis2 === null);

  // ── Scouting Hub comprehensive ─────────────────────────────────────────
  console.log('\n── Scouting Hub ──');
  await page.goto(BASE, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
  await page.locator('button:has-text("New Franchise")').click();
  await page.waitForTimeout(600);
  const tb2 = await page.locator('button').all();
  for (const btn2 of tb2) {
    const t = await btn2.innerText().catch(() => '');
    if (t.includes('\n') && t.length < 50) { await btn2.click(); break; }
  }
  await page.waitForTimeout(300);
  await page.locator('button:has-text("Start Season")').click();
  await page.waitForTimeout(1500);

  await page.locator('text="Scouting Hub"').first().click();
  await page.waitForTimeout(800);
  const scoutTxt = await page.locator('body').innerText();
  check('Scouting: Page loads', scoutTxt.includes('SCOUTING HUB'));
  check('Scouting: Team Needs shows', scoutTxt.includes('NEEDS') || scoutTxt.includes('Needs'));
  check('Scouting: Player grades shown', scoutTxt.includes('HIT') || scoutTxt.includes('VELO'));
  check('Scouting: Position filter pills present', scoutTxt.includes(' P ') || scoutTxt.includes('ALL'));

  // Click player card
  const cards = await page.locator('[class*="cursor-pointer"][class*="rounded-xl"]').count();
  check('Scouting: Player cards exist', cards > 0, `${cards} cards`);

  if (cards > 0) {
    await page.locator('[class*="cursor-pointer"][class*="rounded-xl"]').first().click();
    await page.waitForTimeout(500);
    const reportTxt = await page.locator('body').innerText();
    check('Scouting: Scout report opens on click', reportTxt.includes('Scout Assessment') || reportTxt.includes('Tool Grades'));
  }

  // View tabs
  await page.locator('button:has-text("League")').click();
  await page.waitForTimeout(600);
  const leagueTxt = await page.locator('body').innerText();
  const playerCount = parseInt(leagueTxt.match(/PLAYERS\s+(\d+)/)?.[1] ?? '0');
  check('Scouting: League view shows all teams players', playerCount > 100, `${playerCount} players`);

  await page.locator('button:has-text("Prospects")').click();
  await page.waitForTimeout(600);
  const prospTxt = await page.locator('body').innerText();
  check('Scouting: Prospects view works', prospTxt.includes('Upside') || prospTxt.includes('PLAYERS'));

  // ── Main Menu pages ────────────────────────────────────────────────────
  console.log('\n── Core pages ──');
  for (const [route, text] of [
    ['/', 'CLAUDE BALL'],
    ['/game/setup', 'Exhibition'],
    ['/game/quick', 'Quick'],
    ['/settings', 'Settings'],
    ['/saves', 'Save'],
    ['/historical', 'Historical'],
    ['/career/new', 'CAREER'],
  ]) {
    await page.goto(`${BASE}${route}`, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(600);
    const txt = await page.locator('body').innerText();
    check(`Page: ${route}`, txt.toLowerCase().includes(text.toLowerCase()));
  }

  // ── Production build ───────────────────────────────────────────────────
  console.log('\n── Summary ──');
  console.log(`\n✅ PASSED: ${pass} | ❌ FAILED: ${fail}`);

  if (allErrors.length > 0) {
    console.log('\n⚠️ Console errors:');
    allErrors.forEach(e => console.log(' ', e.slice(0, 100)));
  } else {
    console.log('✅ No console errors');
  }

  await browser.close();
  process.exit(fail > 0 ? 1 : 0);
})();
