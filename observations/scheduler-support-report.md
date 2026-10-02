# Scheduled pipeline produces neither history nor GCS delivery

## Impact

**High, provisional:** a recurring baseline delivery cannot be verified. Earlier user-confirmed scheduled attempts displayed generic Success messages without an execution record or fresh GCS object. Controlled later observations returned empty histories and no new object. The scheduled baseline and drift exercises remain pending.

This report is prepared for Rhombus investigation; it has not been sent to support.

## Identifiers and configuration

- Project ID: `4266`.
- Original schedule ID: `202`; deployment name: `project-4266-schedule-1790941508`.
- Fresh diagnostic schedule ID: `208`; deployment name: `project-4266-schedule-1790950215`.
- Pipeline: S3 `baseline.csv` input → AI Builder Custom transformation → CSV GCS output.
- Sampling: disabled. The saved transformation includes all 12 cleaning steps and assigns the six requested columns to `output_df`.
- Baseline: nine source rows, five expected output rows.
- Schedule creation request: all three current pipeline nodes included; HTTP 200.
- Account tokens, service-account keys and bucket names are excluded from this public report.

## Reproduction and controls

1. Temporarily pause schedule `202` and manually run the saved pipeline. At `2026-10-02T13:49:53.588Z`, the run produces `RhombusAI_output_1790948994643.csv` in GCS. Its downloaded 320 bytes pass the baseline validator with five rows. [Manual control and actual CSV](baseline-manual.md#automated-manual-control-and-direct-gcs-verification).
2. Resume `202`, edit its hourly recurrence to minute 56, and allow the `13:56Z` boundary without clicking Run. The update returns HTTP 200 and a future `next_run_at=13:56Z`.
3. Poll its history through `14:03:41Z`: every result is `total=0`, `executions=[]`, `last_run_at=null`; `next_run_at` remains `13:56Z`. Refresh the GCS listing through `14:04:58Z`: no new object. [API and GCS samples](evidence/baseline-schedule-edited-repeat-2026-10-02.json).
4. Pause `202`, create fresh schedule `208` through the UI using custom cron `* * * * *`, with the same current saved graph. Creation at `14:10:15Z` gives a future `next_run_at=14:11Z`.
5. Use a seven-minute polling limit to observe its automatic trigger boundaries, reading the schedule-specific history and refreshing GCS. Fourteen samples from `14:10:19Z` through `14:17:06Z` all show zero history records, null `last_run_at`, stale `next_run_at=14:11Z` and no new GCS object. [Fresh-schedule capture](evidence/baseline-schedule-fresh-repeat-2026-10-03.json).

All timestamps above are UTC. The fresh diagnostic occurred shortly after midnight on 3 October in Australia/Sydney. No manual run occurred during either scheduled observation. The short-interval diagnostic is disabled after the bounded check; the original hourly minute-25 configuration is restored.

## Expected

An automatic trigger runs the saved graph, writes a fresh valid five-row GCS CSV and creates a retrievable execution record. A failed trigger or node should expose a failure status and error. Rhombus's [scheduling documentation](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/) describes execution records and captured pipeline configuration for scheduled runs.

## Investigation needed from Rhombus

Please correlate project `4266` and schedules `202`/`208` with scheduler, deployment and worker logs during the UTC windows above:

- Was each deployment registered, loaded and enabled in the scheduler?
- Did the scheduler enqueue work at the recorded cron boundaries? If it skipped a run, what was the reason?
- Did a worker receive the job and load the saved three-node graph and cloud credential references?
- Was an execution record created, and if so why is the schedule-specific API returning zero records?
- If execution or GCS export failed before a record was stored, where is that error logged?
- Why do `next_run_at` and `last_run_at` remain unchanged after the trigger boundaries?

The manual control verifies the manual pipeline and GCS delivery path. It does not prove that scheduled workers have the same credentials or that any scheduled job was dispatched. The specific backend cause remains unconfirmed. The existing AI Builder suggestion to disable sampling did not restore history in the observed repeat.

## Acceptance after repair

Allow an automatic run of the unchanged baseline, then verify an execution ID and successful status, actual completion of the three nodes, a new GCS object associated with that run, and a passing validator result. Only then mark the scheduled baseline successful and proceed with drift runs.

## Work that can continue during investigation

Manual baseline repeats and manual schema/semantic drift tests can provide supplementary evidence about cleaning, data validation and chatbot repair. Label their trigger type explicitly and leave scheduled coverage unverified. The [continuation plan](../README.md#continuing-while-scheduled-delivery-is-unresolved) preserves the required automatic baseline and later scheduled repeats; it does not treat the fallback as completion of those requirements.
