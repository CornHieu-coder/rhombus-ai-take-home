# UI test setup and limits

## Save a session

Copy `.env.example` to `.env`, set the exact project name and save the Rhombus session:

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

The helper saves only Rhombus cookies/storage under ignored `auth/`, excluding Google browser state. `RHOMBUS_CDP_URL` can override the loopback endpoint. Close the dedicated Chrome window afterward. This path was verified on 2 October 2026. See [Google sign-in guidance](https://support.google.com/accounts/answer/7675428?hl=en) and [Chrome's non-default profile requirement](https://developer.chrome.com/blog/remote-debugging-port).

## Existing-project checks

`npm run test:ui` runs three assertions against an already configured project: connected canvas, enabled schedule's Next run display and history. The schedule helper selects the first enabled schedule. With no enabled schedule, the helper fails its prerequisite rather than reproducing the historical scheduler defect.

Set `RHOMBUS_EXPECT_SCHEDULE_HISTORY=1` only after an automatic attempt. A skipped history check does not prove delivery. These checks do not create source/destination connections or validate actual exports.

## Pipeline journey scaffold

`npm run test:journey` selects the unfinished journey. It always skips unless `RHOMBUS_RUN_PROVISIONING_JOURNEY=1`; required cloud settings must also be populated. Its locators and outcome assertions still need verification. It can change the named project, cloud connections, graph and schedule, and may run for 80 minutes.

Before a verified journey, prepare a dedicated S3 object containing [baseline.csv](../datasets/baseline.csv) and a GCS test destination. Rhombus requires its environment-generated [S3 read policy](https://doc.rhombusai.com/docs/Integrations/aws-s3-connection/) and a [GCS service-account JSON key](https://doc.rhombusai.com/docs/Integrations/gcp-storage-connection/). These are prerequisites, not cloud resources created by the scaffold.

The current result assertion can accept an older Success record and does not inspect actual GCS output. It cannot yet establish a successful scheduled baseline. Keep the opt-in disabled until the journey is completed and reviewed.

## Local output

Playwright writes `test-results/` and `playwright-report/` at the repository root. Both are ignored. Raw traces may include authorization headers or the service-account JSON entered in the UI. Publish reviewed redacted evidence only; the [repository README](../README.md#results-and-evidence-storage) describes the planned curated journey output.

These are temporary diagnostics; later invocations may replace earlier results. Curate the evidence needed for a run before starting another run.
