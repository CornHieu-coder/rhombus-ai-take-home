import { chromium } from '@playwright/test';
import 'dotenv/config';
import fs from 'node:fs';

const baseURL = process.env.RHOMBUS_BASE_URL || 'https://rhombusai.com';
const statePath = process.env.RHOMBUS_STORAGE_STATE;
const browser = await chromium.launch();
const context = await browser.newContext({
  storageState: statePath && fs.existsSync(statePath) ? statePath : undefined,
});
const page = await context.newPage();
const endpoints = [];
page.on('response', (response) => {
  const request = response.request();
  if (!['fetch', 'xhr'].includes(request.resourceType())) return;
  const url = new URL(response.url());
  endpoints.push({
    method: request.method(),
    origin: url.origin,
    path: url.pathname,
    status: response.status(),
    contentType: response.headers()['content-type'] || '',
  });
});
await page.goto(baseURL, { waitUntil: 'domcontentloaded' });
await page.waitForLoadState('networkidle', { timeout: 15_000 }).catch(() => {});
console.log(JSON.stringify({ page: page.url(), title: await page.title(), endpoints }, null, 2));
await browser.close();
