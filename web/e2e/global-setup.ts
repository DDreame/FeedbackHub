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

  // Seed two test apps for home page app selection grid (needs >1 app to show grid, not auto-navigate)
  try {
    await page.request.post('http://localhost:3000/v1/feedback/apps', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ name: 'Test App 1', description: 'E2E test app 1' }),
    });
    await page.request.post('http://localhost:3000/v1/feedback/apps', {
      headers: { 'Content-Type': 'application/json' },
      data: JSON.stringify({ name: 'Test App 2', description: 'E2E test app 2' }),
    });
  } catch {
    // Apps might already exist — ignore
  }

  // Create 25 feedback threads for pagination test (need >20 for pagination to show)
  let threadsCreated = 0;
  for (let i = 0; i < 25; i++) {
    try {
      const body = JSON.stringify({
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
      });
      const res = await page.request.post('http://localhost:3000/v1/feedback/threads/atomic', {
        headers: {
          'Content-Type': 'application/json',
          'X-Reporter-Id': REPORTER_ID,
        },
        data: body,
      });
      if (res.ok()) {
        threadsCreated++;
      }
    } catch {
      // Some may fail due to timing — ignore
    }
    // Small delay between requests
    if (i < 24) await new Promise(r => setTimeout(r, 100));
  }

  // Save storage state with reporter ID in localStorage
  await context.storageState({ path: './e2e/.auth/user.json' });

  await browser.close();
}

export default globalSetup;
