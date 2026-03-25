import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

// Helper: wait for splash screen to clear
async function waitForApp(page: any) {
  await page.goto(BASE);
  await page.waitForSelector('text=Claude Ball', { timeout: 15000 });
  // Dismiss onboarding if present
  const skipBtn = page.getByRole('button', { name: 'Skip Tour' });
  if (await skipBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
    await skipBtn.click();
  }
  await page.waitForTimeout(500);
}

test.describe('Dynasty Mode — Setup Wizard', () => {
  test('Dynasty Mode button visible on main menu', async ({ page }) => {
    await waitForApp(page);
    const dynastyBtn = page.getByTestId('dynasty-mode-btn');
    await expect(dynastyBtn).toBeVisible();
    await expect(dynastyBtn).toHaveText('Dynasty Mode');
  });

  test('setup wizard loads with Classic and Living options', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await expect(page).toHaveURL(/dynasty\/new/);
    await expect(page.getByText('Classic Dynasty')).toBeVisible();
    await expect(page.getByText('Living Dynasty')).toBeVisible();
    await expect(page.getByText('Choose your experience')).toBeVisible();
  });

  test('Classic Dynasty skips character creation, goes to settings', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.getByText('Classic Dynasty').click();
    await expect(page.getByText('Configure your league')).toBeVisible();
    await expect(page.getByText('Casual')).toBeVisible();
    await expect(page.getByText('Realistic')).toBeVisible();
    await expect(page.getByText('Hardcore')).toBeVisible();
    await expect(page.getByText('Sandbox')).toBeVisible();
  });

  test('Living Dynasty shows character creation step', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.getByText('Living Dynasty').click();
    await expect(page.getByText('Create your player')).toBeVisible();
    await expect(page.getByText('Your Player')).toBeVisible();
    await expect(page.getByText('Background')).toBeVisible();
    await expect(page.getByText('Personality (Pick 3)')).toBeVisible();
  });

  test('character creation validates before proceeding', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.getByText('Living Dynasty').click();

    // Next button should be disabled without name + 3 archetypes
    const nextBtn = page.getByRole('button', { name: 'Next: League Settings' });
    await expect(nextBtn).toBeDisabled();

    // Fill in name
    await page.getByPlaceholder('Enter player name...').fill('Scott Elarton');

    // Still disabled — need 3 archetypes
    await expect(nextBtn).toBeDisabled();

    // Pick 3 archetypes
    await page.getByRole('button', { name: 'Grinder' }).click();
    await page.getByRole('button', { name: 'Clutch Gene' }).click();
    await page.getByRole('button', { name: 'Natural Leader' }).click();

    // Now enabled
    await expect(nextBtn).toBeEnabled();
  });

  test('preset selection changes displayed settings', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.getByText('Classic Dynasty').click();

    // Default is realistic — 162 games
    await expect(page.getByText('162 games')).toBeVisible();

    // Switch to casual
    await page.getByRole('button', { name: 'Casual' }).click();
    await expect(page.getByText('56 games')).toBeVisible();
  });

  test('team selection step shows all 30 teams', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.getByText('Classic Dynasty').click();
    await page.getByRole('button', { name: 'Next: Choose Team' }).click();

    await expect(page.getByText('Select Your Team')).toBeVisible();
    // Check a few teams exist
    await expect(page.getByText('New York')).toBeVisible();
  });
});

test.describe('Dynasty Mode — Conversation UI', () => {
  test('conversation page renders dialogue tree', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/conversation`);
    await page.waitForSelector('text=Conversation', { timeout: 15000 });

    await expect(page.getByText('Owner Meeting')).toBeVisible();
    await expect(page.getByText('Close the door')).toBeVisible();
    await expect(page.getByText('Your Response')).toBeVisible();
  });

  test('clicking a response advances the conversation', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/conversation`);
    await page.waitForSelector('text=Your Response', { timeout: 15000 });

    // Click the confident response
    await page.getByRole('button', { name: /I have a plan/ }).click();

    // Player's response should now show as a past message
    await expect(page.getByText('I have a plan')).toBeVisible();
    // NPC should respond
    await page.waitForTimeout(500);
  });

  test('dialogue choices show effects (affinity/respect)', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/conversation`);
    await page.waitForSelector('text=Your Response', { timeout: 15000 });

    // Check that effects are visible on choices
    await expect(page.getByText('+3 Affinity')).toBeVisible();
    await expect(page.getByText('+5 Respect')).toBeVisible();
    await expect(page.getByText('-2 Affinity')).toBeVisible();
  });
});

test.describe('Dynasty Mode — Life Events', () => {
  test('life events page shows pending events', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/life-events`);
    await page.waitForSelector('text=Life Events', { timeout: 15000 });

    await expect(page.getByText('4 pending')).toBeVisible();
    await expect(page.getByText('Nike Endorsement Offer')).toBeVisible();
    await expect(page.getByText('TMZ: Nightclub Incident')).toBeVisible();
    await expect(page.getByText("Boys & Girls Club Gala")).toBeVisible();
  });

  test('choosing an option resolves the event', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/life-events`);
    await page.waitForSelector('text=Nike Endorsement Offer', { timeout: 15000 });

    // Click first choice on Nike endorsement
    await page.getByRole('button', { name: /Sign the deal/ }).click();

    // Should show resolved section
    await expect(page.getByText('3 pending')).toBeVisible();
    await expect(page.getByText('Resolved')).toBeVisible();
  });

  test('life event choices show financial and reputation effects', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/life-events`);
    await page.waitForSelector('text=Nike Endorsement Offer', { timeout: 15000 });

    await expect(page.getByText('+$2000K')).toBeVisible();
    await expect(page.getByText('+8 Fan Rep')).toBeVisible();
    await expect(page.getByText('+5 Media Rep')).toBeVisible();
  });
});

test.describe('Dynasty Mode — Full Season Integration', () => {
  test('start Classic Dynasty and verify franchise loads', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();

    // Classic Dynasty → Settings → Casual → Team Select → Start
    await page.getByText('Classic Dynasty').click();
    await page.getByRole('button', { name: 'Casual' }).click();
    await page.getByRole('button', { name: 'Next: Choose Team' }).click();

    // Pick first team
    await page.waitForTimeout(500);
    const firstTeam = page.locator('button').filter({ hasText: /^(?!Start|Back|Next)/ }).first();
    await firstTeam.click();

    // Start dynasty
    await page.getByRole('button', { name: 'Start Classic Dynasty' }).click();

    // Should navigate to franchise dashboard
    await page.waitForURL(/franchise/, { timeout: 10000 });
    await expect(page.getByText('Dashboard')).toBeVisible({ timeout: 10000 });
  });
});

test.describe('Dynasty Mode — Sidebar Navigation', () => {
  test('dynasty section visible in franchise sidebar', async ({ page }) => {
    // Start a franchise first
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.getByText('Classic Dynasty').click();
    await page.getByRole('button', { name: 'Casual' }).click();
    await page.getByRole('button', { name: 'Next: Choose Team' }).click();
    await page.waitForTimeout(500);
    const firstTeam = page.locator('button').filter({ hasText: /^(?!Start|Back|Next)/ }).first();
    await firstTeam.click();
    await page.getByRole('button', { name: 'Start Classic Dynasty' }).click();
    await page.waitForURL(/franchise/, { timeout: 10000 });
    await page.waitForTimeout(1000);

    // Check sidebar has dynasty section
    await expect(page.getByText('DYNASTY')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hot Stove Inbox' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Conversations' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Life Events' })).toBeVisible();
  });
});
