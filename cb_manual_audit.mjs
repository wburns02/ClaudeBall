import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:5179';
const SS_DIR = '/tmp/cb_audit3';
mkdirSync(SS_DIR, { recursive: true });

let browser, page;
const notes = [];
const bugs = [];

async function ss(name) {
  const path = `${SS_DIR}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  return path;
}

async function goto(path, ms = 2000) {
  await page.goto(`${BASE_URL}${path}`);
  await page.waitForTimeout(ms);
  return page.url();
}

async function bodyText() {
  return page.innerText('body').catch(() => '');
}

async function allButtonTexts() {
  const btns = await page.locator('button').all();
  const texts = [];
  for (const b of btns) {
    const t = await b.innerText().catch(() => '');
    const e = await b.isEnabled().catch(() => false);
    if (t.trim()) texts.push(`"${t.trim().replace(/\n/g,' ')}"(${e?'on':'off'})`);
  }
  return texts;
}

const consoleErrors = [];
const pageErrors = [];

async function main() {
  browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 } });
  page = await ctx.newPage();
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => pageErrors.push(err.message));

  // ── STEP 1: Create Franchise properly ─────────────────────
  notes.push('=== STEP 1: Create Franchise ===');
  await goto('/franchise/new', 3000);
  await ss('01_new_franchise');
  
  // Get all elements with team-like content
  const pageHTML = await page.content();
  notes.push(`Page HTML snippet (first 2000): ${pageHTML.substring(0, 2000)}`);
  
  // Look for team grid items specifically
  const teamItems = await page.locator('button, div, li').filter({ hasText: /Thunderhawks|Ironclads|Knights|Tides|Sounds|Sandgnats|Rebels/i }).all();
  notes.push(`Team-named elements: ${teamItems.length}`);
  
  // Try clicking first specific team (Austin Thunderhawks)
  const thunderhawks = page.locator('text=Austin Thunderhawks').first();
  const thunderhawksCount = await thunderhawks.count();
  notes.push(`Austin Thunderhawks element count: ${thunderhawksCount}`);
  
  if (thunderhawksCount > 0) {
    await thunderhawks.click();
    await page.waitForTimeout(500);
    notes.push('Clicked Austin Thunderhawks');
  } else {
    // Try by THK abbreviation
    const thk = page.locator('text=THK').first();
    if (await thk.count() > 0) {
      await thk.click();
      await page.waitForTimeout(500);
      notes.push('Clicked THK');
    }
  }
  
  await ss('02_team_selected');
  
  // Click Start Season
  const startSeason = page.locator('button:has-text("Start Season")');
  const startSeasonCount = await startSeason.count();
  notes.push(`Start Season button count: ${startSeasonCount}`);
  
  if (startSeasonCount > 0) {
    notes.push(`Start Season enabled: ${await startSeason.isEnabled()}`);
    await startSeason.click();
    await page.waitForTimeout(4000);
    notes.push('Clicked Start Season');
  }
  
  await ss('03_after_start_season');
  const urlAfterStart = page.url();
  notes.push(`URL after Start Season: ${urlAfterStart}`);
  
  // Check franchise state
  await goto('/franchise', 2500);
  const dashUrl = page.url();
  const dashText = await bodyText();
  notes.push(`Franchise URL: ${dashUrl}`);
  notes.push(`Dashboard text (800 chars): ${dashText.substring(0, 800)}`);
  
  const franchiseCreated = !dashUrl.includes('/franchise/new') && dashUrl.includes('/franchise');
  notes.push(`Franchise created successfully: ${franchiseCreated}`);
  
  if (!franchiseCreated) {
    bugs.push({
      page: '/franchise/new',
      severity: 'CRITICAL',
      issue: 'Franchise creation fails — clicking team and Start Season does not create franchise',
      expected: 'After clicking team + Start Season, redirect to /franchise dashboard with team loaded',
      actual: `URL: ${dashUrl}. Team click and Start Season button press did not persist state.`
    });
    notes.push('CRITICAL: Franchise not created. All subsequent checks will show "No franchise loaded"');
  }
  
  await ss('04_dashboard');

  // ── STEP 2: Schedule ─────────────────────────────────────
  notes.push('\n=== STEP 2: Schedule Page ===');
  await goto('/franchise/schedule', 2000);
  await ss('05_schedule');
  
  const schedText = await bodyText();
  notes.push(`Schedule text: ${schedText.substring(0, 600)}`);
  
  const schedBtns = await allButtonTexts();
  notes.push(`Schedule all buttons: ${schedBtns.join(', ')}`);
  
  // Look for actual schedule content elements
  const simBtnsByText = await page.locator('button').all();
  const allBtnDetails = [];
  for (const b of simBtnsByText) {
    const t = await b.innerText().catch(() => '');
    const en = await b.isEnabled().catch(() => false);
    allBtnDetails.push(`"${t.trim()}" enabled=${en}`);
  }
  notes.push(`All schedule buttons with enabled state: ${allBtnDetails.join(' | ')}`);
  
  // Check what's in the actual content area (not sidebar)
  const mainContent = await page.locator('main, [class*="main"], [class*="content"], [class*="page"]').first().innerText().catch(() => 'not found');
  notes.push(`Main content area: ${mainContent.substring(0, 600)}`);

  // ── STEP 3: Examine the schedule page source for sim controls ──
  notes.push('\n=== STEP 3: Schedule Page DOM Analysis ===');
  
  // Look for elements that might be sim controls
  const allInteractiveElements = await page.locator('button, input, select, a[href]').all();
  const elemDetails = [];
  for (const el of allInteractiveElements.slice(0, 50)) {
    const tag = await el.evaluate(e => e.tagName);
    const t = await el.innerText().catch(() => '');
    const cls = await el.getAttribute('class').catch(() => '');
    const href = await el.getAttribute('href').catch(() => '');
    const enabled = await el.isEnabled().catch(() => false);
    if (t.trim() || href) {
      elemDetails.push(`${tag}: "${t.trim().substring(0,30)}" class="${(cls||'').substring(0,40)}" href="${href}" enabled=${enabled}`);
    }
  }
  notes.push(`Interactive elements: ${elemDetails.join('\n  ')}`);

  // ── STEP 4: Inspect franchise state in the app ─────────────
  notes.push('\n=== STEP 4: Inspect App State via LocalStorage ===');
  const lsData = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      if (val && val.length < 2000) {
        data[key] = val;
      } else if (val) {
        data[key] = `[${val.length} chars] ${val.substring(0, 200)}...`;
      }
    }
    return data;
  });
  notes.push(`LocalStorage keys: ${Object.keys(lsData).join(', ')}`);
  for (const [k, v] of Object.entries(lsData)) {
    notes.push(`  ${k}: ${v.substring(0, 500)}`);
  }

  // ── STEP 5: Try creating franchise via direct state inspection ──
  notes.push('\n=== STEP 5: Try franchise creation via UI with detailed logging ===');
  await goto('/franchise/new', 2000);
  
  // Inject a click on the team card
  const teamCardSelector = await page.evaluate(() => {
    // Find any element that contains "Thunderhawks" or a team name
    const all = document.querySelectorAll('*');
    for (const el of all) {
      if (el.textContent && el.textContent.includes('Thunderhawks') && el.children.length < 5) {
        return el.tagName + '.' + (el.className || '').replace(/\s+/g, '.');
      }
    }
    return 'not found';
  });
  notes.push(`Team card selector: ${teamCardSelector}`);
  
  // Get all clickable areas with team names
  const clickableTeams = await page.evaluate(() => {
    const results = [];
    const teamNames = ['Thunderhawks', 'Ironclads', 'Knights', 'Sandgnats', 'Rebels'];
    for (const name of teamNames) {
      const els = document.querySelectorAll('*');
      for (const el of els) {
        if (el.textContent && el.textContent.includes(name) && el.children.length <= 3) {
          results.push({
            tag: el.tagName,
            className: el.className,
            cursor: window.getComputedStyle(el).cursor,
            onClick: el.onclick ? 'has-handler' : 'no-handler',
            text: el.textContent.trim().substring(0, 50)
          });
          break;
        }
      }
    }
    return results;
  });
  notes.push(`Clickable team elements: ${JSON.stringify(clickableTeams, null, 2)}`);
  
  // Try clicking with JS if needed
  const thunderhawksEl = await page.locator('*').filter({ hasText: /^Austin Thunderhawks/ }).first();
  if (await thunderhawksEl.count() > 0) {
    const tagName = await thunderhawksEl.evaluate(el => el.tagName);
    notes.push(`Thunderhawks element tag: ${tagName}`);
    await thunderhawksEl.click({ force: true });
    await page.waitForTimeout(500);
    notes.push('Force-clicked Thunderhawks element');
    await ss('05b_team_selected_force');
  }
  
  // Now check if Start Season is enabled
  const startBtn2 = page.locator('button:has-text("Start Season")');
  const startCount2 = await startBtn2.count();
  const startEnabled2 = startCount2 > 0 ? await startBtn2.isEnabled() : false;
  notes.push(`Start Season btn count: ${startCount2}, enabled: ${startEnabled2}`);
  
  if (startEnabled2) {
    await startBtn2.click();
    await page.waitForTimeout(5000);
    notes.push(`URL after start: ${page.url()}`);
    await ss('05c_after_force_start');
  }
  
  // Check LS again
  const lsData2 = await page.evaluate(() => {
    const data = {};
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      const val = localStorage.getItem(key);
      data[key] = val ? val.substring(0, 300) : 'null';
    }
    return data;
  });
  notes.push(`LocalStorage after 2nd attempt: ${JSON.stringify(Object.keys(lsData2))}`);
  
  // Navigate to franchise
  await goto('/franchise', 2000);
  const dash2Url = page.url();
  const dash2Text = await bodyText();
  notes.push(`Franchise URL (2nd attempt): ${dash2Url}`);
  notes.push(`Dashboard text (2nd attempt, 800 chars): ${dash2Text.substring(0, 800)}`);
  
  await ss('06_dashboard_2nd_attempt');

  // ── STEP 6: Sim if franchise created ─────────────────────
  if (!dash2Url.includes('/franchise/new')) {
    notes.push('\n=== STEP 6: Franchise Exists — Sim Days ===');
    await goto('/franchise/schedule', 2000);
    await ss('07_schedule_with_franchise');
    
    const schedText2 = await bodyText();
    notes.push(`Schedule with franchise (600 chars): ${schedText2.substring(0, 600)}`);
    
    // Find sim buttons
    const allBtns2 = await page.locator('button').all();
    const simRelated = [];
    for (const b of allBtns2) {
      const t = await b.innerText().catch(() => '');
      const en = await b.isEnabled().catch(() => false);
      simRelated.push(`"${t.trim()}" en=${en}`);
    }
    notes.push(`All buttons (with state): ${simRelated.join(' | ')}`);
    
    // Try sim buttons
    let simsRun = 0;
    const simPatterns = [/sim\s*day/i, /sim\s*1/i, /sim\s*week/i, /sim\s*7/i, /advance/i, /play\s*day/i, /next\s*day/i];
    for (const pattern of simPatterns) {
      const btn = page.locator('button').filter({ hasText: pattern }).first();
      if (await btn.count() > 0 && await btn.isEnabled().catch(() => false)) {
        notes.push(`Found sim button matching: ${pattern}`);
        for (let i = 0; i < 15; i++) {
          const b2 = page.locator('button').filter({ hasText: pattern }).first();
          if (await b2.count() > 0 && await b2.isEnabled().catch(() => false)) {
            await b2.click();
            await page.waitForTimeout(1500);
            simsRun++;
          } else break;
        }
        break;
      }
    }
    notes.push(`Total sims run: ${simsRun}`);
    await ss('08_after_sim');
  }

  // ── STEP 7: Audit all pages one by one ───────────────────
  notes.push('\n=== STEP 7: Page-by-page Audit ===');
  
  const pagesToAudit = [
    { path: '/franchise', name: 'Dashboard' },
    { path: '/franchise/schedule', name: 'Schedule' },
    { path: '/franchise/lineup-editor', name: 'Lineup Editor' },
    { path: '/franchise/roster', name: 'Roster' },
    { path: '/franchise/news', name: 'News' },
    { path: '/franchise/standings', name: 'Standings' },
    { path: '/franchise/leaders', name: 'Leaders' },
    { path: '/franchise/hot-cold', name: 'Hot Cold' },
    { path: '/franchise/free-agency', name: 'Free Agency' },
    { path: '/franchise/waivers', name: 'Waivers' },
    { path: '/franchise/injuries', name: 'Injuries' },
    { path: '/franchise/trade', name: 'Trade' },
    { path: '/franchise/finances', name: 'Finances' },
    { path: '/franchise/minors', name: 'Minors' },
    { path: '/franchise/scouting', name: 'Scouting' },
    { path: '/franchise/training', name: 'Training' },
    { path: '/franchise/draft', name: 'Draft' },
    { path: '/franchise/payroll', name: 'Payroll' },
    { path: '/franchise/game-log', name: 'Game Log' },
    { path: '/franchise/history', name: 'Franchise History' },
    { path: '/franchise/records', name: 'Records' },
    { path: '/franchise/awards', name: 'Awards' },
    { path: '/franchise/all-star', name: 'All Star' },
    { path: '/franchise/trade-proposals', name: 'Trade Proposals' },
    { path: '/franchise/development', name: 'Development Hub' },
    { path: '/career', name: 'Career Mode' },
  ];
  
  const pageResults = {};
  for (const p of pagesToAudit) {
    await goto(p.path, 1500);
    const url = page.url();
    const text = await bodyText();
    const ssPath = await ss(`page_${p.name.replace(/\s+/g,'_').toLowerCase()}`);
    const btnTexts = await allButtonTexts();
    
    pageResults[p.name] = {
      url,
      textLength: text.length,
      hasNoFranchise: text.includes('No franchise loaded'),
      firstContent: text.replace(/^[\s\S]{0,400}?(?=\n\S)/m, '').substring(0, 300),
      buttons: btnTexts.filter(b => !b.includes('Dashboard') && !b.includes('Roster') && !b.includes('Standings') && !b.includes('Training') && !b.includes('Leaders') && !b.includes('Finances') && !b.includes('Payroll')).slice(0, 10),
      screenshot: ssPath,
    };
    notes.push(`\n[${p.name}] URL=${url} len=${text.length} noFranchise=${text.includes('No franchise loaded')}`);
    notes.push(`  Content: ${text.replace(/^([\s\S]{0,500})[\s\S]*/m,'$1').trim().substring(200, 600)}`);
    notes.push(`  Unique buttons: ${pageResults[p.name].buttons.join(' | ')}`);
  }
  
  // ── STEP 8: Console errors ─────────────────────────────
  notes.push('\n=== STEP 8: Console Errors ===');
  notes.push(`Console errors: ${consoleErrors.length}`);
  notes.push(`Page errors: ${pageErrors.length}`);
  consoleErrors.slice(0, 20).forEach((e,i) => notes.push(`  Error ${i+1}: ${e.substring(0,200)}`));
  pageErrors.slice(0, 10).forEach((e,i) => notes.push(`  Page error ${i+1}: ${e.substring(0,200)}`));

  notes.push('\n=== BUG SUMMARY ===');
  bugs.forEach((b,i) => {
    notes.push(`BUG ${i+1} [${b.severity}] ${b.page}: ${b.issue}`);
  });
  
  await browser.close();
  writeFileSync('/tmp/cb_audit3_notes.txt', notes.join('\n'));
  writeFileSync('/tmp/cb_audit3_pages.json', JSON.stringify(pageResults, null, 2));
  console.log(notes.join('\n'));
}

main().catch(e => {
  console.error('Failed:', e);
  if (browser) browser.close().catch(()=>{});
});
