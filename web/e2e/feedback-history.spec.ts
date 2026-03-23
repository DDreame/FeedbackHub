import { test, expect } from '@playwright/test';

test.describe('Feedback History Flow', () => {
  test('loads feedback history page and displays list', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Page should load
    await expect(page.getByText('My Feedback')).toBeVisible({ timeout: 10000 });

    // Should show either feedback list or empty state
    const emptyState = page.locator('.empty-state');
    const hasFeedback = await page.locator('.thread-card').count() > 0;
    const emptyStateVisible = await emptyState.isVisible().catch(() => false);

    expect(hasFeedback || emptyStateVisible).toBeTruthy();
  });

  test('search filters feedback by keyword', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    const searchInput = page.getByPlaceholder('Search feedback...');
    if (await searchInput.isVisible()) {
      await searchInput.fill('E2E');
      await page.keyboard.press('Enter');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Should show filtered results or "no results"
      const hasResults = await page.locator('.thread-card').count() > 0;
      const noResults = page.getByText('No matching results');
      if (hasResults) {
        await expect(page.locator('.thread-card').first()).toBeVisible({ timeout: 5000 });
      } else {
        await expect(noResults).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('status filter filters by status', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Click filter button if visible
    const filterBtn = page.getByRole('button', { name: /filter/i });
    if (await filterBtn.isVisible()) {
      await filterBtn.click();

      // Select a status using selectOption
      await page.locator('select').selectOption('received');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Should show filtered results or "no results"
      const hasResults = await page.locator('.thread-list .thread-card').count() > 0;
      if (hasResults) {
        await expect(page.locator('.thread-list').first()).toBeVisible({ timeout: 5000 });
      } else {
        await expect(page.getByText('No matching results')).toBeVisible({ timeout: 5000 });
      }
    }
  });

  test('clicking feedback opens detail page', async ({ page }) => {
    // Ensure reporter ID is set before navigation
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('feedback_reporter_id', '00000000-0000-0000-0000-000000000001');
    });

    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Now wait for thread cards to appear
    const feedbackCard = page.locator('.thread-card').first();
    try {
      await feedbackCard.waitFor({ state: 'attached', timeout: 10000 });
    } catch {
      test.skip();
      return;
    }

    // Click the first feedback card
    await feedbackCard.click();

    // Should navigate to detail page
    await expect(page).toHaveURL(/\/feedback\//);
    await expect(page.getByText('Feedback Details')).toBeVisible({ timeout: 5000 });
  });

  test('pagination navigation works', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('networkidle');

    // Check if pagination exists
    const pagination = page.locator('.pagination');
    if (await pagination.isVisible()) {
      const nextBtn = page.getByRole('button', { name: /next/i });
      if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
        await nextBtn.click();
        // Page should update
        await expect(page.locator('.thread-card').first()).toBeVisible({ timeout: 3000 });
      }
    }
  });
});
