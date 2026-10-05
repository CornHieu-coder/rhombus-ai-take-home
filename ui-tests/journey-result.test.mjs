import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assessHistoryWindow, assessNextRun, assessScheduleHistory, assessScheduledExecution, findFreshOutput,
} from './journey-result.mjs';

const options = {
  projectId: 4266,
  scheduleId: 300,
  createdAt: '2026-10-03T05:00:00Z',
  baselineIds: [16454],
  expectedNodeNames: ['s3_input', 'cleaned_orders', 'cloud_output'],
  now: '2026-10-03T05:10:00Z',
};

function execution(overrides = {}) {
  return {
    id: 17000, project_id: 4266, schedule_id: 300, trigger: 'scheduled',
    started_at: '2026-10-03T05:01:00Z', completed_at: '2026-10-03T05:02:00Z',
    success: true, completed_nodes: ['s3_input', 'cleaned_orders', 'cloud_output'],
    failed_node: null, total_duration_seconds: 60, ...overrides,
  };
}

const outputOptions = {
  prefix: 'journey-300-',
  executionStartedAt: '2026-10-03T05:01:00Z',
  executionCompletedAt: '2026-10-03T05:02:00Z',
};

test('accepts only complete scheduled records and both explicit scheduled trigger spellings', () => {
  for (const trigger of ['scheduled', 'schedule']) {
    const run = execution({ trigger });
    const result = assessScheduledExecution([run], { ...options, projectId: '4266', scheduleId: '300' });
    assert.equal(result.state, 'success');
    assert.equal(result.execution, run);
  }
});

test('rejects baseline, pre-window, manual and unrelated successes', () => {
  for (const override of [
    { id: 16454 }, { id: undefined }, { id: null }, { id: '' },
    { started_at: '2026-10-03T04:59:59Z' },
    { trigger: 'manual' }, { trigger: undefined }, { project_id: 999 },
    { schedule_id: 301 }, { schedule_id: null },
  ]) {
    assert.equal(assessScheduledExecution([execution(override)], options).state, 'pending');
  }
});

test('newest scheduled failure wins over an earlier complete success', () => {
  const older = execution();
  for (const override of [{ success: false }, { failed_node: 'cleaned_orders' }]) {
    const newest = execution({
      id: 17001, started_at: '2026-10-03T05:03:00Z',
      completed_at: '2026-10-03T05:04:00Z', ...override,
    });
    const result = assessScheduledExecution([newest, older], options);
    assert.equal(result.state, 'failed');
    assert.equal(result.execution, newest);
  }
});

test('a newest incomplete record cannot fall back to an older success', () => {
  const older = execution();
  for (const [override, state] of [
    [{ completed_at: null }, 'pending'],
    [{ success: undefined }, 'pending'],
    [{ failed_node: undefined }, 'pending'],
    [{ completed_nodes: ['s3_input', 'cleaned_orders'] }, 'failed'],
    [{ completed_nodes: undefined }, 'failed'],
  ]) {
    const newest = execution({
      id: 17001, started_at: '2026-10-03T05:03:00Z',
      completed_at: '2026-10-03T05:04:00Z', ...override,
    });
    const result = assessScheduledExecution([older, newest], options);
    assert.equal(result.state, state);
    assert.equal(result.execution, newest);
  }
  assert.equal(assessScheduledExecution([older], { ...options, expectedNodeNames: [] }).state, 'pending');
});

test('unverifiable ordering and inconsistent completion timestamps cannot establish success', () => {
  for (const completed_at of ['not-a-date', '2026-10-03T05:00:59Z', '2026-10-03T05:11:00Z']) {
    assert.equal(assessScheduledExecution([execution({ completed_at })], options).state, 'failed');
  }
  assert.equal(assessScheduledExecution([
    execution(), execution({ id: 17001, started_at: null }),
  ], options).state, 'pending');
  assert.equal(assessScheduledExecution([
    execution(), execution({ id: 17001, started_at: '2026-10-03T05:11:00Z' }),
  ], options).state, 'pending');
  assert.equal(assessScheduledExecution([execution()], { ...options, createdAt: 'invalid' }).state, 'pending');
});

test('matches a uniquely fresh prefixed object within execution timestamps', () => {
  const prior = { name: 'journey-300-old.csv', createdAt: '2026-10-03T04:00:00Z' };
  const fresh = { name: 'journey-300-new.csv', createdAt: '2026-10-03T05:01:30Z' };
  assert.equal(findFreshOutput([prior], [prior, fresh], outputOptions).object, fresh);
  for (const createdAt of [outputOptions.executionStartedAt, outputOptions.executionCompletedAt]) {
    const boundary = { name: 'journey-300-boundary.csv', createdAt };
    assert.equal(findFreshOutput([], [boundary], outputOptions).object, boundary);
  }
});

test('existing names, unrelated prefixes and objects outside the execution window do not match', () => {
  const existing = { name: 'journey-300-existing.csv', createdAt: '2026-10-03T05:01:30Z' };
  assert.equal(findFreshOutput([existing], [existing], outputOptions).object, undefined);
  for (const candidate of [
    { name: 'other-new.csv', createdAt: '2026-10-03T05:01:30Z' },
    { name: 'journey-300-early.csv', createdAt: '2026-10-03T05:00:59Z' },
    { name: 'journey-300-late.csv', createdAt: '2026-10-03T05:02:01Z' },
  ]) {
    assert.equal(findFreshOutput([], [candidate], outputOptions).object, undefined);
  }
});

