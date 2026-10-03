# Scheduled baseline: Success log without history or GCS output

## Result and severity

**Outcome:** the user confirmed an automatic scheduled execution at 10:04 PM. Rhombus reported successful completion, but the schedule-specific history remained empty and no new GCS output was found. A later repeat showed the same visible symptoms at 10:30:05 PM after the schedule's minute setting changed from 00 to 25. A successful scheduled ETL baseline has not been demonstrated.

**Severity: High, provisional.** The expected data delivery is missing while earlier logs report Success, and the execution history does not provide a record to investigate. Authenticated Playwright inspection independently confirms an empty backend history. Later controlled observations directly refresh GCS and find no new output. The underlying cause remains unresolved.

## Setup and reproduction

1. Use the unchanged nine-row `datasets/baseline.csv` at the S3 key configured in the project.
2. Use the connected S3 Data Input → Custom cleaning transformation → GCS Data Output pipeline. The preceding node previews showed the expected five cleaned rows, and a GCS object was created at 9:29:38 PM. The user-provided download of that earlier object now passes all evaluated baseline checks; see the [manual observation](baseline-manual.md).
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
- The UI renders `Next run:` without a value while the backend's non-null timestamp is in the past. This is a monitoring symptom; the later future timestamp does render, so an independent rendering defect is not established.
- The saved S3 input, cleaning transformation and configured CSV output remain connected. Sampling is disabled.

`npm run test:all -- --workers=1` completed with 5 passed, 3 failed, 1 skipped. The direct history assertion failed because `total=0`; the UI Next run assertion failed on the blank value; the UI history assertion failed on the visible `No results.` cell. The full provisioning scaffold was skipped because cloud setup settings are absent. An intermittent Ad Blocker dialog is handled by choosing Continue Anyway; it is not counted as the history defect.

### Repeat after the chatbot repair

The [bounded automatic-run observation](evidence/baseline-schedule-after-chatbot-2026-10-02.json) polled the real schedule and history APIs every 30 seconds from `13:24:06Z` through `13:30:40Z` (11:24:06–11:30:40 PM Sydney). This spans the next hourly minute-25 boundary and allows roughly six minutes afterward. Sampling was already disabled; no manual run or schedule edit was performed during this window.

Every observed history response remained `total=0`, with `last_run_at=null` and unchanged, stale `next_run_at=12:25Z`. The chatbot change did **not restore execution history within this observation window**. This does not prove a scheduled job executed, rule out a longer delay, or independently establish whether GCS received an object. The scheduled baseline remains unverified, and the sampling explanation remains unsupported by a successful repeat.

## Controlled manual run and schedule comparisons

