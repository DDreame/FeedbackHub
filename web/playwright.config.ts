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
  globalSetup: async () => {
    // Ensure backend is running before E2E tests
    const backendUrl = 'http://localhost:3000';
    const maxWait = 30000;
    const start = Date.now();
    while (Date.now() - start < maxWait) {
      try {
        const res = await fetch(backendUrl);
        if (res.ok || res.status === 401) return; // 401 means backend is up (needs API key)
      } catch {}
      await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`Backend not available at ${backendUrl} after ${maxWait}ms. Run './dev.sh' first.`);
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3010',
    reuseExistingServer: !process.env.CI,
  },
});
