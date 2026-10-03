# Scheduler failure: no history or fresh GCS delivery in observed windows

## Impact

**High, provisional:** recurring baseline delivery could not be verified. Controlled enabled-schedule checks returned no execution record and no fresh GCS object within their recorded windows. A manual control of the saved pipeline delivered a valid export. This blocked the required successful scheduled baseline and subsequent scheduled drift exercise.

The specific backend cause is unknown. These observations do not prove that a scheduled job was dispatched or rule out a longer delay.

## Support guidance and effect on the take-home

On **3 October 2026 at 14:08 Sydney time** (`04:08Z`), Rhombus advised that manual drift results need not be submitted and that the submission should explain how scheduling prevented progress, in the README or another appropriate file. This report follows that direction; private correspondence is not published.

| Original exercise stage | Effect of the blocker |
| --- | --- |
| Wait for one successful scheduled baseline | No automatic run with a retrievable execution record and fresh validated GCS output was established |
| Change schema individually and together before later scheduled runs | Scheduled drift handling was not evaluated |
| Test at least two semantic changes and validate outputs | Datasets and validator cases exist; live scheduled semantic handling was not evaluated |
| Ask the chatbot to diagnose/fix each issue and check scheduling afterward | Sampling suggestion was applied to the baseline issue, but repeats did not verify recovery; per-drift repairs and recovery were not evaluated |

