# Deep Audit Round 3 — Full Lifecycle + Interaction Testing

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sim a complete season through playoffs and offseason, test the dynasty setup wizard end-to-end, click-test every player interaction, verify all 18 previous fixes, and fix everything found — repeating until zero issues remain.

**Architecture:** Each task uses Playwright MCP browser tools to interact with the live app at `http://localhost:5173`. Tasks are ordered by game flow: fresh franchise → full season sim → playoffs → offseason → dynasty wizard → interaction testing → regression verification. Every bug found is fixed inline and re-verified visually before moving on.

**Tech Stack:** Playwright MCP browser tools, React 19, TypeScript, Zustand/IndexedDB

---

## Context

### Previous Fixes (18 bugs across 2 rounds)
These MUST still work on fresh data:
1. Stats show current-season only (not multi-season cumulative)
2. Morale varies from 60 (not frozen)
3. Pitcher IP realistic (~6 IP/start, not 225 IP in 60 games)
4. WAR tier badges differentiate (MVP/All-Star/Solid/etc.)
5. Hit streaks realistic (no 161-game streaks)
6. Chemistry factors populate after sufficient games
7. Highlights: Streaks/Historic count > 0
8. Mobile roster horizontal scroll works
9. Achievement toast fires once only
10. ELIM badge has spacing from team name
11. achieveUnlock TDZ error fixed
12. BOX buttons navigate to box score (not home)
13. Score display: user score first, opponent second
14. Injury banner matches Injury Report page
15. Award stat shows correct HR+RBI value

### Dev Server
- Must be running: `http://localhost:5173`
- Start: `npm run dev` from `/home/will/ClaudeBall/`

### Key Overlay Dismissal Pattern
After any sim action, dismiss overlays with:
```js
await page.evaluate(() => {
  for (const text of ['View Results', 'Dismiss', '✕ Dismiss', 'Continue', 'OK', 'Close']) {
    const btn = [...document.querySelectorAll('button')].find(b => b.textContent?.includes(text));
    if (btn) btn.click();
  }
  const overlay = document.querySelector('.fixed.inset-0');
  if (overlay) { const btn = overlay.querySelector('button'); if (btn) btn.click(); }
});
```

---

### Task 1: Fresh Franchise — Full Season Sim Through Playoffs

Create a brand new franchise. Sim an ENTIRE season (162 games). Navigate through playoffs. Verify everything works end-to-end.

- [ ] **Step 1: Create fresh franchise**

Navigate to `http://localhost:5173`. Click "New Franchise" (NOT Dynasty Mode, NOT Continue). Select Austin. Start Season. Verify dashboard loads at Day 1.

- [ ] **Step 2: Sim to mid-season (Day 90)**

Click "Sim 30 Days" 3 times, dismissing overlays after each. Take screenshot of dashboard. Verify:
- Record is reasonable (e.g., 40-50 wins, not 0-90 or 90-0)
- Day counter advanced correctly
- No crashes or blank pages

- [ ] **Step 3: Check mid-season stats**

