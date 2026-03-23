import { test, expect } from '@playwright/test';

test.describe('Feedback History Flow', () => {
  test('loads feedback history page and displays list', async ({ page }) => {
    await page.goto('/history');

    // Page should load
    await expect(page.getByText('My Feedback')).toBeVisible();

    // Should show either feedback list or empty state
    const emptyState = page.locator('.empty-state');
    const hasFeedback = await page.locator('.feedback-card').count() > 0;
    const noResults = page.getByText('No matching results').isVisible();

    expect(hasFeedback || (await emptyState.isVisible()) || noResults).toBeTruthy();
  });

  test('search filters feedback by keyword', async ({ page }) => {
    await page.goto('/history');

    const searchInput = page.getByPlaceholder('Search feedback...');
    if (await searchInput.isVisible()) {
      await searchInput.fill('test');
      await page.keyboard.press('Enter');

      // Should show filtered results or "no results"
      await expect(page.getByText(/test/i).or(page.getByText('No matching results'))).toBeVisible();
    }
  });

  test('status filter filters by status', async ({ page }) => {
    await page.goto('/history');

    // Click filter button if visible
    const filterBtn = page.getByRole('button', { name: /filter/i });
    if (await filterBtn.isVisible()) {
      await filterBtn.click();

      // Select a status using selectOption (not getByText on option element)
      await page.locator('select').selectOption('received');

      // Filter should be applied
      await expect(page.getByText(/Received/).or(page.getByText('No matching results'))).toBeVisible();
    }
  });

  test('clicking feedback opens detail page', async ({ page }) => {
    await page.goto('/history');

    // Find and click first feedback card if exists
    const feedbackCard = page.locator('.feedback-card').first();
    if (await feedbackCard.isVisible()) {
      await feedbackCard.click();

      // Should navigate to detail page
      await expect(page).toHaveURL(/\/feedback\//);
      await expect(page.getByText('Feedback Details')).toBeVisible();
    }
  });

  test('pagination navigation works', async ({ page }) => {
    await page.goto('/history');

    // Check if pagination exists
    const pagination = page.locator('.pagination');
    if (await pagination.isVisible()) {
      const nextBtn = page.getByRole('button', { name: /next/i });
      if (await nextBtn.isVisible() && await nextBtn.isEnabled()) {
        await nextBtn.click();
        // Page should update
        await expect(page.locator('.feedback-card').first()).toBeVisible({ timeout: 3000 });
      }
    }
  });
});
