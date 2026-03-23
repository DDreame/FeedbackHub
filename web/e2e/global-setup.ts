import { chromium } from '@playwright/test';

export default async () => {
  const backendUrl = 'http://localhost:3000';
  const maxWait = 30000;
  const start = Date.now();
  while (Date.now() - start < maxWait) {
    try {
      const res = await fetch(backendUrl);
      if (res.ok || res.status === 401) return; // 401 means backend is up
    } catch {}
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(
    `Backend not available at ${backendUrl} after ${maxWait}ms. ` +
    `Start it with: cd backend && cargo run`
  );
};
