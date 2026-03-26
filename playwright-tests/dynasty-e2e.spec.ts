import { test, expect } from '@playwright/test';

const BASE = 'http://localhost:5173';

async function waitForApp(page: any) {
  await page.goto(BASE);
  await page.waitForSelector('text=Claude Ball', { timeout: 15000 });
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
    await expect(dynastyBtn).toContainText('Dynasty Mode');
  });

  test('setup wizard shows mode selection', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await expect(page).toHaveURL(/dynasty\/new/);
    await expect(page.getByText('Classic Dynasty')).toBeVisible();
    await expect(page.getByText('Living Dynasty')).toBeVisible();
  });

  test('Classic Dynasty goes to settings (skips character)', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.getByText('Classic Dynasty').first().click();
    await expect(page.getByText('Configure your league')).toBeVisible();
    await expect(page.getByText('Casual')).toBeVisible();
  });

  test('Living Dynasty shows character creation', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.locator('button:has-text("Start as Player")').click();
    await expect(page.getByText('Create your player')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Your Player' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Background' })).toBeVisible();
  });

  test('character creation has attributes step', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.locator('button:has-text("Start as Player")').click();

    // Fill name + pick 3 archetypes
    await page.getByPlaceholder('Enter player name...').fill('Scott Elarton');
    await page.getByRole('button', { name: 'Grinder' }).click();
    await page.getByRole('button', { name: 'Clutch Gene' }).click();
    await page.getByRole('button', { name: 'Natural Leader' }).click();
    await page.getByRole('button', { name: 'Next: Set Attributes' }).click();

    // Should see attribute sliders
    await expect(page.getByText('Set your abilities')).toBeVisible();
    await expect(page.getByText('pts remaining')).toBeVisible();
    await expect(page.getByText('Contact').first()).toBeVisible();
    await expect(page.getByText('Power').first()).toBeVisible();
  });

  test('preset selection changes settings', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.locator('button:has-text("Start as GM")').click();
    await expect(page.getByText('162 games').first()).toBeVisible();
    await page.getByRole('button', { name: /casual/i }).click();
    await expect(page.getByText('56 games').first()).toBeVisible();
  });
});

test.describe('Dynasty Mode — Conversation UI', () => {
  test('conversation page renders dialogue', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/conversation`);
    await page.waitForSelector('text=Conversation', { timeout: 15000 });
    await expect(page.getByText('Owner Meeting')).toBeVisible();
    await expect(page.getByText('Close the door')).toBeVisible();
  });

  test('clicking response advances conversation', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/conversation`);
    await page.waitForSelector('text=Your Response', { timeout: 15000 });
    await page.getByRole('button', { name: /I have a plan/ }).click();
    await expect(page.getByText('I have a plan')).toBeVisible();
  });

  test('choices show effects', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/conversation`);
    await page.waitForSelector('text=Your Response', { timeout: 15000 });
    await expect(page.getByText('+3 Affinity')).toBeVisible();
    await expect(page.getByText('+5 Respect')).toBeVisible();
  });
});

test.describe('Dynasty Mode — Life Events', () => {
  test('shows pending events', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/life-events`);
    await page.waitForSelector('text=Life Events', { timeout: 15000 });
    await expect(page.getByText('4 pending')).toBeVisible();
    await expect(page.getByText('Nike Endorsement Offer')).toBeVisible();
  });

  test('choosing option resolves event', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/life-events`);
    await page.waitForSelector('text=Nike Endorsement Offer', { timeout: 15000 });
    await page.getByRole('button', { name: /Sign the deal/ }).click();
    await page.waitForTimeout(500);
    await expect(page.getByText('3 pending')).toBeVisible({ timeout: 5000 });
  });

  test('shows financial and rep effects', async ({ page }) => {
    await page.goto(`${BASE}/dynasty/life-events`);
    await page.waitForSelector('text=Nike Endorsement Offer', { timeout: 15000 });
    await expect(page.getByText('+$2000K')).toBeVisible();
    await expect(page.getByText('+8 Fan Rep')).toBeVisible();
  });
});

test.describe('Dynasty Mode — Full Flow', () => {
  test('start Classic Dynasty → franchise loads', async ({ page }) => {
    await waitForApp(page);
    await page.getByTestId('dynasty-mode-btn').click();
    await page.locator('button:has-text("Start as GM")').click();
    await page.getByRole('button', { name: 'Casual' }).click();

    // Go to team selection
    await page.getByRole('button', { name: /Choose Team/ }).click();
    await page.waitForTimeout(500);

    // Pick first available team (Austin Thunderhawks)
    await page.locator('button').filter({ hasText: 'Austin' }).first().click();

    // Start
    await page.getByRole('button', { name: /Start Classic Dynasty/ }).click();
    await page.waitForURL(/franchise/, { timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Dashboard' }).first()).toBeVisible({ timeout: 10000 });
  });
});
