# Evidence index

The [scheduler report](../scheduler-support-report.md) is the canonical finding; [manual controls](../baseline-manual.md) establish the comparison path. Timestamps within captures are UTC unless labelled otherwise. Account credentials and bucket names are excluded from public captures.

## Manual baseline controls

- [Actual S3 source](baseline-source-fetched-2026-10-03.csv) and [source/repeat provenance](baseline-manual-repeats-2026-10-03.json).
- [Control provenance](baseline-manual-control-2026-10-02.json), [masked screenshot](baseline-manual-control-2026-10-02.png), [actual control CSV](baseline-manual-control-output-2026-10-02-2349.csv) and [single-run validation](baseline-manual-control-validation.json).
- [Actual repeat 1](baseline-manual-repeat-1-2026-10-03.csv), [actual repeat 2](baseline-manual-repeat-2-2026-10-03.csv) and [three-output validation](baseline-manual-determinism-validation.json).

These are downloaded cloud bytes, separate from the validator's expected-output fixture. Replaying them establishes manual baseline cleaning and ordered consistency, not scheduled delivery.

## Scheduler diagnostics

| Evidence | What it establishes |
| --- | --- |
| [Initial API fields](baseline-schedule-playwright-2026-10-02.json), [masked screenshot](baseline-schedule-playwright-2026-10-02.png) | Enabled schedule 202, empty backend history and stale Next run |
| [Chatbot exchange](baseline-schedule-chatbot-2026-10-02.md) | Sampling suggestion, saved change and stated access limits |
| [Post-chatbot window](baseline-schedule-after-chatbot-2026-10-02.json) | Empty schedule history after an enabled boundary; no direct GCS query |
| [Edited 202](baseline-schedule-edited-repeat-2026-10-02.json), [screenshot](baseline-schedule-edited-repeat-2026-10-02.png) | Empty history and unchanged independently refreshed GCS listing |
| [Fresh 208](baseline-schedule-fresh-repeat-2026-10-03.json) | New captured graph and schedule, zero history and unchanged GCS listing across bounded checks |
| [Restoration snapshot](baseline-schedule-final-2026-10-03.json), [screenshot](baseline-schedule-final-2026-10-03.png) | Diagnostic disabled, original settings restored and a future Next run rendered |
| [User-created 209](baseline-schedule-user-repeat-2026-10-03.json) | Short enabled observation then user pause; later paused time is not active coverage |
| [Dashboard API](dashboard-executions-2026-10-03.json), [screenshot](dashboard-executions-2026-10-03.png), [transcript](dashboard-executions-2026-10-03.txt) | 13 records classified manual, schedule history empty; no new GCS check |

The complete Dashboard capture retains the historical records it returned. It does not supply scheduled drift results.

## Historical code and archives

[historical-ai-generated-cleaning-code.txt](historical-ai-generated-cleaning-code.txt) preserves the exact UTF-8 `generated_code` string captured during exploratory manual work, with no added newline. SHA-256: `b4e46b9f67b5685f6390182fa6d579c724b76590b070f231225694ea8680ed5e`.

Its [immutable source record](https://github.com/CornHieu-coder/rhombus-ai-take-home/blob/beaea4094334304c5b9c320c52eb77a209b42635/observations/evidence/schema-add-column-original.json) records project 4266, manual task `e4b11aab-78d2-449a-86e1-a22f117c3005`, and capture start `2026-10-02T14:48:01.505Z`. The other two exploratory records contain identical code. This is a historical AI-generated code capture, not an active transformation or proof of the complete baseline configuration.

Superseded previews, exploratory manual drift artifacts and the answered email draft were removed from current main for clarity. They remain available in the [pre-cleanup repository snapshot](https://github.com/CornHieu-coder/rhombus-ai-take-home/tree/beaea4094334304c5b9c320c52eb77a209b42635/observations).

The [original emailed ZIP](https://raw.githubusercontent.com/CornHieu-coder/rhombus-ai-take-home/6bf3c96ea33285175eeef4715e38da267802ddb1/observations/evidence/rhombus-scheduler-evidence-2026-10-03.zip) remains unchanged at its historical commit. SHA-256: `d5327c7be6a54f59f4714ac7532e3659656e6ae49978c2b369944dfb199fc906`. It predates the Dashboard check and support guidance; use the current scheduler report for the submission.

## UI journey configuration — 3 October

The [journey summary](../ui-journey.md) explains the live passing CLI configuration run, assertions, cleanup and limits. Its [manifest](ui-journey/2026-10-03T09-03-59-050Z/manifest.json) records all five passed steps, project 5252, destination 58 and schedule 215. The exact created schedule was paused before its next-run boundary; original schedule 209 remained paused.

The run directory retains selected graph/schedule fields, prompt and generated code, and five masked screenshots. It has **no verified scheduled output or validation JSON** because automatic delivery was not evaluated. The code-generation canvas's output error occurred before GCS configuration and is described in the summary; it is not another scheduler finding.

Browser state, keys, failed setup iterations, HAR files and raw traces stay ignored. Local `test-results/` and `playwright-report/` may be replaced by later runs; these curated captures are retained separately.
