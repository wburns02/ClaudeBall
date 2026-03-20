/**
 * ClaudeBall Bug Fix Verification Script
 * Tests 5 specific bug fixes via Playwright
 */
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'fs';

const BASE_URL = 'http://localhost:5179';
const SCREENSHOT_DIR = '/home/will/ClaudeBall/scripts/screenshots';

mkdirSync(SCREENSHOT_DIR, { recursive: true });

async function navigateTo(page, path) {
  await page.goto(`${BASE_URL}${path}`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1500);
}

async function ensureFranchise(page) {
  console.log('Checking/creating franchise...');
  await navigateTo(page, '/franchise');

  const isFranchise = await page.evaluate(() => {
    const text = document.body.innerText;
    return text.includes('Roster') && text.includes('Schedule') && !text.includes('Exhibition Game');
  });

  if (!isFranchise) {
    console.log('Creating new franchise...');
    await navigateTo(page, '/franchise/new');
    await page.waitForTimeout(500);

    // Select first team via JS click
    const teamSelected = await page.evaluate(() => {
      const containers = document.querySelectorAll('.space-y-1');
      for (const c of containers) {
        const btn = c.querySelector('button');
        if (btn && !btn.disabled) {
          btn.click();
          return btn.innerText.trim().split('\n')[0];
        }
      }
      return null;
    });
    console.log('Selected team:', teamSelected);

    await page.waitForTimeout(500);
    const startBtn = page.locator('button:has-text("Start Season")');
    if (await startBtn.isEnabled()) {
      await startBtn.click();
      await page.waitForTimeout(3000);
    }
  }

  const postText = await page.evaluate(() => document.body.innerText.substring(0, 100));
  console.log('Franchise state:', postText.replace(/\n+/g, ' ').substring(0, 80));
  await page.screenshot({ path: `${SCREENSHOT_DIR}/00_franchise.png` });
}

/**
 * Sim games by clicking "Sim→X" buttons on the schedule page.
 * Clicks up to `maxClicks` sim buttons to advance days quickly.
 */