Navigate to `/franchise/leaders`. Verify:
- Top batter PA is 350-450 range (90 games × ~4.4 = ~396)
- No 1000+ PA values (regression check for fix #1)
- Take screenshot

Navigate to `/franchise/war`. Verify:
- Pitcher IP is 80-140 range (not 400+, regression check for fix #3)
- WAR badges show different tiers (not all MVP, regression check for fix #4)
- Take screenshot

Navigate to `/franchise/morale`. Verify:
- NOT all players at 60 (regression check for fix #2)
- Some variation in morale values
- Take screenshot

- [ ] **Step 4: Sim to end of season (Day 183)**

Click "Finish Season" or "Sim 30 Days" repeatedly until season ends. Dismiss all overlays. Verify:
- Season end message/overlay appears
- "Go to Playoffs" button appears (if team qualifies)
- Take screenshot

- [ ] **Step 5: Navigate through playoffs**

Click "Go to Playoffs" (or navigate to `/franchise/playoffs`). Verify:
- Playoff bracket renders with correct teams
- Matchups show seeding

Click through each playoff round:
- Wild Card: Click "Sim Wild Card" → verify results
- Division Series: Click "Sim Division Series" → verify results
- Championship Series: Click "Sim Championship" → verify results
- World Series: Click "Sim World Series" → verify results

Take screenshot after each round. Check for:
- Crashes during transitions
- Blank/empty bracket after sim
- Console errors

- [ ] **Step 6: Enter offseason**

After playoffs end, verify offseason hub loads. Navigate to `/franchise/offseason`. Check:
- Free agency list populates
- Draft is accessible
- Offseason actions are available
- Season review/awards show correct data
- Take screenshot

- [ ] **Step 7: Fix any bugs found**

For each bug: read source, fix, re-verify visually.

- [ ] **Step 8: Commit**

```bash
git add -u
git commit -m "fix: resolve full-season lifecycle bugs (playoffs, offseason transitions)"
git push origin main
```

---

### Task 2: Dynasty Setup Wizard — Living Dynasty End-to-End

Test the complete Living Dynasty character creation flow. This is the part that failed in previous crawlers (kept clicking "College Star" in a loop).

- [ ] **Step 1: Navigate to Dynasty Mode**

Go to `http://localhost:5173`. Click the Dynasty Mode button (test-id: `dynasty-mode-btn`).

- [ ] **Step 2: Select Living Dynasty mode**

On the setup page, look for "Living Dynasty" or the RPG career option. Click it. Take screenshot of what appears.

- [ ] **Step 3: Walk through character creation**

The setup wizard has steps: mode → character → attributes → settings → draft → team. For each step:
- Take screenshot
- Identify all inputs/buttons
- Fill in name field if present
- Select background (High School, College Star, etc.)
- Allocate attribute points if present
- Click the correct "Next" button (NOT archetype cards)
- Verify step advances

Document the exact button text/selectors for each step so future crawlers can automate this.

- [ ] **Step 4: Complete team selection and start**

Select a team. Click "Start" or equivalent. Verify:
- Navigates to `/franchise` dashboard
- Dynasty-specific sidebar items appear (Hot Stove Inbox, Life Events, etc.)
- Take screenshot

- [ ] **Step 5: Verify dynasty pages load with data**

Navigate to each dynasty page:
- `/dynasty/inbox` — messages render?
- `/dynasty/life-events` — events display?
- `/dynasty/prestige` — prestige score shows?
- `/dynasty/owner` — org chart renders?
Take screenshots of each.

- [ ] **Step 6: Fix any bugs found**

- [ ] **Step 7: Commit**

```bash
git add -u
git commit -m "fix: resolve dynasty setup wizard and dynasty page bugs"
git push origin main
```

---

### Task 3: Player Interaction Click-Through

Click on every interactive element on the roster, trade, and contract pages. Verify popups, modals, and navigation work.

- [ ] **Step 1: Roster player detail popups**

Navigate to `/franchise/roster`. For the first 5 players in the table:
- Click the player row
- Verify a detail panel/popup appears with batting stats
- Check stats are populated (not all zeros)
- Check the popup dismisses when clicking away or pressing X
- Take screenshot of at least one open popup

- [ ] **Step 2: Roster action buttons**

For one player on the roster:
- Click "Extend" (if available on an expiring contract player) → verify contract dialog appears
- Click "Trade" → verify navigates to trade page with player pre-selected
- Click "Cmp" (compare) → verify navigates to compare page
- Take screenshots of each interaction result

- [ ] **Step 3: Trade Machine flow**

Navigate to `/franchise/trade-machine`:
- Select a team from the dropdown
- Add a player from your team
- Add a player from the other team
- Verify trade value analysis appears
- Click "Evaluate Trade" or equivalent
- Take screenshot of completed trade evaluation

- [ ] **Step 4: Lineup Editor interactions**

Navigate to `/franchise/lineup-editor`:
- Verify 9 lineup spots filled with player names
- Try clicking to move a player (if drag-drop or button-based)
- Verify the lineup order changes visually
- Take screenshot

- [ ] **Step 5: Create Player flow**

Navigate to `/franchise/create-player`:
- Fill in player name
- Select position
- Set ratings (if sliders/inputs available)
- Click Create/Save
- Verify player appears on roster
- Take screenshot

- [ ] **Step 6: Fix any bugs found**

- [ ] **Step 7: Commit**

```bash
git add -u
git commit -m "fix: resolve player interaction and modal bugs"
git push origin main
```

---

### Task 4: Console Error Sweep + React Hooks Audit

Systematically check for console errors across the entire app, especially after interactions.

- [ ] **Step 1: Navigate to 15 pages, check console after each**

For each page: navigate, wait 3 seconds, call `browser_console_messages`, log any errors.

Pages to check:
```
/franchise, /franchise/roster, /franchise/standings, /franchise/leaders,
/franchise/war, /franchise/trade, /franchise/trade-machine, /franchise/awards,
/franchise/morale, /franchise/schedule, /franchise/game-log, /franchise/depth-chart,
/dynasty/inbox, /dynasty/prestige, /dynasty/owner
```

- [ ] **Step 2: Click interactions and check console**

On Dashboard: click "Advance Day", check console
On Roster: click a player row, check console
On Trade Machine: add a player, check console
On Lineup Editor: interact, check console

Look specifically for:
- `Rendered fewer hooks than expected` (React hooks order violation)
- `Cannot access X before initialization` (TDZ errors)
- `TypeError: Cannot read properties of null/undefined`
- Any uncaught exceptions

- [ ] **Step 3: Fix all critical/major console errors**

For each error:
1. Identify the source file from the stack trace
2. Read the file
3. Fix the root cause (hooks order, null guards, etc.)
4. Re-verify the page works

- [ ] **Step 4: Commit**

```bash
git add -u
git commit -m "fix: resolve console errors and React hooks violations"
git push origin main
```

---

### Task 5: Regression Verification — All 18 Previous Fixes

Create a fresh franchise, sim 60 days, and systematically verify every previous fix still works.

- [ ] **Step 1: Create fresh franchise and sim 60 days**

New franchise → Austin → Sim 30 Days × 2 → dismiss overlays.

- [ ] **Step 2: Verify each fix (take screenshots as evidence)**

| # | Check | Page | Expected |
|---|-------|------|----------|
| 1 | Stats current-season | `/franchise/leaders` | Top PA: 200-350, no 1000+ |
| 2 | Morale varies | `/franchise/morale` | Not all 60, some variation |
| 3 | Pitcher IP realistic | `/franchise/war` | Top IP: 60-130, no 400+ |
| 4 | WAR tiers | `/franchise/war` | Multiple badge types visible |
| 5 | Hit streaks | `/franchise/hot-cold` | Longest < 30, no 60+ |
| 6 | Chemistry | `/franchise/morale` | Factors populated (not "sim more") |
| 7 | Highlights | `/franchise/highlights` | Streaks > 0 |
| 8 | Mobile scroll | `/franchise/roster` at 375px | Table scrollable |
| 9 | Toast once | `/franchise/season-story` ×2 | Toast only on first visit |
| 10 | ELIM spacing | `/franchise/standings` | Space before ELIM badge |
| 11 | No TDZ crash | Navigate away and back to `/franchise` | No crash |
| 12 | BOX buttons | Click BOX on dashboard | Opens box score page |
| 13 | Score format | Dashboard Recent Results | User score first |
| 14 | Injury sync | Dashboard vs `/franchise/injuries` | Consistent data |
| 15 | Award stats | `/franchise/awards` | HR+RBI matches actual sum |

- [ ] **Step 3: Report pass/fail table**

Create a clear pass/fail table with evidence (screenshot filenames, actual values observed).

- [ ] **Step 4: Fix any regressions found**

- [ ] **Step 5: Commit**

```bash
git add -u
git commit -m "fix: resolve regressions found during verification"
git push origin main
```

---

### Task 6: Final Build + Push

- [ ] **Step 1: Run unit tests**

```bash
npm test
```
Expected: All 308+ tests pass.

- [ ] **Step 2: TypeScript build check**

```bash
npx tsc --noEmit
```
Expected: Zero errors.

- [ ] **Step 3: Production build**

```bash
npm run build
```
Expected: Clean build.

- [ ] **Step 4: Push to GitHub**

```bash
git push origin main
```

---

## Execution Notes

- **Task 1 is the most important** — nobody has ever simmed a complete season through playoffs into offseason in this audit. That's where the nastiest bugs hide (state transitions, bracket rendering, season reset).
- **Task 2 (dynasty wizard)** has been broken in every previous test attempt. Getting this to work end-to-end would be a major win.
- **Task 3 (click-through)** catches bugs that page-load crawlers miss entirely — broken modals, dead buttons, stale state.
- **Task 5 (regressions)** is non-negotiable. Fixes that don't survive a fresh franchise aren't real fixes.
- Use `page.evaluate()` for overlay dismissal (NOT Playwright locator clicks — those hang on intercepted elements).
- The dev server must be running on port 5173 for ALL tasks.
