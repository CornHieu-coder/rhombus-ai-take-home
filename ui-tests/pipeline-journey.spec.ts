import { expect, test } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { canvasNodeId, openProject } from './live-project';
import { CloudObserver, type CloudObject } from './journey-cloud';
import { JourneyEvidence } from './journey-evidence';
import { assessScheduledExecution, findFreshOutput } from './journey-result.mjs';

// The journey changes a dedicated test project and creates its own schedule.
test.skip(process.env.RHOMBUS_RUN_PROVISIONING_JOURNEY !== '1',
  'Set RHOMBUS_RUN_PROVISIONING_JOURNEY=1 to run the live UI journey.');
// This flow can upload a service-account key. Never retain trace/network bodies.
test.use({ trace: 'off', screenshot: 'off' });

const columns = ['order_id', 'customer_email', 'customer_name', 'amount_usd', 'order_date', 'country'];
const cleaningPrompt = [
  'Clean the dataframe using the following steps in order:',
  '1. Trim leading/trailing whitespace from all string/object columns.',
  '2. Lowercase the customer_email column.',
  '3. Remove duplicate order_id rows, keeping the first occurrence.',
  "4. Fill missing customer_name values with the string 'Unknown'.",
  '5. Remove rows where order_id is null/empty or customer_email is null/empty.',
  '6. Remove rows where amount_usd is not a valid number or is <= 0.',
  '7. Remove rows where order_date cannot be parsed as a valid date.',
  "8. Keep only rows where country (case-insensitive, trimmed) is one of: 'us', 'usa', 'united states'.",
  "9. Standardize country to 'US'.",
  '10. Round amount_usd to 2 decimal places as a float.',
  '11. Format order_date as a string in YYYY-MM-DD format.',
  '12. Output exactly these columns in this order: ' + columns.join(', ') + '.',
  'Assign the final dataframe to output_df.',
].join(' ');
const sha256 = (bytes: Uint8Array | string) => crypto.createHash('sha256').update(bytes).digest('hex');
const kind = (node: any) => node.transformation_type || node.metadata?.node?.data?.transformationType
  || node.metadata?.node?.data?.transformation_type;
const params = (node: any) => node.params || node.metadata?.node?.data?.transformationParams || {};
const runtimeName = (node: any) => node.runtime_name || node.metadata?.runtime_name
  || node.metadata?.node?.data?.runtime_name || node.name;
const scheduleFields = (s: any) => Object.fromEntries([
  'id', 'project_id', 'frequency', 'cron_expression', 'enabled', 'notify_on_failure',
  'next_run_at', 'last_run_at', 'created_at',
].map(key => [key, s[key]]));
const runFields = (run: any) => Object.fromEntries([
  'id', 'project_id', 'schedule_id', 'trigger', 'started_at', 'completed_at',
  'success', 'completed_nodes', 'failed_node', 'total_duration_seconds',
].map(key => [key, run[key]]));
const nodeFields = (nodes: any[]) => nodes.map(n => ({
  runtime_name: runtimeName(n), canvas_id: canvasNodeId(n), type: kind(n), inputs: n.inputs, outputs: n.outputs,
  source_type: params(n).source_type, sampling_enabled: params(n).sampling_enabled,
  destination_id: params(n).destination_id, format_type: params(n).format_type,
  code_sha256: params(n).code ? sha256(params(n).code) : undefined,
  prompt_sha256: params(n).prompt ? sha256(params(n).prompt) : undefined,
}));

function graph(nodes: any[]) {
  const input = nodes.filter(n => kind(n) === 'input');
  const cleaning = nodes.filter(n => kind(n) === 'llm');
  const output = nodes.filter(n => kind(n) === 'output');
  expect(input, 'Exactly one S3 input is expected').toHaveLength(1);
  expect(cleaning, 'The AI builder must create one Custom cleaning node').toHaveLength(1);
  expect(output, 'Exactly one cloud output is expected').toHaveLength(1);
  expect(nodes).toHaveLength(3);
  expect(input[0].outputs.length).toBeGreaterThan(0);
  expect(cleaning[0].outputs.length).toBeGreaterThan(0);
  expect(cleaning[0].inputs).toEqual(expect.arrayContaining(input[0].outputs));
  expect(output[0].inputs).toEqual(expect.arrayContaining(cleaning[0].outputs));
  return { input: input[0], cleaning: cleaning[0], output: output[0] };
}

