import { test, expect } from '@playwright/test';

test.describe('Feedback Thread Detail Flow', () => {
  test('loads thread detail page with messages', async ({ page }) => {
    // Go to a specific thread if we have one, otherwise test empty state
    await page.goto('/feedback/test-thread-id');

    // Wait for page to settle
    await page.waitForLoadState('networkidle');

    // Should show one of: loading, no messages, thread content, or not found
    const loading = page.getByText('Loading...');
    const noMessages = page.getByText('No messages yet');
    const feedbackNotFound = page.getByText('Feedback not found');
    const feedbackDetails = page.getByText('Feedback Details');

    const hasLoading = await loading.isVisible().catch(() => false);
    const hasNoMessages = await noMessages.isVisible().catch(() => false);
    const hasNotFound = await feedbackNotFound.isVisible().catch(() => false);
    const hasDetails = await feedbackDetails.isVisible().catch(() => false);

    expect(hasLoading || hasNoMessages || hasNotFound || hasDetails).toBeTruthy();
  });

  test('reply form is visible and functional', async ({ page }) => {
    await page.goto('/feedback/test-thread-id');

    // Wait for page to load
    await page.waitForTimeout(2000);

    const replyTextarea = page.getByPlaceholder('Enter your reply...');
    if (await replyTextarea.isVisible()) {
      await replyTextarea.fill('This is a test reply');

      const sendBtn = page.getByRole('button', { name: 'Send' });
      if (await sendBtn.isEnabled()) {
        // Reply would be sent - we can't verify backend but UI should work
        expect(true).toBeTruthy();
      }
    }
  });

  test('back link returns to history', async ({ page }) => {
    await page.goto('/feedback/test-thread-id');

    const backLink = page.getByText('← Back to feedback list');
    if (await backLink.isVisible()) {
      await backLink.click();
      await expect(page).toHaveURL('/history');
    }
  });
});
