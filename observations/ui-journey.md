# Playwright UI setup journey — 3 October 2026

## Result

The live Playwright journey passed: **1 passed (1.4m)**. It selected the S3 input, built the cleaning step through AI Builder, configured GCS CSV output and created an enabled schedule.

This proves that the required UI setup can be automated through Rhombus. It does **not** prove that the schedule ran automatically or produced a valid GCS file. The [run record](evidence/ui-journey/2026-10-03T09-03-59-050Z/manifest.json) contains the passed steps and cleanup result.

## What was tested

The take-home requires command-line UI automation of **S3 connection → AI-built cleaning pipeline → GCS destination → schedule**, with no fixed sleeps and assertions on real outcomes.

This run used a separate test project so it did not change the original investigation project's settings.

<a id="assertions-and-evidence"></a>

## What happened

| Step | What passed | Evidence |
| --- | --- | --- |
| Select S3 input | Selected the existing connected `baseline.csv` input and checked its preview. | [Source](evidence/ui-journey/2026-10-03T09-03-59-050Z/source.png), [preview](evidence/ui-journey/2026-10-03T09-03-59-050Z/input-preview.png) |
| Build cleaning with AI Builder | Saved the cleaning prompt, generated code and connected pipeline steps. | [Prompt](evidence/ui-journey/2026-10-03T09-03-59-050Z/builder-prompt.txt), [saved pipeline](evidence/ui-journey/2026-10-03T09-03-59-050Z/ai-graph.json) |
| Configure GCS output | The selected GCS destination and CSV settings were saved correctly. | [Settings](evidence/ui-journey/2026-10-03T09-03-59-050Z/configuration-saved.json), [destination](evidence/ui-journey/2026-10-03T09-03-59-050Z/destination.png) |
| Create schedule | Created an enabled schedule using that saved pipeline. | [Schedule record](evidence/ui-journey/2026-10-03T09-03-59-050Z/schedule-created.json), [schedule UI](evidence/ui-journey/2026-10-03T09-03-59-050Z/schedule-created.png) |
| Cleanup | Paused the new schedule and preserved the original project's schedule states. | [Cleanup record](evidence/ui-journey/2026-10-03T09-03-59-050Z/manifest.json) |

## AI Builder code generation

No Python cleaning code was manually written by the test. When code still needed generating, the test used Rhombus's **Regenerate With Feedback** action and asked it to preserve all 12 cleaning rules in the same order. Rhombus generated and saved the code. That saved pipeline was the one included in the schedule. [Feedback](evidence/ui-journey/2026-10-03T09-03-59-050Z/code-generation-feedback.txt), [generated code](evidence/ui-journey/2026-10-03T09-03-59-050Z/generated-code.txt).

During generation, Rhombus also attempted processing and showed an [output error](evidence/ui-journey/2026-10-03T09-03-59-050Z/ai-canvas.png) before GCS was configured. The remaining setup steps later passed. This intermediate error was not treated as evidence of a scheduling or delivery failure.

## Schedule cleanup

The test paused its schedule before the first automatic trigger, leaving no active recurring schedule behind. Therefore the empty history in this run is **not evidence of a scheduler failure**.

The earlier scheduling blocker is documented separately in the [scheduler report](scheduler-support-report.md); this setup run did not investigate its cause or verify recovery.

## Reproduce

Complete the [login and cloud prerequisites](../ui-tests/README.md#journey-prerequisites-and-isolation) and fill in `.env`. From the repository root, run:

~~~powershell
$env:RHOMBUS_RUN_PROVISIONING_JOURNEY = '1'
$env:RHOMBUS_JOURNEY_VERIFY_DELIVERY = '0'
npm run test:journey -- --workers=1
Remove-Item Env:RHOMBUS_RUN_PROVISIONING_JOURNEY
Remove-Item Env:RHOMBUS_JOURNEY_VERIFY_DELIVERY
~~~

This explicitly enables the test that changes a separate Rhombus project. It checks setup and pauses its schedule afterward.

## Limits

- This run proves UI setup, not automatic scheduled delivery.
- No fresh scheduled GCS export from this journey was validated. The S3 input was checked through its listing and preview, without independently downloading its contents.
- This run did not validate the generated code against a fresh output or prove every cleaning rule. The local check below confirms that its saved code retains a whitespace-only `order_id`.
- The [original manual baseline validation](baseline-manual.md) belongs to the original pipeline; it does not validate this newly generated pipeline.
- Scheduled drift testing still requires a successful automatic baseline, which was not established in the [recorded scheduler investigation](scheduler-support-report.md).

## Local cleaning check — 5 October 2026

A new [two-row fixture](../data-validation/tests/fixtures/whitespace-order-id-source.csv) contains one whitespace-only order ID and one valid order. The correct result is [only the valid order](../data-validation/tests/fixtures/whitespace-order-id-expected.csv). This expectation is independent of Rhombus's saved code.

An offline test replayed the [unmodified saved code](evidence/ui-journey/2026-10-03T09-03-59-050Z/generated-code.txt) using pandas. It trimmed the first ID to an empty string but retained the row, because its required-ID check only removes null values. The validator rejected that output's row count and cleaning result. This confirms an omission in that code artifact locally; it is not a new live pipeline run.

Run `npm run test:validator` to reproduce the independent check. Replaying the saved code additionally requires pandas; that one test skips if pandas is absent. The captured code has not been repaired or replaced. A real repair must be requested through AI Builder, followed by validation of a fresh export; automatic delivery would still need separate verification.

<a id="other-verification-in-this-session"></a>

For API and data-validation results, see the [main submission summary](../README.md#review-at-a-glance).
