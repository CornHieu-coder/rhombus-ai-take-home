import { defineConfig } from '@playwright/test';
import 'dotenv/config';

export default defineConfig({
  testDir: '.',
  testMatch: ['ui-tests/**/*.spec.ts', 'api-tests/**/*.spec.ts'],
  timeout: 90_000,
  expect: { timeout: 15_000 },
  retries: 0,
  use: {
    baseURL: process.env.RHOMBUS_BASE_URL ?? 'https://rhombusai.com',
    storageState: process.env.RHOMBUS_STORAGE_STATE || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },
  reporter: [['list'], ['html', { open: 'never' }]]
});
