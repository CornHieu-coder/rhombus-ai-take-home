import { expect, test } from '@playwright/test';
import { canvasNodeId, openProject, openSchedule } from './live-project';
import { assessHistoryWindow, assessNextRun, assessScheduleHistory } from './journey-result.mjs';

test.beforeEach(() => {
  test.skip(!process.env.RHOMBUS_STORAGE_STATE || !process.env.RHOMBUS_PROJECT_NAME,
    'Requires a signed-in session and an existing test project.');
});

test('existing canvas connects the S3 input, AI cleaning, and cloud output', async ({ page }) => {
  const { nodes } = await openProject(page);
  const input = nodes.find((node: any) => node.metadata?.node?.data?.transformationType === 'input');
  const cleaning = nodes.find((node: any) => node.metadata?.node?.data?.transformationType === 'llm');
  const output = nodes.find((node: any) => node.metadata?.node?.data?.transformationType === 'output');
  expect(input).toBeDefined();
  expect(cleaning).toBeDefined();
  expect(output).toBeDefined();
  for (const node of [input, cleaning, output]) {
    await expect(page.getByTestId(`rf__node-${canvasNodeId(node)}`)).toBeVisible();
  }
  expect(input.metadata.node.data.transformationParams.source_type).toBe('s3');
  expect(cleaning.inputs).toEqual(expect.arrayContaining(input.outputs));
  expect(output.inputs).toEqual(expect.arrayContaining(cleaning.outputs));
  expect(output.metadata.node.data.transformationParams.format_type).toBe('csv');
  expect(output.metadata.node.data.transformationParams.destination_id).toBeGreaterThan(0);
});

test('active schedule displays a future next run time', async ({ page }) => {
  const { projectId } = await openProject(page);
  const schedule = await openSchedule(page, projectId);
  const nextRunResult = assessNextRun(schedule.next_run_at, { now: new Date().toISOString() });
  expect(nextRunResult.state, nextRunResult.reason).toBe('future');
  // The visible label is a single element containing "Next run:" and its value.
  const nextRun = page.getByText(/^Next run:/).first();
  await expect(nextRun).toBeVisible();
  await expect(nextRun, 'An active schedule must show a time after Next run:')
    .toHaveText(/Next run:\s*\S+/, { timeout: 5_000 });
});

test('automatic attempts within the explicit window appear in the execution history table', async ({ page }) => {
  test.skip(process.env.RHOMBUS_EXPECT_SCHEDULE_HISTORY !== '1',
    'Set RHOMBUS_EXPECT_SCHEDULE_HISTORY=1 and RHOMBUS_SCHEDULE_HISTORY_SINCE after observing an automatic attempt.');
  const windowStart = process.env.RHOMBUS_SCHEDULE_HISTORY_SINCE;
  const window = assessHistoryWindow(windowStart, new Date().toISOString());
  expect(window.valid, window.reason).toBe(true);
  const { projectId } = await openProject(page);
  const schedule = await openSchedule(page, projectId);
  const pending = page.waitForResponse(response => new URL(response.url()).pathname ===
    `/api/dataset/analyzer/v2/projects/${projectId}/pipeline/schedules/${schedule.id}/executions`);
  // A paused diagnostic schedule may also be present. Open the enabled card's history.
  const activeControls = page.getByRole('switch', { name: 'Deactivate schedule', exact: true })
    .locator('xpath=../..');
  await activeControls.getByRole('button').filter({ has: page.locator('svg.lucide-history') }).click();
  const response = await pending;
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  const history = await response.json();
  expect(Array.isArray(history.executions)).toBe(true);
  const checked = assessScheduleHistory(history.executions, {
    projectId, scheduleId: schedule.id, windowStart, now: new Date().toISOString(),
  });
  expect(checked.state, checked.reason).toBe('present');
  await expect(page.getByRole('columnheader', { name: 'Execution', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole('table').getByRole('row').count(),
    { message: 'Wait for the execution table to finish loading' }).toBeGreaterThan(1);
  await expect(page.getByRole('cell', { name: 'No results.', exact: true }),
    'An automatic attempt must be visible in schedule history').toHaveCount(0, { timeout: 5_000 });
  const table = page.getByRole('table');
  await expect.poll(async () => {
    const counts = await Promise.all(checked.executions.map((run: any) =>
      table.getByRole('cell', { name: `Execution #${run.id}`, exact: true })
        .or(table.getByRole('cell', { name: String(run.id), exact: true })).count()));
    return counts.some(count => count > 0);
  }, { message: 'An in-window automatic execution ID must be visible in the history table', timeout: 5_000 })
    .toBe(true);
  await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeEnabled();
});
