function timestamp(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === 'number') return Number.isFinite(value) ? value : NaN;
  return typeof value === 'string' && value.trim() ? Date.parse(value) : NaN;
}

function sameId(actual, expected) {
  return actual !== null && actual !== undefined && String(actual) === String(expected);
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
