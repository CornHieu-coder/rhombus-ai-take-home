# Scheduled baseline: Success log without history or GCS output

## Result and severity

**Outcome:** the user confirmed an automatic scheduled execution at 10:04 PM. Rhombus reported successful completion, but the schedule-specific history remained empty and no new GCS output was found. A later repeat showed the same visible symptoms at 10:30:05 PM after the schedule's minute setting changed from 00 to 25. A successful scheduled ETL baseline has not been demonstrated.

**Severity: High, provisional.** The expected data delivery is missing while the platform reports Success, and the execution history does not provide a record to investigate. Authenticated Playwright inspection independently confirms an empty backend history. The underlying cause and direct GCS verification remain unresolved.

## Setup and reproduction

1. Use the unchanged nine-row `datasets/baseline.csv` at the S3 key configured in the project.
2. Use the connected S3 Data Input → Custom cleaning transformation → GCS Data Output pipeline. The preceding node previews showed the expected five cleaned rows, and a GCS object was created at 9:29:38 PM. That object's CSV bytes have not yet been validated.
3. Enable a recurring schedule. The supplied schedule card shows Hourly at minute 00, Active, with its enable switch on.
4. Allow an automatic execution rather than clicking Run. The user confirmed that the 10:04 PM execution came from the schedule; the screenshot alone does not identify its trigger or execution date.
5. Compare the execution log, schedule history, and GCS object listing. The supplied screenshots show successful completion at 10:04:26 PM, no schedule-history rows, and no object newer than the earlier 9:29 PM export.

6. Edit the existing schedule's minute setting from 00 to 25 and allow the next automatic attempt while retaining the baseline pipeline. The follow-up screenshots show another generic start/Success pair at 10:30:05 PM, an empty history, and the same two earlier GCS objects.

The saved timezone, configuration at the exact trigger, schedule update time, and creation time have not been captured. The second attempt repeats the visible mismatch; its trigger field is inferred from the ongoing automatic-repeat procedure rather than independently retrieved.

## Expected behavior

Run the saved three-node pipeline, write a fresh GCS output with the five expected order IDs (`1001`, `1002`, `1006`, `1007`, `1008`), and create a scheduled execution record. If a node or export fails, report the failure and enough detail to diagnose it. Rhombus [documents that scheduled executions create records and use a captured pipeline configuration](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/).

## Actual behavior and evidence

- The log crop shows both start and successful completion at 10:04:26 PM. It contains no visible transformation or export details; the crop cannot establish whether those nodes ran.
- Schedule History says `No results.` and shows zero records.
- The Active schedule's `Next run:` has no visible value.
- The newest visible GCS object is `RhombusAI_output_1790940577138.csv`, created on 2 October 2026 at 9:29:38 PM. The user confirmed no output appeared for the scheduled execution.
- [Screenshot transcription and user confirmation](evidence/baseline-schedule-visible-evidence.md).
- [Missing-output validator report](evidence/baseline-scheduled-output-missing.json): `passed=false`, `output_exists=false`, `expected_rows=5`, `output_rows=null`. The validator used the repository's baseline source and the explicit `--output-missing` flag; it did not query GCS. Output schema, row count, cleaning rules, and determinism were not evaluated.
- [Repeat screenshot transcription](evidence/baseline-schedule-repeat-visible-evidence.md): minute 25, Success at 10:30:05 PM, no history rows, blank Next run, and no visible new object. The [repeat missing-output report](evidence/baseline-scheduled-repeat-output-missing.json) also fails the output-exists check; row-level output checks remain unevaluated.

## Chatbot diagnosis and repair

The [captured AI Builder exchange](evidence/baseline-schedule-chatbot-2026-10-02.md) is now available from the authenticated chat-history API. At `2026-10-02T12:37:25.262Z` the builder persisted a source-node change from sampling enabled to disabled. It confirmed the three-node wiring and all 12 cleaning steps, and stated it could not access scheduler node logs, GCS contents, scheduler credential scope, or the executed pipeline snapshot.

The builder attributed missing export/history to sampling and promised the next run would write GCS. This is a hypothesis, not a verified cause. The saved source configuration independently reads `sampling_enabled=false`; verification of scheduled behavior is recorded below.

## Authenticated automated inspection

On 2026-10-02, the signed-in Playwright session read the real backend APIs and opened the schedule history. [Selected API fields](evidence/baseline-schedule-playwright-2026-10-02.json) and a [redacted screenshot](evidence/baseline-schedule-playwright-2026-10-02.png) show:

- Schedule ID `202`, project ID `4266`, enabled, hourly cron `25 * * * *`, failure notification enabled.
- History endpoint returned HTTP 200, `executions=[]`, `total=0`. The empty table agrees with the backend; it is not solely a table-rendering symptom.
- Backend `next_run_at=2026-10-02T12:25:00Z`, already in the past at capture time `13:26:02Z`; `last_run_at=null`.
- The UI renders `Next run:` without a value despite the backend's non-null field. This is a distinct display mismatch.
- The saved S3 input, cleaning transformation and configured CSV output remain connected. Sampling is disabled.

`npm run test:all -- --workers=1` completed with 5 passed, 3 failed, 1 skipped. The direct history assertion failed because `total=0`; the UI Next run assertion failed on the blank value; the UI history assertion failed on the visible `No results.` cell. The full provisioning scaffold was skipped because cloud setup settings are absent. An intermittent Ad Blocker dialog is handled by choosing Continue Anyway; it is not counted as the history defect.

### Repeat after the chatbot repair

The [bounded automatic-run observation](evidence/baseline-schedule-after-chatbot-2026-10-02.json) polled the real schedule and history APIs every 30 seconds from `13:24:06Z` through `13:30:40Z` (11:24:06–11:30:40 PM Sydney). This spans the next hourly minute-25 boundary and allows roughly six minutes afterward. Sampling was already disabled; no manual run or schedule edit was performed during this window.

Every observed history response remained `total=0`, with `last_run_at=null` and unchanged, stale `next_run_at=12:25Z`. The chatbot change did **not restore execution history within this observation window**. This does not prove a scheduled job executed, rule out a longer delay, or independently establish whether GCS received an object. The scheduled baseline remains unverified, and the sampling explanation remains unsupported by a successful repeat.

## Next checks and limits

The backend history has now been inspected and the chatbot exchange preserved. Complete scheduler node logs and export results are still needed to identify the failed component. No execution ID can be recorded while the history API returns no executions. Fresh GCS contents have not been independently queried by this automated inspection.

This is an observed delivery/history mismatch with a user-confirmed scheduled trigger. It does not establish which backend component failed, whether the export was skipped or rejected, or why Success was reported. Drift tests have not yet been performed.
