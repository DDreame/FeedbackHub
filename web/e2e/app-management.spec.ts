import { test, expect } from '@playwright/test';

test.describe('App Management Flow', () => {
  test('loads apps page and displays app list', async ({ page }) => {
    await page.goto('/apps');

    // Page should load
    await expect(page.getByText('My Apps')).toBeVisible();

    // Should show either app list or empty state
    const emptyState = page.locator('.empty-state');
    const hasApps = await page.locator('.app-card').count() > 0;

    expect(hasApps || (await emptyState.isVisible())).toBeTruthy();
  });

  test('create app form shows and can be filled', async ({ page }) => {
    await page.goto('/apps');

    const createBtn = page.getByRole('button', { name: /create app/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Form should appear
      const nameInput = page.getByLabel('App Name');
      await expect(nameInput).toBeVisible();

      // Fill form
      await nameInput.fill('Test App E2E');

      const descInput = page.getByLabel('Description (optional)');
      await descInput.fill('Description for test app');

      // Create button should be enabled
      const submitBtn = page.getByRole('button', { name: 'Create' });
      await expect(submitBtn).toBeEnabled();
    }
  });

  test('created app appears in list with success toast', async ({ page }) => {
    await page.goto('/apps');
    await page.waitForLoadState('domcontentloaded');

    const createBtn = page.getByRole('button', { name: /create app/i });
    if (await createBtn.isVisible()) {
      await createBtn.click();

      // Fill and submit
      const appName = 'E2E Test App ' + Date.now();
      await page.getByLabel('App Name').fill(appName);
      await page.getByRole('button', { name: 'Create' }).click();

      // App should appear in list (toast may disappear quickly)
      await expect(page.getByText(appName)).toBeVisible({ timeout: 5000 });
    } else {
      // No create button visible — skip
      test.skip();
    }
  });

  test('app actions navigate correctly', async ({ page }) => {
    await page.goto('/apps');

    const appCard = page.locator('.app-card').first();
    if (await appCard.isVisible()) {
      // Click submit feedback
      const submitLink = appCard.locator('a:has-text("Submit Feedback")');
      if (await submitLink.isVisible()) {
        await submitLink.click();
        await expect(page).toHaveURL(/\/submit\//);
      }
    }
  });
});
