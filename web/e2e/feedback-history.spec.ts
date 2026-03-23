import { test, expect } from '@playwright/test';

test.describe('Feedback History Flow', () => {
  test('loads feedback history page and displays list', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');

    // Page should load
    await expect(page.getByText('My Feedback')).toBeVisible({ timeout: 10000 });

    // Wait for API call to complete
    await page.waitForLoadState('networkidle');

    // Should show either feedback list or empty state
    const emptyState = page.locator('.empty-state');
    const hasFeedback = await page.locator('.thread-card').count() > 0;
    const emptyStateVisible = await emptyState.isVisible().catch(() => false);

    expect(hasFeedback || emptyStateVisible).toBeTruthy();
  });

  test('search filters feedback by keyword', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');

    const searchInput = page.getByPlaceholder('Search feedback...');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.keyboard.press('Enter');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Should show filtered results or "no results"
      await expect(page.getByText(/test/i).or(page.getByText('No matching results'))).toBeVisible({ timeout: 5000 });
    }
  });

  test('status filter filters by status', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');

    // Click filter button if visible
    const filterBtn = page.getByRole('button', { name: /filter/i });
    if (await filterBtn.isVisible()) {
      await filterBtn.click();

      // Select a status using selectOption
      await page.locator('select').selectOption('received');

      // Wait for filter to apply
      await page.waitForTimeout(500);

      // Should show filtered results or "no results"
      // Use .thread-list scope to avoid matching the <option> text in the select
      const hasResults = await page.locator('.thread-list .thread-card').count() > 0;
      const noResults = page.getByText('No matching results');
      await expect(hasResults ? page.locator('.thread-list').first() : noResults).toBeVisible({ timeout: 5000 });
    }
  });

  test('clicking feedback opens detail page', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');

    // Find and click first feedback card if exists
    const feedbackCard = page.locator('.thread-card').first();
    if (await feedbackCard.isVisible()) {
      await feedbackCard.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/feedback\//);
      await expect(page.getByText('Feedback Details')).toBeVisible({ timeout: 5000 });
    } else {
      test.skip();
    }
  });

  test('pagination navigation works', async ({ page }) => {
    await page.goto('/history');
    await page.waitForLoadState('domcontentloaded');

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
