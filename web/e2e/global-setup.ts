import { chromium } from '@playwright/test';

async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Wait for backend to be ready
  const backendUrl = 'http://localhost:3000';
  const maxWait = 30000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await page.request.get(backendUrl);
      if (res.ok() || res.status() === 401) break;
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }

  // Seed a default test app if none exists
  let appKey = 'test-app';
  try {
    const appRes = await page.request.post('http://localhost:3000/v1/feedback/apps', {
      json: { name: 'Test App', description: 'E2E test app' }
    });
    if (appRes.ok()) {
      const appData = await appRes.json();
      appKey = appData.app_key;
    }
  } catch {
    // App might already exist — ignore
  }

  // Generate a stable reporter ID for E2E tests
  const reporterId = 'e2e-reporter-' + '12345678';

  // Create 25 feedback threads for pagination test (need >20 for pagination to show)
  for (let i = 0; i < 25; i++) {
    try {
      await page.request.post('http://localhost:3000/v1/feedback/threads/atomic', {
        headers: { 'X-Reporter-Id': reporterId },
        json: {
          category: '遇到问题',
          summary: `E2E Test Feedback ${i + 1}`,
          initial_message: `This is test feedback number ${i + 1} for E2E testing purposes.`,
          app_key: appKey,
          context: {
            app_version: '1.0.0',
            os_name: 'Test',
            os_version: '1.0',
            device_model: 'Test Device',
            current_route: '/history',
          },
        }
      });
    } catch {
      // Some may fail due to timing — ignore
    }
  }

  await browser.close();
}

export default globalSetup;
