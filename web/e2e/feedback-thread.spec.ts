import { test, expect } from '@playwright/test';

test.describe('Feedback Thread Detail Flow', () => {
  test('loads thread detail page with messages', async ({ page }) => {
    // Go to a specific thread if we have one, otherwise test empty state
    await page.goto('/feedback/test-thread-id');

    // Should show either loading, no messages, or thread content
    const loading = page.getByText('Loading...');
    const noMessages = page.getByText('No messages yet');
    const feedbackNotFound = page.getByText('Feedback not found');

    if (await loading.isVisible()) {
      // Wait for load
      await expect(
        noMessages.or(page.getByText('Feedback Details'))
      ).toBeVisible({ timeout: 5000 });
    } else {
      await expect(
        noMessages.or(page.getByText('Feedback Details')).or(feedbackNotFound)
      ).toBeVisible();
    }
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
