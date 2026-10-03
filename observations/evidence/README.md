# Evidence index

Use this page to find artifacts for a claim. The reports explain the experiments: [manual baseline](../baseline-manual.md), [scheduler blocker](../scheduler-support-report.md) and [UI setup journey](../ui-journey.md). Capture timestamps are UTC unless labelled otherwise. Public captures exclude credentials and bucket names.

## Manual baseline controls

These files support correct cleaning and repeat consistency for the original manual pipeline.

| Artifact | What it supports |
| --- | --- |
| [Downloaded S3 source](baseline-source-fetched-2026-10-03.csv), [source/repeat record](baseline-manual-repeats-2026-10-03.json) | Actual input bytes and the recorded source/download checks |
| [Control CSV](baseline-manual-control-output-2026-10-02-2349.csv), [control record](baseline-manual-control-2026-10-02.json), [screenshot](baseline-manual-control-2026-10-02.png) | Manual trigger and actual GCS export |
| [Repeat 1](baseline-manual-repeat-1-2026-10-03.csv), [repeat 2](baseline-manual-repeat-2-2026-10-03.csv) | Two further actual exports from the same input and recorded pipeline settings |
| [Single-run validation](baseline-manual-control-validation.json), [three-output validation](baseline-manual-determinism-validation.json) | Cleaning checks and consistency across all three outputs |

These downloaded files are distinct from expected-output test fixtures. They do not prove automatic delivery.

## Scheduler diagnostics

| Experiment and artifacts | Claim supported |
| --- | --- |
| [Initial schedule 202 API capture](baseline-schedule-playwright-2026-10-02.json), [screenshot](baseline-schedule-playwright-2026-10-02.png) | Enabled schedule, empty history and stale Next run |
| [Captured chatbot exchange](baseline-schedule-chatbot-2026-10-02.md) | Suggested sampling change and stated access limits; the promised repair was not verified |
| [Post-chatbot window](baseline-schedule-after-chatbot-2026-10-02.json) | Empty history after an enabled boundary; GCS was not queried in this window |
| [Edited schedule 202](baseline-schedule-edited-repeat-2026-10-02.json), [screenshot](baseline-schedule-edited-repeat-2026-10-02.png) | Empty history and unchanged independently refreshed GCS listing |
| [Fresh schedule 208](baseline-schedule-fresh-repeat-2026-10-03.json) | New schedule with the saved pipeline, followed by zero history and no fresh GCS object in the controlled window |
| [Restoration record](baseline-schedule-final-2026-10-03.json), [screenshot](baseline-schedule-final-2026-10-03.png) | Test schedule disabled and original settings restored; a future Next run displayed |
| [User-created schedule 209](baseline-schedule-user-repeat-2026-10-03.json) | Short enabled observation followed by the user pause; later paused time is not active scheduling coverage |
| [Dashboard API capture](dashboard-executions-2026-10-03.json), [screenshot](dashboard-executions-2026-10-03.png), [transcript](dashboard-executions-2026-10-03.txt) | All 13 returned records were manual; schedule history was empty. This check did not query GCS |

Observation windows, expected outcomes and limits are in the [scheduler report](../scheduler-support-report.md). These artifacts do not establish a backend cause or successful scheduled drift results.

<a id="ui-journey-configuration--3-october"></a>

## UI setup journey — 3 October

The [run report](../ui-journey.md) explains the five passed setup steps. The schedule was paused before its first automatic trigger; no scheduled output was verified.

| Artifact | What it supports |
| --- | --- |
| [Manifest](ui-journey/2026-10-03T09-03-59-050Z/manifest.json) | Passed steps, project 5252, destination 58, schedule 215 and cleanup |
| [Before settings](ui-journey/2026-10-03T09-03-59-050Z/configuration-before.json), [source screenshot](ui-journey/2026-10-03T09-03-59-050Z/source.png), [input preview](ui-journey/2026-10-03T09-03-59-050Z/input-preview.png) | Selected S3 source and preview |
| [Builder prompt](ui-journey/2026-10-03T09-03-59-050Z/builder-prompt.txt), [generation feedback](ui-journey/2026-10-03T09-03-59-050Z/code-generation-feedback.txt), [generated code](ui-journey/2026-10-03T09-03-59-050Z/generated-code.txt), [graph](ui-journey/2026-10-03T09-03-59-050Z/ai-graph.json) | AI Builder request and saved cleaning code |
| [Saved settings](ui-journey/2026-10-03T09-03-59-050Z/configuration-saved.json), [destination screenshot](ui-journey/2026-10-03T09-03-59-050Z/destination.png) | Persisted GCS/CSV settings |
| [Schedule record](ui-journey/2026-10-03T09-03-59-050Z/schedule-created.json), [screenshot](ui-journey/2026-10-03T09-03-59-050Z/schedule-created.png) | Own enabled schedule with the saved pipeline |
| [Generation-stage canvas](ui-journey/2026-10-03T09-03-59-050Z/ai-canvas.png) | Output error before GCS setup; not a scheduling finding or validated cleaning result |

## Historical code and archives

These are references for earlier work, not current scheduled results.

- [Historical AI-generated code](historical-ai-generated-cleaning-code.txt): exact captured UTF-8 text, with no added newline. SHA-256: `b4e46b9f67b5685f6390182fa6d579c724b76590b070f231225694ea8680ed5e`.
- [Immutable source record](https://github.com/CornHieu-coder/rhombus-ai-take-home/blob/beaea4094334304c5b9c320c52eb77a209b42635/observations/evidence/schema-add-column-original.json): project 4266, manual task `e4b11aab-78d2-449a-86e1-a22f117c3005`, captured from `2026-10-02T14:48:01.505Z`. Two other exploratory records contained the same code; this is not the complete baseline configuration.
- [Pre-cleanup observations](https://github.com/CornHieu-coder/rhombus-ai-take-home/tree/beaea4094334304c5b9c320c52eb77a209b42635/observations): superseded previews, exploratory manual drift artifacts and the answered email draft.
- [Original emailed ZIP](https://raw.githubusercontent.com/CornHieu-coder/rhombus-ai-take-home/6bf3c96ea33285175eeef4715e38da267802ddb1/observations/evidence/rhombus-scheduler-evidence-2026-10-03.zip): unchanged historical bundle, before the Dashboard check and support guidance. SHA-256: `d5327c7be6a54f59f4714ac7532e3659656e6ae49978c2b369944dfb199fc906`. Use the current scheduler report for the submission.

## Local reports

Temporary Playwright output can be replaced by later runs. The reviewed artifacts linked here are retained independently. Private login files, keys and raw browser traces are not submission evidence.
