import { test, expect } from '@playwright/test';

test.describe('Notification Preferences', () => {
  test.beforeEach(async ({ page }) => {
    // Set English locale for consistent test assertions
    await page.addInitScript(() => {
      localStorage.setItem('i18nextLng', 'en');
    });
  });

  test('loads notification preferences page with three toggle switches', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');

    // Page heading should be visible
    await expect(page.getByText('Notification Preferences')).toBeVisible({ timeout: 10000 });

    // Description text
    await expect(page.getByText('Choose which email notifications you want to receive')).toBeVisible();

    // Three toggle switches should be present
    const switches = page.getByRole('switch');
    await expect(switches).toHaveCount(3, { timeout: 10000 });

    // Each preference label should be visible
    await expect(page.getByText('Replies')).toBeVisible();
    await expect(page.getByText('Status Updates')).toBeVisible();
    await expect(page.getByText('Closure')).toBeVisible();

    // Hint text for each preference
    await expect(page.getByText('Get notified when a developer replies to your feedback')).toBeVisible();
    await expect(page.getByText('Get notified when your feedback status changes')).toBeVisible();
    await expect(page.getByText('Get notified when your feedback is closed')).toBeVisible();

    // Back link should be visible
    await expect(page.getByText('Back to My Feedback')).toBeVisible();
  });

  test('toggle a preference and see success confirmation', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');

    // Wait for preferences to load
    await expect(page.getByRole('switch').first()).toBeVisible({ timeout: 10000 });

    // Get the initial state of the first toggle (Replies)
    const repliesToggle = page.getByRole('switch', { name: 'Replies' });
    const initialState = await repliesToggle.getAttribute('aria-checked');

    // Click the toggle
    await repliesToggle.click();

    // Should show success message
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });

    // Toggle state should have changed
    const newState = await repliesToggle.getAttribute('aria-checked');
    expect(newState).not.toBe(initialState);
  });

  test('toggle multiple preferences independently', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');

    // Wait for preferences to load
    await expect(page.getByRole('switch').first()).toBeVisible({ timeout: 10000 });

    // Get all three toggles
    const repliesToggle = page.getByRole('switch', { name: 'Replies' });
    const statusToggle = page.getByRole('switch', { name: 'Status Updates' });
    const closureToggle = page.getByRole('switch', { name: 'Closure' });

    // Record initial states
    const initialReplies = await repliesToggle.getAttribute('aria-checked');
    const initialStatus = await statusToggle.getAttribute('aria-checked');
    const initialClosure = await closureToggle.getAttribute('aria-checked');

    // Toggle Status Updates
    await statusToggle.click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });

    // Wait for success message to disappear (2s timeout in component)
    await page.waitForTimeout(2500);

    // Status Updates should have changed, others should remain the same
    const newStatus = await statusToggle.getAttribute('aria-checked');
    expect(newStatus).not.toBe(initialStatus);
    expect(await repliesToggle.getAttribute('aria-checked')).toBe(initialReplies);
    expect(await closureToggle.getAttribute('aria-checked')).toBe(initialClosure);
  });

  test('preferences persist after page reload', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');

    // Wait for preferences to load
    await expect(page.getByRole('switch').first()).toBeVisible({ timeout: 10000 });

    // Get the Closure toggle and record its current state
    const closureToggle = page.getByRole('switch', { name: 'Closure' });
    const initialState = await closureToggle.getAttribute('aria-checked');

    // Toggle it
    await closureToggle.click();
    await expect(page.getByText('Saved')).toBeVisible({ timeout: 5000 });

    // Wait for save to fully complete
    await page.waitForTimeout(1000);

    // Reload the page
    await page.reload();
    await page.waitForLoadState('domcontentloaded');

    // Wait for preferences to load again
    const closureToggleAfterReload = page.getByRole('switch', { name: 'Closure' });
    await expect(closureToggleAfterReload).toBeVisible({ timeout: 10000 });

    // State should reflect the toggled value (persisted on server)
    const stateAfterReload = await closureToggleAfterReload.getAttribute('aria-checked');
    expect(stateAfterReload).not.toBe(initialState);
  });

  test('back link navigates to history page', async ({ page }) => {
    await page.goto('/notifications');
    await page.waitForLoadState('domcontentloaded');

    // Wait for page to load
    await expect(page.getByText('Notification Preferences')).toBeVisible({ timeout: 10000 });

    // Click back link
    await page.getByText('Back to My Feedback').click();

    // Should navigate to /history
    await page.waitForURL('**/history', { timeout: 5000 });
  });
});
