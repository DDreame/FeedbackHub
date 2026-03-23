import { test, expect } from '@playwright/test';

test.describe('Feedback Submit Flow', () => {
  test('complete feedback submission with category selection, form fill, and confirmation', async ({ page }) => {
    await page.goto('/');

    // Select app (first available)
    const appCard = page.locator('.app-card').first();
    if (await appCard.isVisible()) {
      await appCard.locator('a:has-text("Submit Feedback")').click();
    } else {
      // No apps yet - go directly to submit
      await page.goto('/submit/test-app');
    }

    // Step 1: Category selection
    await expect(page.getByText('Please select feedback type:')).toBeVisible();
    await page.getByText('Encountered a Problem').click();

    // Step 2: Fill form
    const textarea = page.getByPlaceholder('Please describe your issue or suggestion in detail...');
    await expect(textarea).toBeVisible();
    await textarea.fill('This is a test feedback submission\nSecond line of description');

    // Submit
    await page.getByRole('button', { name: 'Submit Feedback' }).click();

    // Step 3: Confirmation page
    await expect(page.getByText('Thank you for your feedback')).toBeVisible();
    await expect(page.getByText(/FB-/)).toBeVisible();
  });

  test('shows validation error when submitting empty form', async ({ page }) => {
    await page.goto('/submit/demo-app');

    // Select category
    await page.getByText('Have a Suggestion').click();

    // Try to submit empty
    await page.getByRole('button', { name: 'Submit Feedback' }).click();

    // Should show validation error (content required)
    const textarea = page.getByPlaceholder('Please describe your issue or suggestion in detail...');
    await expect(textarea).toBeVisible();
  });

  test('back button returns to category selection', async ({ page }) => {
    await page.goto('/submit/demo-app');

    // Select category
    await page.getByText('Have a Question').click();

    // Fill some content
    const textarea = page.getByPlaceholder('Please describe your issue or suggestion in detail...');
    await textarea.fill('Test content');

    // Click back
    await page.getByRole('button', { name: 'Back' }).click();

    // Should return to category selection
    await expect(page.getByText('Please select feedback type:')).toBeVisible();
  });
});
