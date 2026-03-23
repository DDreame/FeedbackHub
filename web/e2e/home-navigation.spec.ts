import { test, expect } from '@playwright/test';

test.describe('Home Page Navigation', () => {
  test('home page loads with app selection', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // Title should be visible
    await expect(page.locator('h1').first()).toBeVisible({ timeout: 10000 });

    // App cards (surface-card) or feature cards should show
    const hasApps = await page.locator('.surface-card').count() > 0;
    expect(hasApps).toBeTruthy();
  });

  test('navigates to submit feedback from home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    // With 2+ apps, home page shows .surface-card grid with submit links
    const submitLink = page.locator('.surface-card a[href*="/submit/"]').first();
    if (await submitLink.isVisible()) {
      await submitLink.click();
      await expect(page).toHaveURL(/\/submit\//);
    } else {
      test.skip();
    }
  });

  test('navigates to history from home', async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');

    const historyLink = page.locator('a[href="/history"]').first();
    if (await historyLink.isVisible()) {
      await historyLink.click();
      await expect(page).toHaveURL('/history');
    } else {
      test.skip();
    }
  });
});
