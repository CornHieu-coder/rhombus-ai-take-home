function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  return typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
}

function sameId(actual, expected) {
  return actual !== null && actual !== undefined && String(actual) === String(expected);
}

/** A parseable timestamp alone does not establish a future next run. */
export function assessNextRun(nextRunAt, { now }) {
  const next = timestamp(nextRunAt);
  const current = timestamp(now);
  if (!Number.isFinite(next) || !Number.isFinite(current)) {
    return { state: 'invalid', reason: 'Valid next-run and observation timestamps are required.' };
  }
  if (next <= current) {
    return { state: 'stale', reason: 'An active schedule must report a next-run timestamp after the observation time.' };
  }
  return { state: 'future', reason: 'The reported next-run timestamp is after the observation time.' };
}

/** History opt-in requires a stated observation window, never an inferred default. */
export function assessHistoryWindow(windowStart, now) {
  const iso = typeof windowStart === 'string' ? windowStart.trim() : '';
  const start = timestamp(iso);
  const current = timestamp(now);
  const isoFormat = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d+)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;
  const date = timestamp(iso.slice(0, 10) + 'T00:00:00Z');
  if (!isoFormat.test(iso) || !Number.isFinite(start) || !Number.isFinite(date)
      || new Date(date).toISOString().slice(0, 10) !== iso.slice(0, 10)) {
    return { valid: false, reason: 'Set RHOMBUS_SCHEDULE_HISTORY_SINCE to a valid ISO timestamp with a timezone (for example, 2026-10-05T00:00:00Z).' };
  }
  if (!Number.isFinite(current) || start > current) {
    return { valid: false, reason: 'The history window start must not be after a valid observation time.' };
  }
  return { valid: true, reason: 'An explicit history window start and observation time are valid.' };
}

/** Establish only an automatic attempt's presence, independent of its outcome. */
export function assessScheduleHistory(executions, { projectId, scheduleId, windowStart, now }) {
  const window = assessHistoryWindow(windowStart, now);
  if (!window.valid) return { state: 'invalid', executions: [], reason: window.reason };
  if (projectId === null || projectId === undefined || String(projectId).trim() === ''
      || scheduleId === null || scheduleId === undefined || String(scheduleId).trim() === ''
      || !Array.isArray(executions)) {
    return { state: 'invalid', executions: [], reason: 'A project ID, schedule ID and executions array are required to correlate history.' };
  }
  const start = timestamp(windowStart.trim());
  const current = timestamp(now);
  const matching = executions.filter(run => {
    const started = timestamp(run?.started_at);
    return run && run.id !== null && run.id !== undefined && String(run.id).trim() !== ''
      && sameId(run.project_id, projectId) && sameId(run.schedule_id, scheduleId)
      && ['scheduled', 'schedule'].includes(run.trigger)
      && Number.isFinite(started) && started >= start && started <= current;
  });
  return matching.length > 0
    ? { state: 'present', executions: matching, reason: 'An automatic attempt for this project and schedule started within the explicit observation window.' }
    : { state: 'missing', executions: [], reason: 'No traceable automatic attempt for this project and schedule started within the explicit observation window.' };
}

