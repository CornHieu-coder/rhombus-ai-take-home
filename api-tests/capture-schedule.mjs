import { chromium, expect } from '@playwright/test';
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';

if (!process.env.RHOMBUS_STORAGE_STATE || !process.env.RHOMBUS_PROJECT_NAME) {
  throw new Error('Set RHOMBUS_STORAGE_STATE and RHOMBUS_PROJECT_NAME.');
}
const prefix = process.argv[2] || `observations/evidence/schedule-${new Date().toISOString().replace(/[:.]/g, '-')}`;
fs.mkdirSync(path.dirname(prefix), { recursive: true });
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ storageState: process.env.RHOMBUS_STORAGE_STATE });
  const page = await context.newPage();
  await page.addLocatorHandler(page.getByRole('dialog', { name: 'Ad Blocker Detected' }),
    async dialog => { await dialog.getByRole('button', { name: 'Continue Anyway' }).click(); });
  await page.goto(process.env.RHOMBUS_BASE_URL || 'https://rhombusai.com');
  const project = page.getByRole('link', { name: process.env.RHOMBUS_PROJECT_NAME, exact: true });
  await expect(project).toBeVisible({ timeout: 30_000 });
  const projectId = (await project.getAttribute('href'))?.match(/^\/workflow\/(\d+)$/)?.[1];
  if (!projectId) throw new Error('No workflow ID found.');
  const root = `/api/dataset/analyzer/v2/projects/${projectId}`;
  const pending = page.waitForResponse(r => new URL(r.url()).pathname === `${root}/nodes`);
  await project.click();
  const response = await pending;
  if (response.status() !== 200) throw new Error(`Nodes returned HTTP ${response.status()}.`);
  const authorization = response.request().headers().authorization;
  if (!authorization) throw new Error('Authenticated backend request not found.');
  const nodes = await response.json();
  const apiBase = new URL(response.url()).origin;
  const evidence = { captured_at: new Date().toISOString(), api_base: apiBase, project_id: Number(projectId), requests: [] };
  const read = async suffix => {
    const r = await context.request.get(`${apiBase}${root}${suffix}`, { headers: { Authorization: authorization } });
    evidence.requests.push({ method: 'GET', path: `${root}${suffix}`, status: r.status() });
    if (r.status() !== 200) throw new Error(`Read returned HTTP ${r.status()}.`);
    return r.json();
  };
  const schedules = await read('/pipeline/schedules');
  const active = schedules.find(s => s.enabled);
  if (!active) throw new Error('No active schedule found.');
  evidence.schedule = Object.fromEntries([
    'id', 'project_id', 'frequency', 'cron_expression', 'schedule_time_utc', 'enabled',
    'notify_on_failure', 'next_run_at', 'last_run_at', 'created_at', 'skipped_runs_count',
  ].map(key => [key, active[key]]));
  const history = await read(`/pipeline/schedules/${active.id}/executions`);
  evidence.history = { total: history.total, page: history.page, page_size: history.page_size,
    executions: history.executions.map(run => Object.fromEntries([
      'id', 'execution_id', 'status', 'started_at', 'completed_at', 'duration',
    ].filter(key => key in run).map(key => [key, run[key]]))) };
  evidence.nodes = nodes.map(n => ({ name: n.name, inputs: n.inputs, outputs: n.outputs,
    transformation_type: n.metadata?.node?.data?.transformationType,
    source_type: n.metadata?.node?.data?.transformationParams?.source_type,
    sampling_enabled: n.metadata?.node?.data?.transformationParams?.sampling_enabled,
    destination_configured: Boolean(n.metadata?.node?.data?.transformationParams?.destination_id),
  }));
  await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
  const historyResponse = page.waitForResponse(r => new URL(r.url()).pathname === `${root}/pipeline/schedules/${active.id}/executions`);
  const activeControls = page.getByRole('switch', { name: 'Deactivate schedule', exact: true })
    .locator('xpath=../..');
  await activeControls.getByRole('button').filter({ has: page.locator('svg.lucide-history') }).click();
  await historyResponse;
  await expect(page.getByRole('columnheader', { name: 'Execution', exact: true })).toBeVisible();
  evidence.visible_next_run = await page.getByText(/^Next run:/).first().innerText();
  evidence.visible_empty_history = await page.getByRole('cell', { name: 'No results.', exact: true }).isVisible();
  await page.screenshot({ path: `${prefix}.png`, fullPage: true,
    mask: [page.getByText(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)] });
  fs.writeFileSync(`${prefix}.json`, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`Saved redacted schedule evidence to ${prefix}.json and ${prefix}.png`);
} finally { await browser.close(); }
