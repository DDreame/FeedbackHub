import { test, expect } from '@playwright/test';

test.describe('Home Page Navigation', () => {
  test('home page loads with app selection', async ({ page }) => {
    await page.goto('/');

    // Title should be visible
    await expect(page.getByText('FeedBack System')).toBeVisible();

    // App cards or empty state should show
    const hasApps = await page.locator('.app-card').count() > 0;
    const selectPrompt = page.getByText('Please select an app');
    const emptyState = page.locator('.empty-state');

    expect(hasApps || (await selectPrompt.isVisible()) || (await emptyState.isVisible())).toBeTruthy();
  });

  test('navigates to submit feedback from home', async ({ page }) => {
    await page.goto('/');

    const appCard = page.locator('.app-card').first();
    const submitBtn = page.locator('a:has-text("Submit Feedback")').first();

    if (await appCard.isVisible()) {
      await submitBtn.click();
      await expect(page).toHaveURL(/\/submit\//);
    }
  });

  test('navigates to history from home', async ({ page }) => {
    await page.goto('/');

    const historyBtn = page.locator('a:has-text("View History")').first();
    if (await historyBtn.isVisible()) {
      await historyBtn.click();
      await expect(page).toHaveURL('/history');
    }
  });
});