function validate(evidence: JourneyEvidence, outputName?: string) {
  const args = ['data-validation/validate.py', '--scenario', 'baseline',
    '--source', path.join(evidence.directory, 'input.csv'),
    ...(outputName ? ['--output', path.join(evidence.directory, outputName)] : ['--output-missing'])];
  const result = spawnSync(process.env.RHOMBUS_PYTHON || 'python', args, { encoding: 'utf8' });
  if (result.error || ![0, 2].includes(result.status!)) throw new Error('The local baseline validator could not run.');
  const report = JSON.parse(result.stdout);
  // Absolute private paths are not useful in the curated public evidence.
  report.source_uri = 'input.csv';
  report.output_uri = outputName || null;
  evidence.writeJson(outputName === 'manual-output.csv' ? 'manual-validation.json' : 'validation.json', report);
  return report;
}

test('S3 connection, AI-built cleaning, GCS destination and a dedicated schedule', async ({ page }, testInfo) => {
  test.skip(['RHOMBUS_STORAGE_STATE', 'RHOMBUS_PROJECT_NAME', 'RHOMBUS_S3_BUCKET', 'RHOMBUS_GCS_BUCKET']
    .some(key => !process.env[key]), 'Saved Rhombus session, original project name and both bucket names are required.');
  const verifyDelivery = process.env.RHOMBUS_JOURNEY_VERIFY_DELIVERY === '1';
  const graceSeconds = Number(process.env.RHOMBUS_JOURNEY_GRACE_SECONDS || '180');
  expect(graceSeconds).toBeGreaterThanOrEqual(60);
  expect(graceSeconds).toBeLessThanOrEqual(600);
  test.setTimeout((verifyDelivery ? 20 : 10) * 60_000);
  page.setDefaultTimeout(30_000);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const evidence = new JourneyEvidence(testInfo, runId);
  evidence.manifest.mode = verifyDelivery ? 'delivery' : 'configuration';
  evidence.manifest.automatic_trigger_attempted = false;
  evidence.manifest.command = 'RHOMBUS_RUN_PROVISIONING_JOURNEY=1 '
    + (verifyDelivery ? 'RHOMBUS_JOURNEY_VERIFY_DELIVERY=1 ' : '')
    + 'npm run test:journey -- --workers=1';
  const step = <T>(name: string, fn: () => Promise<T>) =>
    test.step(name, () => evidence.step(name, fn));
  const projectName = process.env.RHOMBUS_JOURNEY_PROJECT_NAME || 'Rhombus QA Playwright Journey';
  const sourceKey = (process.env.RHOMBUS_S3_PREFIX || '') + 'baseline.csv';
  const outputPrefix = 'rhombus-journey-' + runId;
  const rootPrefix = '/api/dataset/analyzer/v2/projects/';
  let app: Awaited<ReturnType<typeof openProject>> | undefined;
  let cloud: CloudObserver | undefined;
  let scheduleId: number | undefined;
  let createdAt: string | undefined;
  let originalId: string | undefined;
  let originalSchedules: any[] = [];
  let originalSchedulesCaptured = false;
  let primaryError: unknown;
  let sourceIdentity: { asset: string; connection: string };
  let beforeScheduleIds: number[] = [];
  let creationAttempted = false;
  let output: any;
  let expectedNodes: string[] = [];
  let beforeObjects: CloudObject[] = [];
  const get = async (suffix: string, projectId = app!.projectId) => {
    const response = await page.request.get(app!.apiBase + rootPrefix + projectId + suffix,
      { headers: app!.headers, timeout: 30_000 });
    expect(response.status(), 'Authenticated GET must return HTTP 200').toBe(200);
    return response.json();
  };
  const showHistory = async () => {
    await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
    const active = page.getByRole('switch', { name: 'Deactivate schedule', exact: true });
    // This project's only active schedule must be the exact newly returned ID.
    expect((await get('/pipeline/schedules')).filter((s: any) => s.enabled).map((s: any) => s.id)).toEqual([scheduleId]);
    await expect(active).toHaveCount(1);
    const pending = page.waitForResponse(r => new URL(r.url()).pathname ===
      rootPrefix + app!.projectId + '/pipeline/schedules/' + scheduleId + '/executions');
    await active.locator('xpath=../..').getByRole('button')
      .filter({ has: page.locator('svg.lucide-history') }).click();
    expect((await pending).status()).toBe(200);
    await expect(page.getByRole('columnheader', { name: 'Execution', exact: true })).toBeVisible();
  };

  try {
    await step('Open or create the isolated journey project', async () => {
      expect(projectName, 'The journey uses a project separate from the evidence project')
        .not.toBe(process.env.RHOMBUS_PROJECT_NAME);
      await page.goto('/');
      const original = page.getByRole('link', { name: process.env.RHOMBUS_PROJECT_NAME!, exact: true });
      await expect(original).toBeVisible();
      originalId = (await original.getAttribute('href'))?.match(/^\/workflow\/(\d+)$/)?.[1];
      expect(originalId).toBeTruthy();
      const journey = page.getByRole('link', { name: projectName, exact: true });
      if (!(await journey.count())) {
        await page.getByRole('button', { name: 'New Project', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Create New Project' });
        await dialog.getByRole('textbox', { name: 'Project Name', exact: true }).fill(projectName);
        const pending = page.waitForResponse(r => new URL(r.url()).pathname === '/api/dataset/projects/add'
          && r.request().method() === 'POST');
        await dialog.getByRole('button', { name: 'Create', exact: true }).click();
        expect((await pending).status()).toBe(201);
        await expect(journey).toBeVisible();
      }
      app = await openProject(page, projectName);
      evidence.manifest.project_id = Number(app.projectId);
      evidence.manifest.project_name = projectName;
      originalSchedules = await get('/pipeline/schedules', originalId);
      originalSchedulesCaptured = true;
      evidence.manifest.original_project_id = Number(originalId);
      evidence.manifest.original_schedules = originalSchedules.map(scheduleFields);
      const existing = await get('/pipeline/schedules');
      expect(existing.filter((s: any) => s.enabled), 'No unrelated active schedule may compete with this run').toHaveLength(0);
      beforeScheduleIds = existing.map((s: any) => s.id);
      evidence.writeJson('configuration-before.json', { nodes: nodeFields(app.nodes), schedules: existing.map(scheduleFields) });
    });

    if (verifyDelivery) await step('Verify the actual S3 source and cloud access', async () => {
      cloud = await CloudObserver.connect({
        cdpUrl: process.env.RHOMBUS_CLOUD_CDP_URL || 'http://127.0.0.1:9333',
        s3Bucket: process.env.RHOMBUS_S3_BUCKET!, s3Region: process.env.RHOMBUS_S3_REGION || 'ap-southeast-2',
        s3Key: sourceKey, gcsBucket: process.env.RHOMBUS_GCS_BUCKET!,
      });
      const source = await cloud.downloadSource();
      expect(source.equals(fs.readFileSync('datasets/baseline.csv')),
        'The live S3 object must equal this exercise baseline before running').toBe(true);
      evidence.writeBytes('input.csv', source);
      evidence.manifest.source = { object_key: sourceKey, bytes: source.length, sha256: sha256(source),
        method: 'Actual configured S3 object downloaded through its authenticated console link' };
      beforeObjects = await cloud.listOutputs();
    });

    await step('Select the connected S3 baseline through the source UI', async () => {
      // An unconfigured Data Input exists on the canvas before it becomes a
      // runtime node in GET /nodes. Select its dataset before polling that API.
      const inputCard = page.locator('[data-testid^="rf__node-"]').filter({ hasText: /Data Input/ });
      if (!(await inputCard.count())) {
        await page.getByTestId('toolbar-plus').click();
        await page.getByRole('dialog').getByText('Data Input', { exact: true }).click();
      }
      await expect(inputCard).toHaveCount(1);
      await inputCard.click();
      await page.getByRole('button', { name: 'Third Party Sources', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Third Party Data' });
      const heading = dialog.getByRole('heading', { name: process.env.RHOMBUS_S3_BUCKET! + '/', exact: true });
      await expect(dialog.getByText('Loading', { exact: true })).toHaveCount(0, { timeout: 30_000 });
      if (!(await heading.count())) {
        await dialog.getByRole('button', { name: 'Add Data Sources', exact: true }).click();
        await dialog.getByRole('heading', { name: 'Amazon S3', exact: true }).click();
        await dialog.getByRole('textbox', { name: 'Bucket*', exact: true }).fill(process.env.RHOMBUS_S3_BUCKET!);
        await dialog.getByRole('combobox', { name: 'Region*', exact: true }).click();
        await page.getByRole('option').filter({ hasText: process.env.RHOMBUS_S3_REGION || 'ap-southeast-2' }).click();
        // The preconfigured bucket read policy is an external prerequisite.
        await dialog.getByRole('button', { name: 'Connect S3 source', exact: true }).click();
      }
      await expect(heading).toBeVisible();
      const card = heading.locator('xpath=ancestor::div[.//button[contains(.,"Browse files")]][1]');
      let pending = page.waitForResponse(r => r.request().method() === 'GET'
        && new URL(r.url()).pathname.includes('/external-sources/s3/connections/')
        && new URL(r.url()).pathname.endsWith('/files'));
      await card.getByRole('button', { name: 'Browse files', exact: true }).click();
      let response = await pending;
      expect(response.status()).toBe(200);
      let listing = await response.json();
      if (!listing.files.some((f: any) => f.key === sourceKey)) {
        await dialog.getByRole('textbox', { name: 'Search by filename prefix...' }).fill(sourceKey);
        pending = page.waitForResponse(r => r.request().method() === 'GET'
          && new URL(r.url()).pathname.includes('/external-sources/s3/connections/')
          && new URL(r.url()).pathname.endsWith('/files'));
        await dialog.getByRole('button', { name: 'Search', exact: true }).click();
        response = await pending;
        expect(response.status()).toBe(200);
        listing = await response.json();
      }
      const file = listing.files.find((f: any) => f.key === sourceKey);
      expect(file, 'The exact configured source key must be listed').toBeDefined();
      expect(file.selectable).toBe(true);
      expect(file.size_bytes).toBe(fs.statSync('datasets/baseline.csv').size);
      await evidence.screenshot(page, 'source.png');
      await expect(dialog.getByRole('cell', { name: 'CSV ' + file.name, exact: true })).toBeVisible();
      // The source dialog lists files; dataset selection belongs to the input panel.
      await dialog.getByRole('button', { name: 'Close', exact: true }).click();
      await expect(dialog).toBeHidden();
      await page.getByRole('complementary').getByRole('list').getByText(file.name, { exact: true }).click();
      // Dataset selection saves the input immediately; Apply edits sampling settings.
      await expect.poll(async () => params((await get('/nodes')).find((n: any) => kind(n) === 'input')).data_asset_ref).toBe(file.asset_ref);
      const current = (await get('/nodes')).find((n: any) => kind(n) === 'input');
      expect(params(current).source_type).toBe('s3');
      expect(params(current).source_connection_id).toBe(file.connection_id);
      sourceIdentity = { asset: file.asset_ref, connection: file.connection_id };
      evidence.manifest.source_selection = { source_type: 's3', object_key: file.key, listed_bytes: file.size_bytes,
        last_modified: file.last_modified, connection_verified: true, asset_verified: true };
      await page.getByRole('button', { name: 'Preview dataset', exact: true }).click();
      await expect(page.getByText('order_id', { exact: true }).first()).toBeVisible({ timeout: 45_000 });
      for (const column of columns) await expect(page.getByText(column, { exact: true }).first()).toBeVisible();
      await expect(page.getByRole('table').getByRole('row')).toHaveCount(10);
      await evidence.screenshot(page, 'input-preview.png');
      await page.getByRole('tab', { name: 'Canvas', exact: true }).click();
    });

    await step('Build the cleaning pipeline using AI Builder', async () => {
      await page.getByRole('tab', { name: 'AI Builder', exact: true }).click();
      const composer = page.getByRole('textbox');
      await expect(composer).toHaveCount(1);
      await composer.fill('/');
      await page.getByRole('button', { name: /^Pipeline \/pipeline / }).click();
      const builderPrompt = 'Use the selected S3 baseline.csv input in this project. '
        + 'Create or update exactly one Custom cleaning node and connect it to one Data Output node. '
        + 'Keep the existing S3 input, use AI-generated code only, and do not run the pipeline or change schedules. '
        + cleaningPrompt;
      evidence.writeText('builder-prompt.txt', builderPrompt);
      const completed = page.getByRole('button', { name: /^Worked for / });
      const previous = await completed.count();
      await composer.fill(builderPrompt);
      const sent = page.waitForRequest(r => r.method() === 'POST'
        && (r.postData() || '').includes('Clean the dataframe using the following steps in order'));
      await composer.press('Enter');
      const request = await sent;
      const response = await request.response();
      expect(response?.status(), 'The builder request must be accepted').toBe(200);
      await expect.poll(() => completed.count(), { timeout: 300_000,
        message: 'Wait for this builder turn, not an earlier reply' }).toBeGreaterThan(previous);
      // Reload persisted nodes after the completed turn; no old canvas state is accepted.
      await page.reload();
      let nodes = await get('/nodes');
      let built = graph(nodes);
      expect(params(built.cleaning).prompt.replace(/\s+/g, ' ').trim()).toBe(cleaningPrompt);
      if (!params(built.cleaning).code) {
        await page.getByTestId('rf__node-' + canvasNodeId(built.cleaning)).click();
        await page.getByRole('complementary').getByRole('button', { name: 'Regenerate Code', exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Regenerate With Feedback', exact: true });
        const feedback = 'Generate Python code for the existing ordered cleaning prompt exactly as written. '
          + 'Use input_df_1 as the input and assign output_df. Preserve all 12 rules and their order.';
        evidence.writeText('code-generation-feedback.txt', feedback);
        await dialog.getByRole('textbox').fill(feedback);
        await dialog.getByRole('button', { name: 'Regenerate Code', exact: true }).click();
        await expect(dialog).toBeHidden();
        await expect.poll(async () => params(graph(await get('/nodes')).cleaning).code,
          { timeout: 180_000, message: 'Rhombus must generate and persist code for the Builder-created prompt' }).toContain('output_df');
        nodes = await get('/nodes');
        built = graph(nodes);
      }
      expect(params(built.input).source_type).toBe('s3');
      expect(params(built.input).data_asset_ref).toBe(sourceIdentity.asset);
      expect(params(built.input).source_connection_id).toBe(sourceIdentity.connection);
      expect(params(built.cleaning).code).toContain('output_df');
      for (const column of columns) expect(params(built.cleaning).code).toContain(column);
      for (const node of nodes) await expect(page.getByTestId('rf__node-' + canvasNodeId(node))).toBeVisible();
      output = built.output;
      expectedNodes = nodes.map(runtimeName);
      evidence.writeText('generated-code.txt', params(built.cleaning).code);
      evidence.writeJson('ai-graph.json', { request_method: request.method(), request_path: new URL(request.url()).pathname,
        request_status: response!.status(), nodes: nodeFields(nodes) });
      await evidence.screenshot(page, 'ai-canvas.png');
    });

    await step('Select the GCS destination and save CSV export settings', async () => {
      await page.getByTestId('rf__node-' + canvasNodeId(output)).click();
      const panel = page.getByRole('complementary');
      const destinationPath = '/api/projects/' + app!.projectId + '/destinations/pipeline/';
      const destinations = async () => {
        const response = await page.request.get(app!.apiBase + destinationPath, { headers: app!.headers });
        expect(response.status()).toBe(200);
        return response.json();
      };
      let known = await destinations();
      if (!known.some((d: any) => d.name === process.env.RHOMBUS_GCS_BUCKET && d.storage_provider === 'gcp')) {
        const keyPath = process.env.RHOMBUS_GCS_SERVICE_ACCOUNT_JSON_PATH;
        expect(keyPath && fs.existsSync(keyPath), 'A local GCS service-account JSON key is required for a new destination').toBeTruthy();
        const key = fs.readFileSync(keyPath!, 'utf8');
        expect(JSON.parse(key).type, 'The supplied key must be a service-account key').toBe('service_account');
        await panel.getByRole('button', { name: 'Add New Destination', exact: true }).click();
        await page.getByRole('dialog', { name: 'Select Destination Provider' })
          .getByText('Google Cloud Storage', { exact: true }).click();
        const dialog = page.getByRole('dialog', { name: 'Add New Destination' });
        await dialog.getByRole('textbox', { name: 'Service Account JSON *', exact: true }).fill(key);
        await dialog.getByRole('textbox', { name: 'Bucket Name *', exact: true }).fill(process.env.RHOMBUS_GCS_BUCKET!);
        await dialog.getByRole('button', { name: 'Create Destination', exact: true }).click();
        await expect(dialog).toBeHidden();
        known = await destinations();
      }
      const selected = known.filter((d: any) => d.name === process.env.RHOMBUS_GCS_BUCKET && d.storage_provider === 'gcp');
      expect(selected, 'The exact configured GCS bucket must identify one destination').toHaveLength(1);
      await panel.getByRole('button', { name: 'Google Cloud Storage ' + process.env.RHOMBUS_GCS_BUCKET!, exact: true }).click();
      const format = panel.getByRole('combobox');
      await format.click();
      await page.getByRole('option', { name: 'CSV', exact: true }).click();
      const filename = panel.getByRole('textbox');
      await expect(filename).toHaveCount(1);
      await filename.fill(outputPrefix);
      await panel.getByRole('button', { name: 'Apply', exact: true }).click();
      await expect.poll(async () => params(graph(await get('/nodes')).output).format_type).toBe('csv');
      output = graph(await get('/nodes')).output;
      expect(params(output).destination_id).toBe(selected[0].id);
      expect(params(output).download_local).toBe(false);
      await page.reload();
      const nodes = await get('/nodes');
      output = graph(nodes).output;
      expect(params(output).destination_id).toBe(selected[0].id);
      expect(params(graph(nodes).input).data_asset_ref).toBe(sourceIdentity.asset);
      expect(params(graph(nodes).input).source_connection_id).toBe(sourceIdentity.connection);
      expectedNodes = nodes.map(runtimeName);
      await page.getByTestId('rf__node-' + canvasNodeId(output)).click();
      await expect(page.getByRole('complementary').getByRole('textbox')).toHaveValue(outputPrefix);
      await expect(page.getByRole('complementary').getByRole('combobox')).toHaveText('CSV');
      evidence.manifest.output = { destination_type: 'gcs', destination_id: params(output).destination_id,
        format: 'csv', filename_prefix: outputPrefix };
      evidence.writeJson('configuration-saved.json', { nodes: nodeFields(nodes) });
      await evidence.screenshot(page, 'destination.png');
    });

    await step('Create and inspect this journey own enabled schedule', async () => {
      await page.getByRole('tab', { name: 'Schedule', exact: true }).click();
      await page.getByRole('button', { name: 'Add Schedule', exact: true }).click();
      const dialog = page.getByRole('dialog', { name: 'Create Schedule' });
      await dialog.getByRole('combobox').click();
      await page.getByRole('option', { name: 'Custom', exact: true }).click();
      await dialog.getByRole('textbox', { name: 'Custom Cron Expression', exact: true }).fill('* * * * *');
      creationAttempted = true;
      const pending = page.waitForResponse(r => new URL(r.url()).pathname === rootPrefix + app!.projectId + '/pipeline/schedule'
        && r.request().method() === 'POST');
      await dialog.getByRole('button', { name: 'Create', exact: true }).click();
      const response = await pending;
      expect(response.status()).toBe(200);
      const created = await response.json();
      expect(created.project_id).toBe(Number(app!.projectId));
      expect(created.id).toBeGreaterThan(0);
      expect(beforeScheduleIds).not.toContain(created.id);
      scheduleId = created.id; // Exact identity returned by this creation request.
      const requestedNodes = response.request().postDataJSON().pipeline_nodes;
      expect(requestedNodes).toHaveLength(3);
      const captured = graph(requestedNodes);
      const saved = graph(await get('/nodes'));
      expect(requestedNodes.map(runtimeName).sort()).toEqual(expectedNodes.slice().sort());
      expect(params(captured.input).data_asset_ref).toBe(sourceIdentity.asset);
      expect(params(captured.input).source_connection_id).toBe(sourceIdentity.connection);
      expect(sha256(params(captured.cleaning).code)).toBe(sha256(params(saved.cleaning).code));
      expect(params(captured.cleaning).prompt).toBe(params(saved.cleaning).prompt);
      expect(params(captured.output).destination_id).toBe(params(saved.output).destination_id);
      expect(params(captured.output).format_type).toBe('csv');
      expect(params(captured.output).download_local).toBe(false);
      const schedule = (await get('/pipeline/schedules')).find((s: any) => s.id === scheduleId);
      expect(schedule).toBeDefined();
      createdAt = schedule.created_at || new Date().toISOString();
      expect(schedule.project_id).toBe(Number(app!.projectId));
      expect(schedule.enabled).toBe(true);
      expect(schedule.frequency).toBe('custom');
      expect(schedule.cron_expression).toBe('* * * * *');
      expect(Number.isFinite(Date.parse(schedule.next_run_at))).toBe(true);
      expect(Date.parse(schedule.next_run_at)).toBeGreaterThanOrEqual(Date.parse(createdAt!) - 1000);
      evidence.manifest.schedule = scheduleFields(schedule);
      evidence.manifest.schedule_create = { status: response.status(), captured_nodes: nodeFields(requestedNodes) };
      await showHistory();
      const history = await get('/pipeline/schedules/' + scheduleId + '/executions');
      expect(Array.isArray(history.executions)).toBe(true);
      evidence.writeJson('schedule-created.json', { schedule: scheduleFields(schedule), history: { total: history.total,
        executions: history.executions.map(runFields) } });
      await evidence.screenshot(page, 'schedule-created.png');
      evidence.manifest.journey_configuration_verified = true;
      evidence.checkpoint();
    });

    if (verifyDelivery) await step('Verify a fresh scheduled execution and its actual GCS output', async () => {
      const nextRun = Date.parse(evidence.manifest.schedule.next_run_at);
      const deadline = nextRun + graceSeconds * 1000;
      expect(deadline - Date.now()).toBeLessThanOrEqual((graceSeconds + 90) * 1000);
      evidence.manifest.automatic_trigger_attempted = true;
      evidence.manifest.observation = { started_at: new Date().toISOString(), trigger_at: new Date(nextRun).toISOString(),
        deadline_at: new Date(deadline).toISOString(), poll_interval_seconds: 30, samples: [] };
      let latestObjects = beforeObjects;
      let assessment: any;
      let correlated: any;
      let lastValidAt: number | undefined;
      let latestObservationError: unknown;
      const observe = async () => {
        const history = await get('/pipeline/schedules/' + scheduleId + '/executions');
        expect(Array.isArray(history.executions), 'History must contain an executions array').toBe(true);
        const state = (await get('/pipeline/schedules')).find((s: any) => s.id === scheduleId);
        expect(state?.enabled, 'The diagnostic schedule must remain enabled throughout observation').toBe(true);
        const objects = await cloud!.listOutputs();
        expect(Array.isArray(objects), 'Cloud output listing must be valid').toBe(true);
        const checked = assessScheduledExecution(history.executions, {
          projectId: app!.projectId, scheduleId, createdAt, baselineIds: [],
          expectedNodeNames: expectedNodes, now: Date.now(),
        });
        const match = checked.state === 'success' ? findFreshOutput(beforeObjects, objects, {
          prefix: outputPrefix, executionStartedAt: checked.execution.started_at,
          executionCompletedAt: checked.execution.completed_at,
        }) : undefined;
        latestObjects = objects;
        assessment = checked;
        correlated = match;
        lastValidAt = Date.now();
        latestObservationError = undefined;
        evidence.manifest.observation.samples.push({
          at: new Date(lastValidAt).toISOString(), schedule: scheduleFields(state), history_total: history.total,
          executions: history.executions.map(runFields), objects,
          execution_assessment: { state: checked.state, reason: checked.reason },
          output_assessment: match?.reason,
        });
        evidence.manifest.observation.last_valid_at = new Date(lastValidAt).toISOString();
        evidence.checkpoint();
        return checked.state === 'failed' ? 'failed'
          : checked.state === 'success' && match?.object ? 'verified' : 'pending';
      };
      const recordObservationError = (error: unknown) => {
        latestObservationError = error;
        (evidence.manifest.observation.errors ||= []).push({ at: new Date().toISOString(),
          error: (error instanceof Error ? error.message : String(error)).slice(0, 2000) });
      };
      try {
        let pollTimedOut = false;
        try {
          await expect.poll(async () => {
            try { return await observe(); }
            catch (error) { recordObservationError(error); return 'pending'; }
          }, { timeout: Math.max(1, deadline - Date.now()), intervals: [30_000],
            message: 'A new scheduled execution must complete all nodes and deliver its own GCS object' }).not.toBe('pending');
        } catch { pollTimedOut = true; }
        if (pollTimedOut) {
          // Polling may have retried request errors or stopped before the final
          // boundary. Only a fresh complete observation can establish absence.
          try { await observe(); }
          catch (error) { recordObservationError(error); }
          if (latestObservationError || lastValidAt === undefined || lastValidAt < deadline) {
            evidence.manifest.delivery_failure_kind = 'observation_error';
            throw new Error('The deadline observation could not verify schedule history and cloud listing; output absence is unverified.');
          }
          if (assessment.state !== 'failed' && !correlated?.object) {
            const priorNames = new Set(beforeObjects.map(object => object.name));
            const freshPrefixObjects = latestObjects.filter(object => object.name.startsWith(outputPrefix)
              && !priorNames.has(object.name));
            if (freshPrefixObjects.length) {
              evidence.manifest.delivery_failure_kind = 'ambiguous_output';
              throw new Error('Fresh prefixed cloud objects exist but cannot be uniquely associated with a verified scheduled execution.');
            }
            evidence.manifest.output_absence_verified = true;
            validate(evidence);
            evidence.manifest.delivery_failure_kind = 'missing_output';
            evidence.manifest.output_validation_limit = 'A complete cloud/history observation after the deadline found no fresh prefixed output; --output-missing records bounded absence, not output quality.';
            throw new Error('The valid deadline observation found no verified scheduled delivery or fresh prefixed output.');
          }
        }
        if (assessment.state === 'failed') evidence.manifest.delivery_failure_kind = 'execution_failed';
        expect(assessment.state, assessment.reason).toBe('success');
        expect(correlated?.object, correlated?.reason || 'No associated fresh GCS object').toBeDefined();
        const bytes = await cloud!.downloadOutput(correlated.object.name);
        evidence.writeBytes('output.csv', bytes);
        evidence.manifest.execution = runFields(assessment.execution);
        evidence.manifest.output_object = { ...correlated.object, bytes: bytes.length, sha256: sha256(bytes) };
        expect(validate(evidence, 'output.csv').passed, 'The actual scheduled export must pass data validation').toBe(true);
        evidence.manifest.automatic_baseline_verified = true;
      } finally {
        evidence.manifest.observation.finished_at = new Date().toISOString();
        evidence.manifest.observation.final_objects = latestObjects;
        evidence.manifest.observation.final_objects_observed_at = lastValidAt === undefined
          ? null : new Date(lastValidAt).toISOString();
        try { await cloud!.captureOutputs(path.join(evidence.directory, 'gcs-objects.png')); }
        catch (error) { evidence.manifest.output_capture_error = error instanceof Error ? error.message : String(error); }
      }
    });

    evidence.manifest.outcome = verifyDelivery ? 'passed' : 'configuration_verified';
  } catch (error) {
    primaryError = error;
    evidence.manifest.outcome = evidence.manifest.delivery_failure_kind === 'missing_output' ? 'blocked'
      : evidence.manifest.delivery_failure_kind === 'observation_error' ? 'observation_error' : 'failed';
    try { await evidence.screenshot(page, 'failure.png'); } catch { /* Keep the checkpoint even if rendering fails. */ }
    throw error;
  } finally {
    const cleanupErrors: unknown[] = [];
    try {
      if (app && creationAttempted) {
        if (scheduleId) {
          const current = (await get('/pipeline/schedules')).find((s: any) => s.id === scheduleId);
          if (current?.enabled) {
            const response = await page.request.patch(app.apiBase + rootPrefix + app.projectId
              + '/pipeline/schedules/' + scheduleId + '/toggle', { headers: app.headers, timeout: 30_000 });
            expect(response.status(), 'Pause only the schedule created by this journey').toBe(200);
          }
          const final = (await get('/pipeline/schedules')).find((s: any) => s.id === scheduleId);
          expect(final.enabled, 'The minute-by-minute diagnostic must be inactive after the test').toBe(false);
          evidence.manifest.final_schedule = scheduleFields(final);
        } else throw new Error('The created diagnostic schedule could not be identified for cleanup.');
      }
    } catch (error) { cleanupErrors.push(error); }
    try {
      if (app && originalId && originalSchedulesCaptured) {
        const after = await get('/pipeline/schedules', originalId);
        const states = (items: any[]) => items.map(s => ({ id: s.id, enabled: s.enabled,
          cron: s.cron_expression })).sort((a, b) => a.id - b.id);
        expect(states(after), 'The original project schedules must retain their previous state').toEqual(states(originalSchedules));
        evidence.manifest.original_schedule_states_preserved = true;
      }
    } catch (error) { cleanupErrors.push(error); }
    try { await cloud?.close(); } catch (error) { cleanupErrors.push(error); }
    evidence.manifest.finished_at = new Date().toISOString();
    if (cleanupErrors.length) {
      evidence.manifest.cleanup_errors = cleanupErrors.map(error => error instanceof Error ? error.message : String(error));
      if (!primaryError) evidence.manifest.outcome = 'cleanup_failed';
    }
    try { evidence.checkpoint(); } catch (error) { cleanupErrors.push(error); }
    try {
      await testInfo.attach('journey-manifest', { path: path.join(evidence.directory, 'manifest.json'), contentType: 'application/json' });
    } catch (error) { cleanupErrors.push(error); }
    console.log('Journey evidence: ' + path.relative(process.cwd(), evidence.directory));
    if (!primaryError && cleanupErrors.length) throw cleanupErrors[0];
  }
});
