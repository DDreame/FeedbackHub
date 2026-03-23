import { test, expect, type Page } from '@playwright/test';

// Helper: ensure at least one app exists for testing
async function ensureTestApp(page: Page) {
  await page.goto('/apps');
  await page.waitForLoadState('domcontentloaded');
  const cardCount = await page.locator('.app-card').count();
  if (cardCount > 0) return; // App already exists

  // Create one
  const createBtn = page.getByRole('button', { name: /create app/i });
  if (await createBtn.isVisible()) {
    await createBtn.click();
    await page.waitForTimeout(300);
    await page.getByLabel('App Name').fill('E2E Test App');
    await page.getByRole('button', { name: 'Create' }).click();
    // Wait for the new app card to appear
    await page.waitForSelector('.app-card a[href*="/submit/"]', { timeout: 10000 });
  }
}

test.describe('Feedback Submit Flow', () => {
  test('complete feedback submission with category selection, form fill, and confirmation', async ({ page }) => {
    // Ensure test app exists
    await ensureTestApp(page);

    // Get app key from the apps page
    const appLink = page.locator('.app-card a[href*="/submit/"]').first();
    const appHref = await appLink.getAttribute('href');
    const appKey = appHref?.split('/submit/')[1] || 'demo-app';

    await page.goto(`/submit/${appKey}`);
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
    await page.getByRole('button', { name: 'Back', exact: true }).click();

    // Should return to category selection
    await expect(page.getByText('Please select feedback type:')).toBeVisible({ timeout: 5000 });
  });
});
