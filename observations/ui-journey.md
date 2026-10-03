# Playwright UI journey — 3 October 2026

**Configuration verified.** The live CLI journey passed on 3 October, `09:03:59–09:05:21Z` (19:03–19:05 Sydney time). It opened the separate project **5252**, selected the S3 baseline, completed a new AI Builder turn, saved generated Python code, configured GCS destination **58**, and created its own enabled schedule **215**. Cleanup paused 215 and confirmed the original project's schedule **209** remained paused.

The [run manifest](evidence/ui-journey/2026-10-03T09-03-59-050Z/manifest.json) records all five passed steps and cleanup. This result establishes the UI setup journey; **automatic baseline delivery was not evaluated** in this configuration run.

## Reproduce

Follow the [session and cloud prerequisites](../ui-tests/README.md#journey-prerequisites-and-isolation), populate ignored `.env`, and run from the repository root:

```powershell
$env:RHOMBUS_RUN_PROVISIONING_JOURNEY = '1'
$env:RHOMBUS_JOURNEY_VERIFY_DELIVERY = '0'
npm run test:journey -- --workers=1
Remove-Item Env:RHOMBUS_RUN_PROVISIONING_JOURNEY
Remove-Item Env:RHOMBUS_JOURNEY_VERIFY_DELIVERY
```

Captured CLI result: **1 passed (1.4m)**. Connections may be reused in the separate project; missing connections are configured through the UI using the preconfigured S3 read policy and a local GCS key. The original evidence project is preserved.

## Assertions and evidence

| Step | What passed | Capture |
| --- | --- | --- |
| Project isolation | Journey project differs from the original; no competing active schedule | [Before configuration](evidence/ui-journey/2026-10-03T09-03-59-050Z/configuration-before.json) |
| S3 input | Exact `baseline.csv` key, 531-byte listing, selected asset and connection, six columns and nine preview rows | [Source](evidence/ui-journey/2026-10-03T09-03-59-050Z/source.png), [preview](evidence/ui-journey/2026-10-03T09-03-59-050Z/input-preview.png) |
| AI Builder | Pipeline mode; a newly completed request; three connected persisted nodes; ordered cleaning prompt and saved code | [Builder prompt](evidence/ui-journey/2026-10-03T09-03-59-050Z/builder-prompt.txt), [graph and HTTP fields](evidence/ui-journey/2026-10-03T09-03-59-050Z/ai-graph.json) |
| GCS destination | Saved destination ID maps to the selected GCS bucket; CSV and unique filename persist after reload; source identity remains intact | [Saved graph](evidence/ui-journey/2026-10-03T09-03-59-050Z/configuration-saved.json), [destination](evidence/ui-journey/2026-10-03T09-03-59-050Z/destination.png) |
| Schedule | Creation returns this schedule's ID; captured source, wiring, prompt/code and destination match the saved graph; enabled custom cron and its own history UI | [Created schedule](evidence/ui-journey/2026-10-03T09-03-59-050Z/schedule-created.json), [screenshot](evidence/ui-journey/2026-10-03T09-03-59-050Z/schedule-created.png) |

Rhombus's **Regenerate With Feedback** dialog generated code for the Builder-created prompt. The [feedback](evidence/ui-journey/2026-10-03T09-03-59-050Z/code-generation-feedback.txt) requested preservation of all 12 rules; no Python was edited manually. The [captured code](evidence/ui-journey/2026-10-03T09-03-59-050Z/generated-code.txt) has SHA-256 `8625ef23feeabf2b556952d659d6b66821f4c84e8da7af3e1b979ee967141268`, matching both the saved graph and schedule snapshot.

## Limits

- Schedule 215 was paused at the end of configuration, before its `09:06Z` next-run boundary. Its initial empty history is expected and is **not evidence of another scheduler failure**.
- Regeneration starts processing in the UI. The [generation-stage canvas](evidence/ui-journey/2026-10-03T09-03-59-050Z/ai-canvas.png) shows an output error before the GCS destination was configured. The test verifies persisted code and subsequent destination setup; it does not assess that processing attempt's delivery or cleaning result.
- This run verified source selection/listing/preview, without independently downloading the current S3 bytes. It produced no verified scheduled CSV or validation report. Use the [recorded manual baseline controls](baseline-manual.md) for real-byte cleaning and determinism evidence.
- Static review of this generated code found a null-ID filter but no explicit empty-string `order_id` filter. The configuration pass does not certify every cleaning rule or the new code's output quality.
- The optional [strict delivery mode](../ui-tests/README.md#strict-delivery-mode) requires authenticated S3/GCS console tabs on CDP port 9333. That browser was unavailable in this session, so the cloud observer and complete delivery mode remain **live-unverified**. Their execution/object matching rules passed nine offline tests.
- The [scheduler report](scheduler-support-report.md) remains the canonical historical blocker under Rhombus's guidance. This configuration run neither reproduces nor resolves it.

## Other verification in this session

The original project's connected-canvas check passed; three unauthenticated direct API status/body checks passed; all 12 validator unit tests passed. Replaying the saved actual S3 source and three actual manual GCS exports passed all seven baseline checks, including ordered determinism. The existing-project enabled-schedule checks were not rerun against user-paused schedule 209.

Public evidence contains selected fields and masked screenshots. Browser state, keys, raw traces, failed setup iterations and generated HTML reports stay ignored locally. Local output defaults to `test-results/<test>/journey/`; the curated run above is retained independently of later test invocations.
