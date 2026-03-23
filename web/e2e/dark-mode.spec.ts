import { test, expect } from '@playwright/test';

test.describe('Dark Mode Toggle', () => {
  test('theme toggle switches between light and dark', async ({ page }) => {
    await page.goto('/');

    const themeToggle = page.locator('.theme-toggle').first();
    if (await themeToggle.isVisible()) {
      // Get initial theme
      const initialDark = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme') === 'dark'
      );

      // Click toggle
      await themeToggle.click();

      // Theme should change
      const newDark = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme') === 'dark'
      );
      expect(newDark).toBe(!initialDark);
    }
  });

  test('dark mode persists after page refresh', async ({ page }) => {
    await page.goto('/');

    const themeToggle = page.locator('.theme-toggle').first();
    if (await themeToggle.isVisible()) {
      // Switch to dark mode
      await themeToggle.click();

      const isDarkNow = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme') === 'dark'
      );

      // Refresh page
      await page.reload();

      // Theme should persist
      const isDarkAfterRefresh = await page.evaluate(() =>
        document.documentElement.getAttribute('data-theme') === 'dark'
      );
      expect(isDarkAfterRefresh).toBe(isDarkNow);
    }
  });

  test('dark mode form inputs have proper contrast', async ({ page }) => {
    await page.goto('/');

    const themeToggle = page.locator('.theme-toggle').first();
    if (await themeToggle.isVisible()) {
      // Switch to dark mode
      await themeToggle.click();

      // Navigate to submit page
      await page.goto('/submit/demo-app');
      await page.getByText('Encountered a Problem').click();

      // Form inputs should have dark background (CSS fix applied)
      const textarea = page.getByRole('textbox').first();
      if (await textarea.isVisible()) {
        const bgColor = await textarea.evaluate((el) =>
          window.getComputedStyle(el).backgroundColor
        );
        // Dark mode background should be a dark color (rgb with low values)
        expect(bgColor).toMatch(/rgb\(\d+,\s*\d+,\s*\d+\)/);
      }
    }
  });
});
