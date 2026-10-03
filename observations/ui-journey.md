# Playwright UI setup journey — 3 October 2026

**The live S3 → AI Builder → GCS → schedule setup passed: 1 passed (1.4m).** The run used separate project **5252**, GCS destination **58** and schedule **215**. It ran from `2026-10-03T09:03:59.051Z` to `09:05:21.370Z` (19:03–19:05 Sydney time).

All five setup steps passed in the [run manifest](evidence/ui-journey/2026-10-03T09-03-59-050Z/manifest.json). Cleanup paused schedule 215 before its first trigger and confirmed that original schedule **209** remained paused. **Automatic delivery and the new pipeline's cleaning result were not evaluated.**

## What was being tested

The take-home requires a command-line UI test covering S3 connection, AI-built cleaning, GCS destination and scheduling, using no fixed sleeps and assertions on real outcomes. This run checked that those settings were saved in the live Rhombus application. The expected result was a connected three-node pipeline with generated code, CSV output settings and its own enabled schedule.

The original project **4266** supplied the comparison for schedule preservation. The test opened **Rhombus QA Playwright Journey**, project 5252, with no competing enabled schedule. It selected the existing `baseline.csv` S3 object using preconfigured read access and configured GCS using a local service-account key. No Python was edited manually.

<a id="assertions-and-evidence"></a>

## What happened

| Step | Verified result | Evidence |
| --- | --- | --- |
| 1. Open the separate project | Project 5252 differed from the original; it had no competing active schedule. | [Starting settings](evidence/ui-journey/2026-10-03T09-03-59-050Z/configuration-before.json) |
| 2. Select the S3 baseline | The exact `baseline.csv` key was listed at 531 bytes. The saved source selection and connection matched; the preview showed six columns and nine rows. | [Source selection](evidence/ui-journey/2026-10-03T09-03-59-050Z/source.png), [preview](evidence/ui-journey/2026-10-03T09-03-59-050Z/input-preview.png) |
| 3. Build cleaning with AI Builder | A new request completed in Pipeline mode. Three connected nodes, the ordered cleaning prompt and generated Python code were saved. | [Builder prompt](evidence/ui-journey/2026-10-03T09-03-59-050Z/builder-prompt.txt), [saved nodes and response status](evidence/ui-journey/2026-10-03T09-03-59-050Z/ai-graph.json) |
| 4. Configure GCS export | Destination 58 mapped to the selected GCS bucket. CSV and the unique filename remained saved after reload; the source selection was preserved. | [Saved settings](evidence/ui-journey/2026-10-03T09-03-59-050Z/configuration-saved.json), [destination](evidence/ui-journey/2026-10-03T09-03-59-050Z/destination.png) |
| 5. Create and inspect a schedule | Schedule creation returned HTTP 200 and ID 215. The saved source, connections, prompt/code and destination matched the schedule's pipeline. The schedule was enabled with cron `* * * * *`, and its history opened. | [Created schedule and history](evidence/ui-journey/2026-10-03T09-03-59-050Z/schedule-created.json), [schedule UI](evidence/ui-journey/2026-10-03T09-03-59-050Z/schedule-created.png) |

### Code generation and UI feedback

The Builder-created prompt initially needed code generation. Submitting Rhombus's **Regenerate With Feedback** dialog saved the code. The [submitted feedback](evidence/ui-journey/2026-10-03T09-03-59-050Z/code-generation-feedback.txt) asked Rhombus to preserve all 12 rules and their order.

The same [generated code](evidence/ui-journey/2026-10-03T09-03-59-050Z/generated-code.txt) was saved in the pipeline and included in schedule 215. Both captures record SHA-256 `8625ef23feeabf2b556952d659d6b66821f4c84e8da7af3e1b979ee967141268`.

Regeneration also starts processing in the UI. The [canvas captured during generation](evidence/ui-journey/2026-10-03T09-03-59-050Z/ai-canvas.png) showed an output error **before the GCS destination was configured**. The later setup steps passed. This processing attempt's delivery and cleaning result were not assessed.

### Schedule cleanup

Schedule 215 was created at `09:05:18.078Z`, with its next run at `09:06:00Z`. Cleanup had paused it by the run's finish at `09:05:21.370Z`, before that first trigger. Its initial history contained zero executions. That empty history does not show a scheduling failure in this run.

The manifest confirms that original project 4266's schedule **209** remained paused and its schedule states were preserved. The [scheduler report](scheduler-support-report.md) remains the detailed report of the earlier scheduling blocker; this setup run did not test recovery from it.

## Reproduce

Follow the [login and cloud prerequisites](../ui-tests/README.md#journey-prerequisites-and-isolation), fill in ignored `.env`, and run from the repository root:

```powershell
$env:RHOMBUS_RUN_PROVISIONING_JOURNEY = '1'
$env:RHOMBUS_JOURNEY_VERIFY_DELIVERY = '0'
npm run test:journey -- --workers=1
Remove-Item Env:RHOMBUS_RUN_PROVISIONING_JOURNEY
Remove-Item Env:RHOMBUS_JOURNEY_VERIFY_DELIVERY
```

The test can reuse connections available in the separate project or configure missing ones through the UI. It creates an enabled schedule and pauses that exact schedule during cleanup. See the [setup guide](../ui-tests/README.md#configuration-mode) for the five actions and what a pass proves.

## Limits

- The run checked source listing, selection and preview. It **did not independently download the current S3 bytes**. The 531-byte listing alone does not establish byte identity.
- It produced no verified scheduled CSV or output-validation report. The [original manual baseline controls](baseline-manual.md) provide real-byte cleaning and repeated-output evidence for the original pipeline.
- Static review of this new generated code found a null-ID filter but no explicit empty-string `order_id` filter. Saving the code does not certify all cleaning rules or its output quality. The code was retained as generated.
- The [additional automatic-delivery check](../ui-tests/README.md#strict-delivery-mode) is our own testing option and remains **unverified live**. The authenticated S3/GCS browser was unavailable in this session. Nine local tests of our run/file selection logic passed, without verifying the live scheduler or cloud downloads.
- A successful automatic baseline is still required before scheduled drift testing. The [canonical scheduler report](scheduler-support-report.md) explains the controlled observations and the remaining blocker.

## Other verification in this session

The original project's connected-canvas check passed. Three direct backend tests without a login passed their status and response-content checks, and all 12 validator unit tests passed. Rechecking the saved actual S3 source and three actual manual GCS exports passed all seven baseline checks, including that repeated runs produced the same ordered output.

Those manual files came from the original pipeline and do not validate this new generated code. The existing-project checks that require an enabled schedule were not rerun against user-paused schedule 209.

The [evidence index](evidence/README.md) links the curated run. It contains selected fields and masked screenshots; login data, keys, raw diagnostics and failed setup iterations remain private. Local output and publication details are in the [setup guide](../ui-tests/README.md#local-output-and-publication).
