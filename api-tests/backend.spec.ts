import { expect, test } from '@playwright/test';

// These two backend paths were observed as fetch requests in the unauthenticated
// browser journey on 2026-09-30 using capture-network.mjs.
const apiBase = process.env.RHOMBUS_API_BASE_URL || 'https://api.rhombusai.com';

for (const path of [
  '/api/accounts/users/profile',
  '/api/accounts/users/project-limit',
]) {
  test(`unauthenticated GET ${path} returns a structured 401`, async ({ playwright }) => {
    const client = await playwright.request.newContext({
      baseURL: apiBase,
      storageState: { cookies: [], origins: [] },
    });
    try {
      const response = await client.get(path);
      expect(response.status()).toBe(401);
      expect(response.headers()['content-type']).toContain('application/json');
      expect(await response.json()).toEqual({ detail: 'Unauthorized' });
    } finally {
      await client.dispose();
    }
  });
}

test('session endpoint returns JSON null without a signed-in session', async ({ playwright }) => {
  const client = await playwright.request.newContext({
    baseURL: process.env.RHOMBUS_BASE_URL || 'https://rhombusai.com',
    storageState: { cookies: [], origins: [] },
  });
  try {
    const response = await client.get('/api/auth/session');
    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toBeNull();
  } finally {
    await client.dispose();
  }
});
