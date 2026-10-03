# UI test setup and limits

## Save a session

Copy `.env.example` to `.env`, set `RHOMBUS_PROJECT_NAME` to the exact original project name, and save the Rhombus session:

```bash
node ui-tests/save-auth.mjs
```

If Google rejects automated-browser sign-in, sign in yourself in normal Chrome with a dedicated profile. On Windows, open this command from Run (Win+R), adjusting the Chrome path if needed:

```text
"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%LOCALAPPDATA%\RhombusTakeHome\Chrome" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9333 --new-window https://rhombusai.com
```

After signing in and opening Rhombus, save the session:

```bash
node ui-tests/save-auth.mjs --cdp
```

The helper saves only Rhombus cookies/storage under ignored `auth/`, excluding Google browser state. `RHOMBUS_CDP_URL` can override the session-saving endpoint. This sign-in path was verified on 2 October 2026. See [Google sign-in guidance](https://support.google.com/accounts/answer/7675428?hl=en) and [Chrome's non-default profile requirement](https://developer.chrome.com/blog/remote-debugging-port). Keep the dedicated browser open for delivery mode's cloud checks; close it when finished.

## Existing-project checks

`npm run test:ui` runs assertions against an already configured project: connected canvas, enabled schedule's Next run display and history. The schedule helper selects the first enabled schedule. With no enabled schedule, it fails its prerequisite rather than reproducing the historical scheduler defect. The last captured original schedule was paused.

Set `RHOMBUS_EXPECT_SCHEDULE_HISTORY=1` only after an automatic attempt. A skipped history check does not prove delivery. These checks do not create source/destination connections or validate actual exports.

## Journey prerequisites and isolation

The [journey](pipeline-journey.spec.ts) traverses the source UI, AI Builder, GCS destination and scheduling. It skips unless `RHOMBUS_RUN_PROVISIONING_JOURNEY=1`; the saved Rhombus session, original project name and both bucket names are also required.

The journey opens or creates a separate project named **Rhombus QA Playwright Journey** by default. Override it with `RHOMBUS_JOURNEY_PROJECT_NAME`; it must differ from `RHOMBUS_PROJECT_NAME`. It creates or updates the journey project's AI-generated graph. That project must have no existing enabled schedules.

Prepare the existing S3 object at `RHOMBUS_S3_PREFIX` + `baseline.csv` using [the baseline dataset](../datasets/baseline.csv). The journey does not upload or overwrite source data. It reuses an available S3 connection, or connects the bucket through the UI. Rhombus's environment-generated [S3 read policy](https://doc.rhombusai.com/docs/Integrations/aws-s3-connection/) must already be applied by someone with AWS access.

It reuses a GCS destination available in the journey project, or creates one through the UI using a local [service-account JSON key](https://doc.rhombusai.com/docs/Integrations/gcp-storage-connection/). Set `RHOMBUS_GCS_SERVICE_ACCOUNT_JSON_PATH` to an ignored local file when creation is needed. The key is entered only in the destination form; no real key path or key contents belong in public evidence.

The journey creates its own enabled every-minute cron schedule with the saved graph, and pauses that exact diagnostic schedule in cleanup. It records and checks the original project's schedule states, preserving the user's paused schedule. Use one worker. Cleanup errors are reported explicitly rather than treated as success.

## Configuration mode

The default journey mode verifies S3 selection/preview, a completed new AI Builder turn and connected graph, persisted GCS/CSV configuration, and the newly created schedule. It does **not** establish an automatic baseline or validate a fresh cloud export.

The Builder creates the Custom node and its ordered cleaning prompt. If code is not yet present, the journey asks Rhombus to generate it through **Regenerate Code**. It never edits Python code by hand. Source identity and the schedule's captured graph must match the saved configuration.

Set the opt-in in `.env`, then run:

```bash
npm run test:journey -- --workers=1
```

Alternatively, enable it for a PowerShell session:

```powershell
$env:RHOMBUS_RUN_PROVISIONING_JOURNEY = '1'
$env:RHOMBUS_JOURNEY_VERIFY_DELIVERY = '0'
npm run test:journey -- --workers=1
Remove-Item Env:RHOMBUS_RUN_PROVISIONING_JOURNEY
Remove-Item Env:RHOMBUS_JOURNEY_VERIFY_DELIVERY
```

On shells supporting command-local environment variables:

```bash
RHOMBUS_RUN_PROVISIONING_JOURNEY=1 npm run test:journey -- --workers=1
```

A configuration result must be described as configuration verified, with automatic delivery unevaluated. This documentation describes the implementation contract; a reviewed live-run result must be recorded separately.

The execution and output matching rules can be checked offline with `npm run test:journey-results`. These tests reject old/manual executions, incomplete results and ambiguous cloud objects; they do not exercise the live scheduler.

## Strict delivery mode

Also set `RHOMBUS_JOURNEY_VERIFY_DELIVERY=1`. Before running, open authenticated S3 and GCS bucket tabs in the dedicated Chrome on loopback port **9333**. `RHOMBUS_CLOUD_CDP_URL` defaults to `http://127.0.0.1:9333` and is separate from the session-saving setting.

Delivery mode downloads the actual S3 object and requires its bytes to match the repository baseline. It independently refreshes the GCS listing while observing the new schedule. Success requires an unambiguous new scheduled execution for this project/schedule, completion of every expected node, one fresh object with this run's filename prefix and matching creation window, and passing validation of its actual downloaded bytes. Older Success records and manual executions do not satisfy the assertions.

The observation ends at the recorded next-run boundary plus `RHOMBUS_JOURNEY_GRACE_SECONDS` (default **180**, allowed 60-600 seconds). It uses event/response waits and bounded polling, with no fixed sleeps. A completed window without verified delivery must be reported as blocked; inaccessible clouds, failed API requests and other observation errors do not establish scheduler failure.

```bash
RHOMBUS_RUN_PROVISIONING_JOURNEY=1 RHOMBUS_JOURNEY_VERIFY_DELIVERY=1 npm run test:journey -- --workers=1
```

In PowerShell, use the configuration example above with `RHOMBUS_JOURNEY_VERIFY_DELIVERY = '1'`. Local CSV validation uses Python's standard library; `RHOMBUS_PYTHON` can select a Python executable. The cloud observer uses the authenticated consoles and does not upload or delete cloud objects.

## Local output and publication

The default journey evidence directory is `test-results/<test>/journey/`, containing `manifest.json`, step outcomes, selected configuration/API fields, controlled redacted screenshots, builder prompt/code and, in delivery mode, actual input/output CSVs and validation reports when verified. `RHOMBUS_JOURNEY_EVIDENCE_DIR` can choose another local directory. The manifest distinguishes configuration verification, automatic-baseline verification, observation limits and final cleanup state.

Automatic Playwright traces and failure screenshots are disabled for this journey because destination setup can enter a private key. Its controlled screenshots mask configured bucket names and visible email text; JSON/text artifacts redact credentials and signed URL queries. Review every artifact before publication. Existing-project tests can still produce raw diagnostics in ignored `test-results/` and `playwright-report/`.

Later invocations may replace local results. Preserve the needed run before another invocation. Curate only reviewed evidence under `observations/evidence/ui-journey/<run-id>/` and link it from `observations/ui-journey.md`; those public results are produced after the live run is reviewed. Never publish browser state, service-account keys, HAR files or raw traces. The [repository README](../README.md#results-and-evidence-storage) records the submission's evidence status.
