import { expect, test } from '@playwright/test';
import { openProject, openSchedule } from './live-project';

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
    await expect(page.getByTestId(`rf__node-${node.name}`)).toBeVisible();
  }
  expect(input.metadata.node.data.transformationParams.source_type).toBe('s3');
  expect(cleaning.inputs).toEqual(expect.arrayContaining(input.outputs));
  expect(output.inputs).toEqual(expect.arrayContaining(cleaning.outputs));
  expect(output.metadata.node.data.transformationParams.format_type).toBe('csv');
  expect(output.metadata.node.data.transformationParams.destination_id).toBeGreaterThan(0);
});

test('active schedule displays its next run time', async ({ page }) => {
  const { projectId } = await openProject(page);
  const schedule = await openSchedule(page, projectId);
  expect(schedule.next_run_at).toBeTruthy();
  // The visible label is a single element containing "Next run:" and its value.
  const nextRun = page.getByText(/^Next run:/).first();
  await expect(nextRun).toBeVisible();
  await expect(nextRun, 'An active schedule must show a time after Next run:')
    .toHaveText(/Next run:\s*\S+/, { timeout: 5_000 });
});

test('scheduled attempts appear in the execution history table', async ({ page }) => {
  test.skip(process.env.RHOMBUS_EXPECT_SCHEDULE_HISTORY !== '1',
    'Enable after allowing at least one automatic scheduled attempt.');
  const { projectId } = await openProject(page);
  const schedule = await openSchedule(page, projectId);
  const pending = page.waitForResponse(response => new URL(response.url()).pathname ===
    `/api/dataset/analyzer/v2/projects/${projectId}/pipeline/schedules/${schedule.id}/executions`);
  // A paused diagnostic schedule may also be present. Open the enabled card's history.
  const activeControls = page.getByRole('switch', { name: 'Deactivate schedule', exact: true })
    .locator('xpath=../..');
  await activeControls.getByRole('button').filter({ has: page.locator('svg.lucide-history') }).click();
  expect((await pending).status()).toBe(200);
  await expect(page.getByRole('columnheader', { name: 'Execution', exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeVisible();
  await expect.poll(() => page.getByRole('table').getByRole('row').count(),
    { message: 'Wait for the execution table to finish loading' }).toBeGreaterThan(1);
  await expect(page.getByRole('cell', { name: 'No results.', exact: true }),
    'An automatic attempt must be visible in schedule history').toHaveCount(0, { timeout: 5_000 });
  await expect(page.getByRole('button', { name: 'Export CSV', exact: true })).toBeEnabled();
});