The reply provides a documentation route for the blocked exercise. It does not confirm a fix, identify a backend cause or explicitly waive UI automation, API tests, the validator or the video. The [README checklist](../README.md#remaining-submission-checklist) records the remaining work.

## Identifiers and configuration

- Project `4266`: Rhombus QA Take Home.
- Saved graph: S3 `baseline.csv` → AI Builder Custom transformation → CSV GCS destination.
- Baseline: nine source rows, five expected output rows; sampling disabled in the recorded configuration.
- Original schedule `202`; fresh diagnostic schedule `208`. These were later replaced by user-created `209`.
- Last verified current state: `209` paused by the user. Paused time is not treated as failed scheduling.
- Account tokens, service-account keys and bucket names are excluded from public captures.

All experiment timestamps below are UTC. Sydney was UTC+10 during these captures; late UTC windows fall on 3 October locally.

## Chatbot diagnosis and automated checks

At `2026-10-02T12:37:25.262Z`, AI Builder persisted a source sampling change from enabled to disabled. It confirmed the graph and cleaning steps, while stating that it could not inspect scheduler node logs, GCS contents, scheduler credential scope or the executed pipeline snapshot. It attributed missing export/history to sampling and promised a later GCS write. This was a hypothesis, not a verified cause. [Captured exchange](evidence/baseline-schedule-chatbot-2026-10-02.md).

Authenticated inspection of schedule 202 returned HTTP 200 with `executions=[]`, `total=0`, `last_run_at=null` and a stale `next_run_at=12:25Z`. The UI showed an empty history and no Next run value. [Selected API fields](evidence/baseline-schedule-playwright-2026-10-02.json), [masked screenshot](evidence/baseline-schedule-playwright-2026-10-02.png).

The [post-chatbot observation](evidence/baseline-schedule-after-chatbot-2026-10-02.json) polled the schedule/history APIs from `13:24:06Z` through `13:30:40Z`, across an enabled hourly minute-25 boundary. History stayed empty, last-run stayed null and next-run stayed stale. No manual run or schedule edit occurred in this window. **GCS was not directly queried in this window**, so this establishes no history recovery, not cloud-output absence.

On 2 October, `npm run test:all -- --workers=1` completed with **5 passed, 3 failed, 1 skipped**: canvas and four API checks passed; API history, UI history and UI Next run failed; the journey scaffold skipped. A targeted UI history regression on 3 October still failed on the real `No results.` cell. These are dated live results, not fresh results for the current paused schedule or updated test commands.

## Reproduction and controls

The following records describe the completed historical experiment. They do not instruct a reviewer to use retired schedule IDs.

### Manual delivery control

With schedule 202 paused, Playwright clicked Run at `2026-10-02T13:49:53.588Z`. The saved graph produced `RhombusAI_output_1790948994643.csv`. Its actual GCS download was 320 bytes and passed the baseline checks with five rows. Two subsequent manual exports with matching recorded runtime fingerprints also matched. Actual S3 source bytes equal the repository baseline.

[Manual control, source and three-output validation](baseline-manual.md#automated-manual-control-and-direct-gcs-verification) establish the manual path and ordered consistency. They do not prove scheduled workers share its credential context.

### Existing schedule after an edit

1. Resume 202 and edit its hourly recurrence to minute 56. The update returned HTTP 200 and a future `next_run_at=2026-10-02T13:56:00Z`.
2. Allow the boundary without clicking Run.
3. History samples from `13:53:03Z` through `14:03:41Z` all returned zero records and null last-run; next-run did not advance from `13:56Z`.
4. Independent authenticated GCS refreshes from `13:52:57Z` through `14:04:58Z` returned the same three objects, with the manual control remaining newest.

[API/GCS samples](evidence/baseline-schedule-edited-repeat-2026-10-02.json), [masked history screenshot](evidence/baseline-schedule-edited-repeat-2026-10-02.png). No manual run occurred during the window. A final GCS element screenshot timed out after successful listing checks; no such screenshot is claimed.

### Fresh schedule with the saved graph

With 202 disabled, create schedule 208 through the UI with custom cron `* * * * *`. Creation at `14:10:15Z` included all three current nodes, returned HTTP 200 and set future next-run `14:11Z`.

Fourteen samples from `14:10:19Z` through `14:17:06Z` showed zero history, null last-run, unchanged next-run and no new GCS object. The first two next-run samples were future; it became stale after the boundary. [Fresh-schedule capture](evidence/baseline-schedule-fresh-repeat-2026-10-03.json).

No manual run occurred during this window. After the bounded diagnostic, 208 was disabled and 202's hourly minute-25 configuration restored. The [restoration capture](evidence/baseline-schedule-final-2026-10-03.json) and [screenshot](evidence/baseline-schedule-final-2026-10-03.png) show a future next-run rendering as “in 3 mins.” The blank value associated with stale timestamps is a monitoring symptom; an independent rendering defect is not established.

### Later user-created schedule

The user replaced 202/208 with 209, configured hourly minute 16 and later paused it. The baseline upload completed at `15:15:48Z`, before the `15:16Z` boundary; downloaded source bytes were verified afterward.

Enabled samples at `15:17:05Z` and `15:17:22Z` showed zero history and no fresh object. Schedule 209 was first observed paused at `15:17:38Z`; the user confirmed pausing it. Later samples are paused, so this is short enabled coverage, not a full active five-minute repeat. The read-only watcher sent no schedule toggles. [Selected evidence and limits](evidence/baseline-schedule-user-repeat-2026-10-03.json).

## Expected

An automatic trigger should execute the saved graph, create a retrievable execution record and deliver a fresh valid five-row CSV. Failure should expose its status and diagnostic error. Rhombus's [scheduling guide](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/) describes scheduled execution records and captured pipeline configuration.

Earlier user-confirmed automatic attempts showed generic Success messages in supplied screenshots. Those crops did not independently identify the trigger or executed nodes. The controlled API/GCS windows above provide the stronger reproduction evidence. Earlier screenshot transcriptions remain in [immutable history](evidence/README.md#historical-code-and-archives).

## Dashboard check requested by support — 3 October 2026

At **10:02 Sydney time** (`00:02Z`), Playwright opened Dashboard → Executions following support's advice. The global endpoint `GET /api/dataset/analyzer/v2/pipeline/executions/all` returned HTTP 200, `total=13`, `page_size=20` and all 13 records. The screenshot displays the first ten with pagination `1-10 of 13`.

Every returned record belongs to project 4266 and is classified `trigger=manual`, `schedule_id=null`. Manual baseline executions 16454, 16456 and 16457 correlate with the controls by project and timestamps; their integer execution IDs differ from asynchronous task UUIDs. The complete capture preserves all returned records, including exploratory work.

Schedule 209's own history still returned HTTP 200, zero records and an empty executions list. It remained paused with null last-run and old next-run `2026-10-02T15:16:00Z`.

[Selected API evidence](evidence/dashboard-executions-2026-10-03.json), [masked Dashboard screenshot](evidence/dashboard-executions-2026-10-03.png), [table transcript](evidence/dashboard-executions-2026-10-03.txt).

This read-only check confirms that manual records are visible elsewhere. It does not establish a scheduled run, count paused time as a failed trigger or newly query GCS. The user sent these findings in the original support thread before receiving the submission guidance above.

## Reproduce a future check

If scheduling is reassessed, use current IDs and record current prerequisites:

1. Confirm the baseline source, saved three-node graph, sampling setting and GCS destination. Establish a manual export control and validate its actual downloaded bytes.
2. Record an enabled schedule's ID, recurrence, saved configuration and future next-run boundary. Use a dedicated diagnostic schedule or document an authorized edit.
3. Allow automatic boundaries without clicking Run or changing the graph. Record the observation start/end, enabled state, schedule/history API responses and independently refreshed GCS object listings.
4. Associate any fresh object with that run and validate it. If no object appears, retain listing evidence; a validator `--output-missing` flag alone is not a cloud query.
5. Record final schedule state and any restoration.

`npm run capture:schedule -- observations/evidence/my-schedule-capture` is a read-only selected-field snapshot helper. It currently selects the first enabled schedule and fails if none exists. It does **not** implement the full timed observation or independent GCS checks above.

## Investigation needed from Rhombus

Correlate project 4266 and schedules 202/208 with scheduler, deployment and worker logs during the UTC windows:

- Was the saved deployment registered, loaded and enabled?
- Was work enqueued at the boundary, or skipped with a reason?
- Did a worker receive it, load the three-node graph and obtain the cloud credential references?
- Was an execution record created? If so, why did schedule-specific history return zero?
- Where would a failure before record creation or export appear?
- Why did next-run and last-run stop advancing?

The account did not expose those internal logs. No scheduled execution ID was returned. Root cause, dispatch and the earlier generic Success messages remain unresolved.

## Verification criteria if scheduling is repaired

A successful automatic baseline needs a scheduled execution ID/status, evidence of the three nodes completing, a fresh associated GCS object and a passing validator result. These are repair acceptance criteria, not an additional attempt required before submitting the documented blocker under Rhombus's guidance.

## Remaining submission work

Complete and verify the UI journey, record the required short walkthrough of UI tests/API tests/data validation, and perform the final submission check. [README checklist](../README.md#remaining-submission-checklist). Prepared drift datasets and validator cases remain available; their live scheduled behavior is not claimed.
