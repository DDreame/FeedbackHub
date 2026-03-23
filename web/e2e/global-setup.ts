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
  try {
    await page.request.post('http://localhost:3000/v1/feedback/apps', {
      json: { name: 'Test App', description: 'E2E test app' }
    });
  } catch {
    // App might already exist — ignore errors
  }

  await browser.close();
}

export default globalSetup;
