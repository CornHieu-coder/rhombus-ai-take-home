# Bug report: scheduled pipeline produces neither history nor GCS delivery

## Impact

**High, provisional:** a recurring baseline delivery cannot be verified. Earlier user-confirmed scheduled attempts displayed generic Success messages without an execution record or fresh GCS object. Controlled later observations returned empty histories and no new object. The scheduled baseline and drift exercises remain pending.

The user sent this issue and its evidence to Rhombus on 3 October 2026 at 02:19 Sydney time. After support requested a Dashboard check, the new results below were added for the follow-up.

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

These restoration settings describe the end of that controlled experiment. The user later replaced schedules 202/208 with schedule **209**, changed it to hourly minute 16, and paused it. The baseline upload completed at `15:15:48Z`, before the `15:16Z` boundary; actual downloaded source bytes were verified afterward. Enabled samples at `15:17:05Z` and `15:17:22Z` show zero history and no fresh GCS object. Later samples are paused, so this is a short observation rather than five minutes of active scheduling coverage. [Selected evidence and limits](evidence/baseline-schedule-user-repeat-2026-10-03.json). No schedule toggles were sent by this watcher.

Three manual baseline outputs with matching runtime configuration now pass ordered determinism as well as the cleaning checks. Actual S3 source bytes match the repository baseline. [Source and three-run provenance](evidence/baseline-manual-repeats-2026-10-03.json), [validator report](evidence/baseline-manual-determinism-validation.json).

## Expected

An automatic trigger runs the saved graph, writes a fresh valid five-row GCS CSV and creates a retrievable execution record. A failed trigger or node should expose a failure status and error. Rhombus's [scheduling documentation](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/) describes execution records and captured pipeline configuration for scheduled runs.

## Dashboard check requested by support — 3 October 2026

At **10:02 Sydney time** (`00:02Z`), Playwright opened **Dashboard → Executions**, as requested. Executions are visible there, and the global history API returns **13 records**. All 13 belong to project 4266, have `trigger=manual`, and have `schedule_id=null`. The API returned all 13 records on one page; the UI screenshot displays the first 10 with pagination `1-10 of 13`.

- Global endpoint: `GET /api/dataset/analyzer/v2/pipeline/executions/all`, HTTP 200, `total=13`, `page_size=100`.
- Current schedule 209 history: HTTP 200, `total=0`, `executions=[]`.
- Schedule 209 remains paused, with `last_run_at=null` and the old `next_run_at=2026-10-02T15:16:00Z`.
- The global records include successful manual baseline runs **16454, 16456 and 16457**, and manual drift records **16459** (added column, Success), **16460** (changed type, Success), and **16461** (missing amount, Failure). These IDs correlate by project, manual trigger and timestamps with the previously captured runs; the earlier asynchronous task IDs are separate identifiers.
- [Selected API evidence](evidence/dashboard-executions-2026-10-03.json), [redacted Dashboard screenshot](evidence/dashboard-executions-2026-10-03.png), [visible table transcript](evidence/dashboard-executions-2026-10-03.txt).

**Conclusion:** the Dashboard provides manual execution history, but the returned records do not establish any successful automatic run. This read-only check did not change schedules or click Run. Current paused time is not counted as a failed automatic trigger; the earlier enabled observation windows remain the reproduction evidence. GCS was not newly queried during this Dashboard check.

The required successful automatic baseline and scheduled drift cases remain incomplete. The follow-up asks Rhombus to investigate the scheduling bug and explicitly confirm a working environment or an acceptable fallback for the take-home.

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
