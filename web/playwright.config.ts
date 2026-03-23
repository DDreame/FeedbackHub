import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3010',
    trace: 'on-first-retry',
  },
  globalSetup: './e2e/global-setup.ts',
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: [
    {
      command: 'cargo run',
      url: 'http://localhost:3000',
      cwd: '../backend',
      env: {
        DATABASE_URL: 'postgres://feedback:feedback_secret@localhost:5432/feedback_dev',
        RUST_LOG: 'info',
      },
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'npm run dev',
      url: 'http://localhost:3010',
      timeout: 120000,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