/** Assess only observed execution fields; a newer incomplete run blocks older success. */
export function assessScheduledExecution(executions, {
  projectId, scheduleId, createdAt, baselineIds = [], expectedNodeNames, now,
}) {
  const created = timestamp(createdAt);
  const current = timestamp(now);
  if (!Number.isFinite(created) || !Number.isFinite(current) || created > current
      || projectId === null || projectId === undefined || String(projectId) === ''
      || scheduleId === null || scheduleId === undefined || String(scheduleId) === '') {
    return { state: 'pending', reason: 'Valid project, schedule and observation timestamps are required.' };
  }
  if (!Array.isArray(expectedNodeNames) || expectedNodeNames.length === 0
      || expectedNodeNames.some(name => typeof name !== 'string' || !name)) {
    return { state: 'pending', reason: 'Expected runtime node names are required to verify completion.' };
  }

  const baseline = new Set(Array.from(baselineIds, id => String(id)));
  const matching = (Array.isArray(executions) ? executions : []).filter(run =>
    run && sameId(run.project_id, projectId) && sameId(run.schedule_id, scheduleId)
      && ['scheduled', 'schedule'].includes(run.trigger) && !baseline.has(String(run.id)));
  if (matching.some(run => run.id === null || run.id === undefined || String(run.id) === '')) {
    return { state: 'pending', reason: 'A matching execution has no traceable ID; freshness cannot be verified.' };
  }
  if (matching.some(run => !Number.isFinite(timestamp(run.started_at)))) {
    return { state: 'pending', reason: 'A new matching record has no verified start timestamp; newest execution is unknown.' };
  }
  const eligible = matching.filter(run => timestamp(run.started_at) >= created);
  if (eligible.length === 0) {
    return { state: 'pending', reason: 'No new scheduled execution for this project and schedule in the observation window.' };
  }
  const newestStart = Math.max(...eligible.map(run => timestamp(run.started_at)));
  const newest = eligible.filter(run => timestamp(run.started_at) === newestStart);
  if (newest.length !== 1) {
    return { state: 'pending', reason: 'Newest execution is ambiguous: multiple records share its start timestamp.' };
  }
  const execution = newest[0];
  const result = (state, reason) => ({ state, execution, reason });
  if (newestStart > current) return result('pending', 'Execution start timestamp is in the future; result is unverified.');
  if (execution.completed_at === null || execution.completed_at === undefined) {
    return result('pending', 'Execution has not supplied a terminal completion timestamp.');
  }
  const completed = timestamp(execution.completed_at);
  if (!Number.isFinite(completed) || completed < newestStart || completed > current) {
    return result('failed', 'Execution completion timestamp is invalid or inconsistent with its start and observation time.');
  }
  if (execution.failed_node !== null && execution.failed_node !== undefined) {
    return result('failed', `Execution reports a failed node: ${execution.failed_node}.`);
  }
  if (execution.success === false) return result('failed', 'Execution reports unsuccessful completion.');
  if (execution.success !== true || execution.failed_node !== null) {
    return result('pending', 'Explicit success and absence of a failed node have not both been verified.');
  }
  if (!Array.isArray(execution.completed_nodes)
      || !expectedNodeNames.every(name => execution.completed_nodes.includes(name))) {
    return result('failed', 'Reported success lacks completion evidence for every expected runtime node.');
  }
  return result('success', 'New scheduled execution reports successful completion of every expected runtime node.');
}

/** Correlate a uniquely fresh object using its name and cloud creation metadata. */
export function findFreshOutput(objectsBefore, objectsAfter, {
  prefix, executionStartedAt, executionCompletedAt,
}) {
  const started = timestamp(executionStartedAt);
  const completed = timestamp(executionCompletedAt);
  if (typeof prefix !== 'string' || !prefix
      || !Number.isFinite(started) || !Number.isFinite(completed) || completed < started) {
    return { reason: 'A nonempty output prefix and valid execution timestamp window are required.' };
  }
  if (!Array.isArray(objectsBefore) || !Array.isArray(objectsAfter)) {
    return { reason: 'Both before and after cloud listings are required to verify freshness.' };
  }
  const before = new Set(objectsBefore.map(object => object?.name));
  const fresh = objectsAfter.filter(object => typeof object?.name === 'string'
    && object.name.startsWith(prefix) && !before.has(object.name));
  if (fresh.some(object => !Number.isFinite(timestamp(object.createdAt)))) {
    return { reason: 'Fresh prefixed object metadata lacks a verified creation timestamp; correlation is unverified.' };
  }
  const qualifying = fresh.filter(object => {
    const created = timestamp(object.createdAt);
    return created >= started && created <= completed;
  });
  if (qualifying.length > 1) {
    return { reason: 'Output correlation is ambiguous: multiple fresh prefixed objects fall within the execution window.' };
  }
  if (qualifying.length === 0) {
    return { reason: 'No fresh prefixed output with verified creation metadata falls within the execution window.' };
  }
  return { object: qualifying[0], reason: 'One fresh prefixed output falls within the execution timestamp window.' };
}