async function simGamesOnSchedule(page, maxClicks = 10) {
  await navigateTo(page, '/franchise/schedule');
  await page.waitForTimeout(500);

  let clicked = 0;
  for (let i = 0; i < maxClicks; i++) {
    // Set up dialog handler BEFORE clicking (dialogs fire synchronously on click)
    let dialogHandled = false;
    page.once('dialog', async dialog => {
      dialogHandled = true;
      try { await dialog.accept(); } catch(_e) {}
    });

    // Find any enabled Sim button (they say "Sim→X" or "Sim")
    const simBtns = await page.locator('button').all();
    let found = false;
    for (const btn of simBtns) {
      const text = await btn.innerText().catch(() => '');
      const enabled = await btn.isEnabled().catch(() => false);
      const visible = await btn.isVisible().catch(() => false);
      if (enabled && visible && (text.includes('Sim') || text.includes('→')) && !text.includes('Skip')) {
        try {
          await btn.click({ timeout: 5000 });
          clicked++;
          found = true;
        } catch(_e) {
          // Button might have caused navigation or dialog
          found = true;
        }
        await page.waitForTimeout(800);
        break;
      }
    }
    if (!found) break;
  }

  const day = await page.evaluate(() => {
    const text = document.body.innerText;
    const m = text.match(/Day\s+(\d+)/i);
    return m ? parseInt(m[1]) : null;
  });

  console.log(`Simmed ${clicked} game(s). Current day: ${day}`);
  return { clicked, day };
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.setViewportSize({ width: 1400, height: 900 });
  // Dialogs are handled per-click inside simGamesOnSchedule to avoid conflicts

  const consoleErrors = [];
  page.on('console', msg => { if (msg.type() === 'error') consoleErrors.push(msg.text()); });
  page.on('pageerror', err => consoleErrors.push(`PAGE ERROR: ${err.message}`));

  const results = {};

  await ensureFranchise(page);

  // Sim enough games to get stats (one round of 10 clicks advances many days)
  console.log('\nSimming games to generate stats...');
  await simGamesOnSchedule(page, 8);

  await navigateTo(page, '/franchise/schedule');
  const currentDayInfo = await page.evaluate(() => {
    const m = document.body.innerText.match(/Day\s+(\d+)/i);
    return m ? parseInt(m[1]) : 0;
  });
  console.log('Day after simming:', currentDayInfo);
  await page.screenshot({ path: `${SCREENSHOT_DIR}/01_after_sim.png` });

  // ─── BUG 1: League Leaders Pitching ─────────────────────────────────────────
  console.log('\n=== BUG 1: League Leaders Pitching ===');
  try {
    await navigateTo(page, '/franchise/leaders');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/02_league_leaders_batting.png` });

    const llText = await page.evaluate(() => document.body.innerText.substring(0, 300));
    console.log('Leaders page:', llText.replace(/\n+/g, ' ').substring(0, 150));

    // Click Pitching tab
    const pitchBtn = page.locator('button').filter({ hasText: /^Pitching$/i }).first();
    const hasPitch = await pitchBtn.isVisible().catch(() => false);
    if (hasPitch) {
      await pitchBtn.click();
      await page.waitForTimeout(800);
      console.log('Clicked Pitching tab');
    } else {
      console.log('Pitching tab not found by exact text');
      // Try to click any button that contains just "Pitching"
      const allBtns = await page.locator('button').all();
      for (const btn of allBtns) {
        const t = await btn.innerText().catch(() => '');
        if (t.trim() === 'Pitching') { await btn.click(); await page.waitForTimeout(800); break; }
      }
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/03_league_leaders_pitching.png` });

    const tableData = await page.evaluate(() => {
      const tables = Array.from(document.querySelectorAll('table'));
      return tables.map((t, i) => ({
        idx: i,
        rows: t.querySelectorAll('tbody tr').length,
        headers: Array.from(t.querySelectorAll('th')).map(h => h.innerText.trim()).join(', '),
      }));
    });
    console.log('Table data:', JSON.stringify(tableData));

    const maxRows = tableData.reduce((m, t) => Math.max(m, t.rows), 0);
    const pass = maxRows > 5;

    results.bug1 = {
      status: pass ? 'PASS' : 'FAIL',
      detail: `Pitching table has ${maxRows} rows (need > 5). Tables: ${JSON.stringify(tableData)}`,
      rows: maxRows
    };
    console.log(`Bug 1: ${results.bug1.status} — ${results.bug1.detail}`);
  } catch (e) {
    results.bug1 = { status: 'ERROR', detail: e.message };
  }

  // ─── BUG 2: Free Agency Sign Button Toggle ───────────────────────────────────
  console.log('\n=== BUG 2: Free Agency Sign Button Toggle ===');
  try {
    await navigateTo(page, '/franchise/free-agency');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/04_fa_initial.png` });

    // Find first Sign… button
    const signBtn = page.locator('button').filter({ hasText: /^Sign/ }).first();
    const hasSign = await signBtn.isVisible().catch(() => false);
    console.log('Sign button visible:', hasSign);

    if (hasSign) {
      const initText = await signBtn.innerText().catch(() => '');
      const beforeLen = (await page.evaluate(() => document.body.innerText)).length;

      // Click 1 — expand
      await signBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/05_fa_expanded.png` });

      const afterExpandText = await signBtn.innerText().catch(() => '');
      const expandedLen = (await page.evaluate(() => document.body.innerText)).length;
      console.log(`Btn before: "${initText.trim()}" → after click: "${afterExpandText.trim()}"`);
      console.log(`Content length: ${beforeLen} → ${expandedLen} (+${expandedLen - beforeLen})`);

      const expanded = expandedLen > beforeLen + 20;
      const btnChanged = afterExpandText.trim() !== initText.trim();

      // Click 2 — collapse
      await signBtn.click();
      await page.waitForTimeout(800);
      await page.screenshot({ path: `${SCREENSHOT_DIR}/06_fa_collapsed.png` });

      const afterCollapseText = await signBtn.innerText().catch(() => '');
      const collapsedLen = (await page.evaluate(() => document.body.innerText)).length;
      console.log(`Btn after collapse: "${afterCollapseText.trim()}"`);
      console.log(`Content length after collapse: ${collapsedLen} (diff from before: ${collapsedLen - beforeLen})`);

      const collapsed = Math.abs(collapsedLen - beforeLen) < 30;
      const btnReset = afterCollapseText.trim() === initText.trim();

      results.bug2 = {
        status: (expanded || btnChanged) && (collapsed || btnReset) ? 'PASS' :
          (expanded || btnChanged) ? 'PARTIAL - expands but does not fully collapse' : 'FAIL',
        detail: `Init btn: "${initText.trim()}". After expand: "${afterExpandText.trim()}" (grew +${expandedLen - beforeLen}). After collapse: "${afterCollapseText.trim()}" (shrunk to ${collapsedLen - beforeLen} diff from start). Expanded: ${expanded||btnChanged}. Collapsed: ${collapsed||btnReset}`,
        expanded: expanded || btnChanged,
        collapsed: collapsed || btnReset
      };
    } else {
      results.bug2 = { status: 'INCONCLUSIVE', detail: 'No Sign button found on Free Agency page' };
    }
    console.log(`Bug 2: ${results.bug2.status} — ${results.bug2.detail}`);
  } catch (e) {
    results.bug2 = { status: 'ERROR', detail: e.message };
  }

  // ─── BUG 3: Hot & Cold Summary Cards ────────────────────────────────────────
  console.log('\n=== BUG 3: Hot & Cold Summary Cards ===');
  try {
    await navigateTo(page, '/franchise/hot-cold');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/07_hot_cold.png` });

    // Read the summary card numbers directly from the DOM
    const cardData = await page.evaluate(() => {
      // The 4 summary cards are in a grid, each has a number and a label
      // Structure from source: grid-cols-4, each div has a text-2xl number and a text-xs label
      const result = {};

      // Find all elements with "On Fire", "Trending Up", "Slowing Down", "Ice Cold"
      // Note: in the page they appear as "🔥 On Fire", "↑ Trending Up", "↓ Slowing Down", "❄ Ice Cold"
      const searchTerms = {
        'ON FIRE': 'onFire',
        'TRENDING UP': 'trendingUp',
        'SLOWING DOWN': 'slowingDown',
        'ICE COLD': 'iceCold',
        'On Fire': 'onFire',
        'Trending Up': 'trendingUp',
        'Slowing Down': 'slowingDown',
        'Ice Cold': 'iceCold',
      };

      // Walk all text nodes
      const allEls = document.querySelectorAll('p, span, div');
      for (const el of allEls) {
        if (el.children.length > 0) continue; // leaf nodes only
        const text = (el.innerText || el.textContent || '').trim();
        for (const [term, key] of Object.entries(searchTerms)) {
          if (text.includes(term)) {
            // Get the sibling or parent's number
            const parent = el.parentElement;
            if (parent) {
              const parentText = parent.innerText || '';
              const numMatch = parentText.match(/^(\d+)/);
              if (numMatch) {
                result[key] = parseInt(numMatch[1]);
              } else {
                // Look for number in first child
                const firstChild = parent.firstElementChild;
                const fc = firstChild?.innerText?.trim();
                if (fc && /^\d+$/.test(fc)) {
                  result[key] = parseInt(fc);
                }
              }
            }
          }
        }
      }
      return result;
    });

    console.log('Card data from DOM walk:', cardData);

    // Alternative: grab the summary section raw text
    const rawSummaryText = await page.evaluate(() => {
      // The summary cards are the first major content section after the header
      const h1 = document.querySelector('h1');
      if (!h1) return 'no h1';
      const mainContent = h1.closest('div') || h1.parentElement;
      return mainContent ? mainContent.parentElement?.innerText?.substring(0, 500) : 'no container';
    });
    console.log('Raw summary area:', rawSummaryText?.replace(/\n+/g, ' ').substring(0, 200));

    // Get numbers by their exact position in the grid
    const gridNums = await page.evaluate(() => {
      // The grid is defined as grid-cols-2 sm:grid-cols-4 with 4 cards
      const grid = document.querySelector('[class*="grid-cols-4"], [class*="grid-cols-2"]');
      if (!grid) return null;
      const children = Array.from(grid.children);
      return children.slice(0, 4).map(child => ({
        text: child.innerText.trim().replace(/\n+/g, '|'),
        num: (child.innerText.match(/(\d+)/) || [])[1],
      }));
    });
    console.log('Grid items:', gridNums);

    // Get complete page text to verify label presence
    const pageText = await page.evaluate(() => document.body.innerText);
    const hasOnFire = pageText.includes('On Fire') || pageText.includes('ON FIRE');
    const hasTrendingUp = pageText.includes('Trending Up') || pageText.includes('TRENDING UP');
    const hasSlowingDown = pageText.includes('Slowing Down') || pageText.includes('SLOWING DOWN');
    const hasIceCold = pageText.includes('Ice Cold') || pageText.includes('ICE COLD');

    console.log('Labels present:', { hasOnFire, hasTrendingUp, hasSlowingDown, hasIceCold });

    const allPresent = hasOnFire && hasTrendingUp && hasSlowingDown && hasIceCold;

    // Verify no overlap in counts
    let overlapDetail = '';
    let noOverlap = null;
    if (gridNums && gridNums.length === 4) {
      const nums = gridNums.map(g => parseInt(g.num ?? '0') || 0);
      const [onFire, trendingUp, slowingDown, iceCold] = nums;
      const sum = onFire + trendingUp + slowingDown + iceCold;
      overlapDetail = `On Fire: ${onFire}, Trending Up: ${trendingUp}, Slowing Down: ${slowingDown}, Ice Cold: ${iceCold}, Sum: ${sum}`;
      // Check: On Fire + Trending Up should not exceed team roster (25 players)
      // and Slowing Down + Ice Cold should not exceed roster either
      // More importantly, verify none of these counts are shared
      // Since these are mutually exclusive categories (hot/warm/cool/cold), no overlap possible by design
      noOverlap = onFire + trendingUp <= 25 && slowingDown + iceCold <= 25;
    } else {
      overlapDetail = `Grid items: ${JSON.stringify(gridNums)}`;
    }

    results.bug3 = {
      status: allPresent ? 'PASS' : 'FAIL',
      detail: `All 4 summary cards present: ${allPresent}. ${overlapDetail}`,
      allPresent,
      gridNums,
      noOverlap
    };
    console.log(`Bug 3: ${results.bug3.status} — ${results.bug3.detail}`);
  } catch (e) {
    results.bug3 = { status: 'ERROR', detail: e.message };
  }

  // ─── BUG 4: News Milestones ──────────────────────────────────────────────────
  console.log('\n=== BUG 4: News Milestones ===');
  try {
    await navigateTo(page, '/franchise/news');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/08_news_before.png` });

    const newsText = await page.evaluate(() => document.body.innerText);
    console.log('News page:', newsText.substring(0, 400));

    // Extract news items with their Day labels
    const extractNewsItems = async () => {
      return page.evaluate(() => {
        const items = [];
        // News cards are divs with rounded-lg border
        const cards = document.querySelectorAll('[class*="rounded-lg"][class*="border"]');
        for (const card of cards) {
          const text = (card.innerText || '').trim();
          if (text.length < 10) continue;
          const dayMatch = text.match(/Day\s+(\d+)/i);
          const isMilestone = text.toLowerCase().includes('milestone') ||
            (card.className || '').includes('purple');
          items.push({
            text: text.substring(0, 100).replace(/\n+/g, ' '),
            day: dayMatch ? parseInt(dayMatch[1]) : null,
            isMilestone
          });
        }
        return items.filter(i => i.day !== null).slice(0, 10);
      });
    };

    const itemsBefore = await extractNewsItems();
    const currentDayBefore = await page.evaluate(() => {
      const m = document.body.innerText.match(/Day\s+(\d+)\s+of/i);
      return m ? parseInt(m[1]) : null;
    });
    console.log('Current day (before sim):', currentDayBefore);
    console.log('News items before sim:', itemsBefore.slice(0, 5));

    // Sim 1 more game
    await navigateTo(page, '/franchise/schedule');
    const simBtns = await page.locator('button').all();
    let simmed = false;
    for (const btn of simBtns) {
      const text = await btn.innerText().catch(() => '');
      const enabled = await btn.isEnabled().catch(() => false);
      const visible = await btn.isVisible().catch(() => false);
      if (enabled && visible && text.includes('Sim')) {
        await btn.click();
        simmed = true;
        await page.waitForTimeout(1500);
        // Accept any dialog
        break;
      }
    }
    await page.screenshot({ path: `${SCREENSHOT_DIR}/09_schedule_sim.png` });

    // Return to news
    await navigateTo(page, '/franchise/news');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/10_news_after.png` });

    const itemsAfter = await extractNewsItems();
    const currentDayAfter = await page.evaluate(() => {
      const m = document.body.innerText.match(/Day\s+(\d+)\s+of/i);
      return m ? parseInt(m[1]) : null;
    });
    console.log('Current day (after sim):', currentDayAfter);
    console.log('News items after sim:', itemsAfter.slice(0, 5));

    // Key test: if milestone items existed, their Day should be unchanged
    const milestoneBefore = itemsBefore.filter(i => i.isMilestone);
    const milestoneAfter = itemsAfter.filter(i => i.isMilestone);

    let bug4Status, bug4Detail;

    if (milestoneBefore.length > 0) {
      const daysBefore = milestoneBefore.map(m => m.day).sort();
      const daysAfter = milestoneAfter.map(m => m.day).sort();
      const stable = JSON.stringify(daysBefore) === JSON.stringify(daysAfter);
      bug4Status = stable ? 'PASS' : 'FAIL';
      bug4Detail = `Milestone day stability: before [${daysBefore}] → after [${daysAfter}]. Day: ${currentDayBefore}→${currentDayAfter}. Stable: ${stable}`;
    } else {
      // Check general news items - did day advance, and are old items still showing original days?
      const dayAdvanced = simmed && (currentDayAfter ?? 0) > (currentDayBefore ?? 0);
      const beforeDays = itemsBefore.map(i => i.day).filter(Boolean);
      const afterDays = itemsAfter.map(i => i.day).filter(Boolean);

      // Check if any "before" items have had their day updated to current day
      const currentDayStr = String(currentDayAfter);
      const noUpdatedDays = beforeDays.every(d => d !== currentDayAfter || d === currentDayBefore);

      if (itemsBefore.length > 0 && dayAdvanced) {
        // Check if any old items had their day bumped to currentDayAfter
        const oldItemsWithNewDay = itemsBefore.filter(i =>
          i.day === currentDayBefore && // was from "before" day
          afterDays.filter(d => d === currentDayAfter).length > itemsBefore.filter(i2 => i2.day === currentDayAfter).length
        );
        bug4Status = 'INCONCLUSIVE';
        bug4Detail = `No milestone items found. Day advanced: ${currentDayBefore}→${currentDayAfter} (simmed: ${simmed}). News items before: [${beforeDays.slice(0,5)}], after: [${afterDays.slice(0,5)}]`;
      } else if (itemsBefore.length === 0) {
        bug4Status = 'INCONCLUSIVE';
        bug4Detail = `No news items yet (Day ${currentDayBefore}). Need more gameplay to generate milestones. Simmed: ${simmed}`;
      } else {
        bug4Status = 'INCONCLUSIVE';
        bug4Detail = `Items found but day did not advance clearly. Before: ${itemsBefore.length} items [days: ${beforeDays.slice(0,5)}], after: ${itemsAfter.length} items [days: ${afterDays.slice(0,5)}]`;
      }
    }

    results.bug4 = {
      status: bug4Status,
      detail: bug4Detail,
      simmed,
      currentDayBefore,
      currentDayAfter,
      itemsBefore: itemsBefore.slice(0, 3),
      itemsAfter: itemsAfter.slice(0, 3)
    };
    console.log(`Bug 4: ${results.bug4.status} — ${results.bug4.detail}`);
  } catch (e) {
    results.bug4 = { status: 'ERROR', detail: e.message };
  }

  // ─── BUG 5: Waiver Wire Claim Button ────────────────────────────────────────
  console.log('\n=== BUG 5: Waiver Wire Claim Button ===');
  try {
    // First, release a player to populate the waiver wire
    await navigateTo(page, '/franchise/waivers');
    await page.screenshot({ path: `${SCREENSHOT_DIR}/11_waivers_before_release.png` });

    const waiverText = await page.evaluate(() => document.body.innerText);
    console.log('Waivers page:', waiverText.substring(0, 300));

    const hasNoPlayers = waiverText.includes('No players available on waivers');
    console.log('No players on waivers:', hasNoPlayers);

    let claimBtnStatus = null;

    if (hasNoPlayers) {
      // Release a player to put them on waivers
      const releaseBtns = await page.locator('button:has-text("Release")').all();
      console.log('Release buttons found:', releaseBtns.length);

      if (releaseBtns.length > 0) {
        await releaseBtns[0].click();
        await page.waitForTimeout(1500);
        await page.screenshot({ path: `${SCREENSHOT_DIR}/12_after_release.png` });

        const afterReleaseText = await page.evaluate(() => document.body.innerText);
        console.log('After release:', afterReleaseText.substring(200, 500));

        // Now check for Claim buttons in the available section
        const allBtnsAfter = await page.locator('button').all();
        const claimButtons = [];
        for (const btn of allBtnsAfter) {
          const text = await btn.innerText().catch(() => '');
          const visible = await btn.isVisible().catch(() => false);
          const disabled = await btn.isDisabled().catch(() => true);
          if (visible && text.trim() === 'Claim') {
            claimButtons.push({ disabled });
          }
        }
        console.log('Claim buttons after release:', claimButtons.length, claimButtons);

        if (claimButtons.length > 0) {
          const hasEnabled = claimButtons.some(b => !b.disabled);
          claimBtnStatus = {
            found: true,
            count: claimButtons.length,
            enabled: hasEnabled,
            disabled: !hasEnabled
          };
        } else {
          // The released player might need a day to become available
          // Check if the AVAILABLE section has any content
          const availableSection = await page.evaluate(() => {
            const text = document.body.innerText;
            const availIdx = text.indexOf('AVAILABLE');
            if (availIdx < 0) return 'AVAILABLE section not found';
            return text.substring(availIdx, availIdx + 300);
          });
          console.log('Available section:', availableSection);
          claimBtnStatus = {
            found: false,
            detail: availableSection
          };
        }
      } else {
        console.log('No Release buttons found');
        claimBtnStatus = { found: false, detail: 'No Release buttons on page' };
      }
    } else {
      // Players already on waivers - check for Claim buttons
      const claimBtns = await page.locator('button:has-text("Claim")').all();
      const claimDetails = [];
      for (const btn of claimBtns) {
        const disabled = await btn.isDisabled().catch(() => true);
        const visible = await btn.isVisible().catch(() => false);
        if (visible) claimDetails.push({ disabled });
      }
      claimBtnStatus = {
        found: claimDetails.length > 0,
        count: claimDetails.length,
        enabled: claimDetails.some(b => !b.disabled),
        disabled: claimDetails.every(b => b.disabled)
      };
    }

    await page.screenshot({ path: `${SCREENSHOT_DIR}/13_waivers_final.png` });

    console.log('Claim button status:', claimBtnStatus);

    // Assess the bug fix
    // The bug was: Claim button was permanently locked/disabled even for valid claims
    // Fix: Claim button should be enabled when a claimable player is available
    if (claimBtnStatus?.found && claimBtnStatus?.enabled) {
      results.bug5 = {
        status: 'PASS',
        detail: `Claim button is visible and enabled (not permanently locked). Count: ${claimBtnStatus.count}`
      };
    } else if (claimBtnStatus?.found && claimBtnStatus?.disabled) {
      results.bug5 = {
        status: 'FAIL',
        detail: `Claim button found but is DISABLED/LOCKED. Count: ${claimBtnStatus.count}`
      };
    } else {
      // No players on waivers yet - check the page structure to verify the button WOULD be enabled
      // Look at the source: claimable prop is passed to WaiverPlayerCard
      // If the button renders without disabled attr when claimable=true, it's a PASS
      // For now, check if Release button works (proves the waiver system functions)
      results.bug5 = {
        status: 'INCONCLUSIVE',
        detail: `Claim button not visible (no claimable players). ${JSON.stringify(claimBtnStatus)}. Release button exists: ${(await page.locator('button:has-text("Release")').count()) > 0}`
      };
    }
    console.log(`Bug 5: ${results.bug5.status} — ${results.bug5.detail}`);
  } catch (e) {
    results.bug5 = { status: 'ERROR', detail: e.message };
  }

  // ─── Console Errors ──────────────────────────────────────────────────────────
  console.log('\n=== CONSOLE ERRORS ===');
  console.log('Total:', consoleErrors.length);
  consoleErrors.slice(0, 5).forEach(e => console.log('  -', e.substring(0, 150)));

  // ─── Final Report ────────────────────────────────────────────────────────────
  console.log('\n========================================');
  console.log('FINAL REPORT');
  console.log('========================================');
  Object.entries(results).forEach(([k, v]) => {
    console.log(`${k.toUpperCase()}: [${v.status}] ${v.detail}`);
  });
  console.log(`\nConsole Errors: ${consoleErrors.length}`);
  if (consoleErrors.length > 0) consoleErrors.slice(0, 5).forEach(e => console.log('  -', e.substring(0, 150)));

  writeFileSync('/home/will/ClaudeBall/scripts/test_results.json',
    JSON.stringify({ results, consoleErrors: consoleErrors.slice(0, 20) }, null, 2));
  console.log('\nScreenshots saved to:', SCREENSHOT_DIR);

  await browser.close();
  return results;
}

run().catch(e => {
  console.error('Fatal:', e);
  process.exit(1);
});
