import { test, expect } from '@playwright/test';

test.describe('Feedback Submit Flow', () => {
  test('complete feedback submission with category selection, form fill, and confirmation', async ({ page }) => {
    await page.goto('/submit/demo-app');
    await page.waitForLoadState('domcontentloaded');

    // Step 1: Category selection
    await expect(page.getByText('Please select feedback type:')).toBeVisible({ timeout: 10000 });
    await page.getByText('Encountered a Problem').click();

    // Step 2: Fill form
    const textarea = page.getByPlaceholder('Please describe your issue or suggestion in detail...');
    await expect(textarea).toBeVisible({ timeout: 5000 });
    await textarea.fill('This is a test feedback submission\nSecond line of description');

    // Submit
    await page.getByRole('button', { name: 'Submit Feedback' }).click();

    // Step 3: Confirmation page
    await expect(page.getByText('Thank you for your feedback')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(/FB-/)).toBeVisible({ timeout: 5000 });
  });

  test('shows validation error when submitting empty form', async ({ page }) => {
    await page.goto('/submit/demo-app');
    await page.waitForLoadState('domcontentloaded');

    // Select category
    await page.getByText('Have a Suggestion').click();

    // Try to submit empty
    await page.getByRole('button', { name: 'Submit Feedback' }).click();

    // Should stay on form (content required)
    const textarea = page.getByPlaceholder('Please describe your issue or suggestion in detail...');
    await expect(textarea).toBeVisible({ timeout: 5000 });
  });

  test('back button returns to category selection', async ({ page }) => {
    await page.goto('/submit/demo-app');
    await page.waitForLoadState('domcontentloaded');

    // Select category
    await page.getByText('Have a Question').click();

    // Fill some content
    const textarea = page.getByPlaceholder('Please describe your issue or suggestion in detail...');
    await textarea.fill('Test content');

    // Click back
    await page.getByRole('button', { name: 'Back' }).click();

    // Should return to category selection
    await expect(page.getByText('Please select feedback type:')).toBeVisible({ timeout: 5000 });
  });
});