test('multiple qualifying objects remain ambiguous', () => {
  const result = findFreshOutput([], [
    { name: 'journey-300-a.csv', createdAt: '2026-10-03T05:01:20Z' },
    { name: 'journey-300-b.csv', createdAt: '2026-10-03T05:01:30Z' },
  ], outputOptions);
  assert.equal(result.object, undefined);
  assert.match(result.reason, /ambiguous/i);
});

test('missing metadata or invalid correlation boundaries remain unverified', () => {
  const unknown = { name: 'journey-300-unknown.csv' };
  const valid = { name: 'journey-300-valid.csv', createdAt: '2026-10-03T05:01:30Z' };
  for (const objects of [[unknown], [unknown, valid]]) {
    const result = findFreshOutput([], objects, outputOptions);
    assert.equal(result.object, undefined);
    assert.match(result.reason, /timestamp|metadata/i);
  }
  for (const override of [
    { prefix: '' }, { executionStartedAt: null },
    { executionCompletedAt: 'invalid' },
    { executionCompletedAt: '2026-10-03T05:00:00Z' },
  ]) {
    assert.equal(findFreshOutput([], [valid], { ...outputOptions, ...override }).object, undefined);
  }
});

test('next-run checks reject parseable stale timestamps and the current-time boundary', () => {
  for (const nextRunAt of ['2026-10-03T04:59:00Z', options.now]) {
    assert.equal(assessNextRun(nextRunAt, { now: options.now }).state, 'stale');
  }
  assert.equal(assessNextRun('2026-10-03T05:11:00Z', { now: options.now }).state, 'future');
});

test('next-run checks require valid next-run and observation timestamps', () => {
  for (const nextRunAt of [undefined, null, '', 'not-a-date']) {
    assert.equal(assessNextRun(nextRunAt, { now: options.now }).state, 'invalid');
  }
  assert.equal(assessNextRun('2026-10-03T05:11:00Z', { now: 'invalid' }).state, 'invalid');
});

test('history windows require an explicit valid ISO timestamp with a timezone', () => {
  for (const windowStart of [
    undefined, null, '', 1791003600000, 'invalid', '2026-10-03',
    '2026-10-03T05:00:00', '2026-02-30T05:00:00Z', '2026-10-03T05:11:00Z',
  ]) {
    assert.equal(assessHistoryWindow(windowStart, options.now).valid, false);
  }
  assert.equal(assessHistoryWindow(options.createdAt, 'invalid').valid, false);
  for (const windowStart of [options.createdAt, '2026-10-03T15:00:00+10:00', options.now]) {
    assert.equal(assessHistoryWindow(windowStart, options.now).valid, true);
  }
});

const historyOptions = {
  projectId: options.projectId,
  scheduleId: options.scheduleId,
  windowStart: options.createdAt,
  now: options.now,
};

test('history presence correlates project, schedule, automatic trigger and inclusive start window', () => {
  for (const trigger of ['scheduled', 'schedule']) {
    for (const started_at of [options.createdAt, '2026-10-03T05:01:00Z', options.now]) {
      const run = execution({ trigger, started_at });
      const result = assessScheduleHistory([run], {
        ...historyOptions, projectId: '4266', scheduleId: '300',
      });
      assert.equal(result.state, 'present');
      assert.deepEqual(result.executions, [run]);
    }
  }
});

test('history filtering accepts the same trimmed window timestamp as prerequisite validation', () => {
  const windowStart = ' 2026-10-03T05:00:00Z ';
  const run = execution({ started_at: options.createdAt });
  assert.equal(assessHistoryWindow(windowStart, options.now).valid, true);
  const result = assessScheduleHistory([run], { ...historyOptions, windowStart });
  assert.equal(result.state, 'present');
  assert.deepEqual(result.executions, [run]);
});

test('old, future, manual, unrelated and untraceable records cannot satisfy history presence', () => {
  for (const overrides of [
    { started_at: '2026-10-03T04:59:59Z' }, { started_at: '2026-10-03T05:10:01Z' },
    { started_at: undefined }, { started_at: 'invalid' },
    { trigger: 'manual' }, { trigger: undefined }, { project_id: 999 },
    { project_id: undefined }, { schedule_id: 301 }, { schedule_id: null },
    { id: undefined }, { id: null }, { id: '' },
  ]) {
    const result = assessScheduleHistory([execution(overrides)], historyOptions);
    assert.equal(result.state, 'missing');
    assert.deepEqual(result.executions, []);
  }
  assert.equal(assessScheduleHistory([], historyOptions).state, 'missing');
});

test('missing history prerequisites cannot fall back to an old execution record', () => {
  const oldRun = execution({ started_at: '2026-10-02T05:01:00Z' });
  for (const overrides of [
    { windowStart: undefined }, { windowStart: 'invalid' },
    { windowStart: '2026-10-03T05:11:00Z' }, { now: 'invalid' },
    { projectId: undefined }, { scheduleId: undefined },
  ]) {
    const result = assessScheduleHistory([oldRun], { ...historyOptions, ...overrides });
    assert.equal(result.state, 'invalid');
    assert.deepEqual(result.executions, []);
  }
});

test('an in-window incomplete automatic attempt establishes history presence only', () => {
  const run = execution({ completed_at: null, success: false, completed_nodes: [] });
  assert.equal(assessScheduleHistory([run], historyOptions).state, 'present');
  assert.equal(assessScheduledExecution([run], options).state, 'pending');
});
