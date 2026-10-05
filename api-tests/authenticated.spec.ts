import { expect, test } from '@playwright/test';
import { openProject } from '../ui-tests/live-project';
import { assessHistoryWindow, assessNextRun, assessScheduleHistory } from '../ui-tests/journey-result.mjs';

test.beforeEach(() => {
  test.skip(!process.env.RHOMBUS_STORAGE_STATE || !process.env.RHOMBUS_PROJECT_NAME,
    'Requires a signed-in session and an existing test project.');
});

test('authenticated schedule API returns an enabled recurring schedule with a future next run', async ({ page }) => {
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
  const nextRunResult = assessNextRun(active.next_run_at, { now: new Date().toISOString() });
  expect(nextRunResult.state, nextRunResult.reason).toBe('future');
});

test('automatic attempts within the explicit window have execution records in backend history', async ({ page }) => {
  test.skip(process.env.RHOMBUS_EXPECT_SCHEDULE_HISTORY !== '1',
    'Set RHOMBUS_EXPECT_SCHEDULE_HISTORY=1 and RHOMBUS_SCHEDULE_HISTORY_SINCE after observing an automatic attempt.');
  const windowStart = process.env.RHOMBUS_SCHEDULE_HISTORY_SINCE;
  const window = assessHistoryWindow(windowStart, new Date().toISOString());
  expect(window.valid, window.reason).toBe(true);
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
  const checked = assessScheduleHistory(history.executions, {
    projectId: app.projectId, scheduleId: active.id, windowStart, now: new Date().toISOString(),
  });
  expect(checked.state, checked.reason).toBe('present');
});