The [manual control](baseline-manual.md#automated-manual-control-and-direct-gcs-verification) ran the same current saved pipeline with sampling disabled at `2026-10-02T13:49:53.588Z`, while the only schedule was paused. It produced a new GCS object whose actual downloaded bytes pass all evaluated baseline checks. This verifies the manual delivery path; it does not establish the scheduled worker's credential scope.

### Existing schedule after an edit

Playwright edited schedule `202` to hourly minute 56. The update returned HTTP 200 and a future `next_run_at=2026-10-02T13:56:00Z`. [Selected responses and polling samples](evidence/baseline-schedule-edited-repeat-2026-10-02.json) show empty histories from `13:53:03Z` through `14:03:41Z`, including more than seven minutes after the trigger boundary. `last_run_at` remained null and the next-run timestamp stopped advancing. The [redacted screenshot](evidence/baseline-schedule-edited-repeat-2026-10-02.png) shows the empty history and blank Next run value.

Independent authenticated GCS refreshes from `13:52:57Z` through `14:04:58Z` returned the same three object names, with the manual control object remaining newest. No manual pipeline run occurred during this window. The final GCS element screenshot timed out after those successful listings; no final GCS screenshot is claimed.

### Newly created schedule with the saved graph

With `202` disabled, Playwright created fresh schedule `208` through the real UI using custom cron `* * * * *`. The creation request included all three current pipeline nodes and returned HTTP 200. The saved schedule initially had `next_run_at=14:11Z` and `last_run_at=null`.

The [fresh-schedule evidence](evidence/baseline-schedule-fresh-repeat-2026-10-03.json) contains 14 history and GCS samples from `14:10:19Z` through `14:17:06Z` (12:10–12:17 AM on 3 October in Sydney). Every history remained `total=0`, `executions=[]`, and every refreshed GCS listing contained the same three earlier objects. The next-run timestamp stayed at `14:11Z` and `last_run_at` stayed null. No manual run occurred during this comparison. Recreating the schedule did **not restore history or delivery within the observation window**.

Afterward the diagnostic every-minute schedule was disabled and retained for investigation. The original schedule `202` was restored to enabled, hourly minute 25, with failure notifications enabled. Final direct reads returned HTTP 200 and empty histories for both schedules. The final configuration and cleanup responses are included in the fresh-schedule capture.

The [final API capture](evidence/baseline-schedule-final-2026-10-03.json) and [reviewed screenshot](evidence/baseline-schedule-final-2026-10-03.png) at `14:21Z` show `next_run_at=14:25Z` and visible `Next run: in 3 mins` after restoration. This shows the UI can render a future timestamp; it does not verify the next automatic run. The earlier blank value coincided with a stale backend timestamp. The history regression was rerun with its button scoped to the enabled schedule, since the paused diagnostic card also has a history button. It reaches the real history table and still fails on `No results.`; the capture command succeeds with both cards present.

## User's later schedule check

The user later replaced schedules 202/208 with schedule 209 and changed it to hourly minute 16. Baseline was uploaded successfully at `15:15:48Z`, before the `15:16Z` boundary; its actual downloaded bytes matched the repository baseline. A read-only watcher recorded enabled samples at `15:17:05Z` and `15:17:22Z`, both with zero history, null `last_run_at`, unchanged `next_run_at=15:16Z`, and no new GCS object. The user then paused the schedule and confirmed that action. [Selected samples and limits](evidence/baseline-schedule-user-repeat-2026-10-03.json).

The watcher did not toggle schedules or click Run. Later paused samples do not add active scheduling coverage; this short check should not be described as five minutes with an active schedule. The earlier minute-10 boundary is not assessed because the schedule's state changed around it. Current schedule 209 is left paused as the user set it.

## Dashboard check after the support reply

On 3 October 2026 at 10:02 Sydney time, Playwright followed support's requested **Dashboard → Executions** check. The [global API capture](evidence/dashboard-executions-2026-10-03.json) returns 13 records, all for project 4266, all `trigger=manual` and `schedule_id=null`. The [reviewed screenshot](evidence/dashboard-executions-2026-10-03.png) shows the first 10 rows and `1-10 of 13` pagination. This identifies the location of manual history and supplies actual execution IDs; it does not establish scheduled delivery.

Schedule 209 is still paused and its own history returns zero records. No manual Run or schedule mutation occurred during this check, and no new automatic trigger was tested. The global record for the missing-column manual run is Failure, consistent with the actual cleaning error despite the contradictory canvas Success message. The support report now records this result and the remaining investigation questions.

## Next checks and limits

The backend history and GCS contents have now been independently inspected, and the chatbot exchange preserved. The configuration edit and fresh creation did not restore scheduled delivery. Complete scheduler, deployment and worker logs are needed to identify where work stops; this account exposes no such logs. No scheduled execution ID is available from the empty schedule histories; manual execution IDs are now available from Dashboard. The user sent the [investigation report](scheduler-support-report.md) to support on 3 October at 02:19 Sydney time. It contains project/schedule identifiers, UTC windows and the specific backend questions.

These bounded observations do not prove that a job was dispatched, identify which backend component failed, rule out a longer delay, or explain the earlier Success logs. Three supplementary manual drift cases are now documented individually; scheduled drift tests remain pending. A successful automatic run, real execution record and validated fresh GCS object are still required to establish the scheduled baseline. The [email draft](scheduler-email-draft.md) is ready for the user to send; no email has been sent automatically.
