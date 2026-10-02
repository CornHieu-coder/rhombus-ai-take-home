import { expect, test } from '@playwright/test';
import { openProject } from '../ui-tests/live-project';

test.beforeEach(() => {
  test.skip(!process.env.RHOMBUS_STORAGE_STATE || !process.env.RHOMBUS_PROJECT_NAME,
    'Requires a signed-in session and an existing test project.');
});

test('authenticated schedule API returns an enabled recurring schedule', async ({ page }) => {
  const app = await openProject(page);
  const response = await page.request.get(
    `${app.apiBase}/api/dataset/analyzer/v2/projects/${app.projectId}/pipeline/schedules`,
    { headers: app.headers });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  const schedules = await response.json();
  expect(Array.isArray(schedules)).toBe(true);
  const active = schedules.find((item: { enabled: boolean }) => item.enabled);
  expect(active, 'An active recurring schedule must be saved').toBeDefined();
  expect(active.project_id).toBe(Number(app.projectId));
  expect(active.frequency).toBe('hourly');
  expect(active.cron_expression).toMatch(/^\d{1,2} \* \* \* \*$/);
  expect(Number.isNaN(Date.parse(active.next_run_at))).toBe(false);
});

test('scheduled attempts have execution records in the backend history', async ({ page }) => {
  test.skip(process.env.RHOMBUS_EXPECT_SCHEDULE_HISTORY !== '1',
    'Enable after allowing at least one automatic scheduled attempt.');
  const app = await openProject(page);
  const schedules = await page.request.get(
    `${app.apiBase}/api/dataset/analyzer/v2/projects/${app.projectId}/pipeline/schedules`,
    { headers: app.headers });
  expect(schedules.status()).toBe(200);
  const active = (await schedules.json()).find((item: { enabled: boolean }) => item.enabled);
  expect(active).toBeDefined();
  const response = await page.request.get(
    `${app.apiBase}/api/dataset/analyzer/v2/projects/${app.projectId}/pipeline/schedules/${active.id}/executions`,
    { headers: app.headers });
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  const history = await response.json();
  expect(Array.isArray(history.executions)).toBe(true);
  expect(history.total, 'A scheduled attempt must leave a traceable execution record').toBeGreaterThan(0);
  expect(history.executions.length).toBeGreaterThan(0);
});
