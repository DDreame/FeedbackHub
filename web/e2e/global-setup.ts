import { chromium } from '@playwright/test';

const REPORTER_ID = '00000000-0000-0000-0000-000000000001';

async function globalSetup() {
  const browser = await chromium.launch();
  const context = await browser.newContext();

  // Inject the reporter ID into localStorage for all test contexts
  await context.addInitScript((reporterId) => {
    localStorage.setItem('feedback_reporter_id', reporterId);
  }, REPORTER_ID);

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

  // Create 25 feedback threads for pagination test (need >20 for pagination to show)
  for (let i = 0; i < 25; i++) {
    try {
      await page.request.post('http://localhost:3000/v1/feedback/threads/atomic', {
        headers: { 'X-Reporter-Id': REPORTER_ID },
        json: {
          reporter_id: REPORTER_ID,
          category: '遇到问题',
          summary: `E2E Test Feedback ${i + 1}`,
          initial_message: `This is test feedback number ${i + 1} for E2E testing purposes.`,
          context: {
            app_version: '1.0.0',
            os_name: 'Test OS',
            os_version: '1.0.0',
            device_model: 'Test Device',
            locale: null,
            current_route: '/history',
          },
        }
      });
    } catch {
      // Some may fail due to timing — ignore
    }
  }

  // Save storage state with reporter ID in localStorage
  await context.storageState({ path: './e2e/.auth/user.json' });

  await browser.close();
}

export default globalSetup;
