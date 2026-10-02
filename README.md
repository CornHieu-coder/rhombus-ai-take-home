# Rhombus AI pipeline drift test repository

This repository tests a scheduled Amazon S3 → Rhombus AI → Google Cloud Storage cleaning pipeline. It includes eight source datasets, Playwright UI tests, direct backend API tests, a data validator, and one observation record per drift case. An earlier manual export failed baseline validation; the corrected manual CSV now passes all evaluated baseline checks. A user-confirmed scheduled run reported Success without a history entry or new GCS output. **A successful scheduled ETL baseline and drift cases remain pending.** Outcomes below distinguish observed results from pending tests.

## Current status and findings

| Area | Status |
| --- | --- |
| Direct backend API tests | 4 passed, 1 failed on 2026-10-02: authenticated schedule configuration passes; history regression fails with total=0 |
| Validator unit tests | 12 passed locally on 2026-10-02, including numeric serialization and wrong-amount regressions |
| Manual baseline run | Earlier export fails (9 rows instead of 5); corrected 320-byte CSV passes all evaluated baseline checks. Repeat determinism remains unevaluated. [Evidence and analysis](observations/baseline-manual.md) |
| Schedule and scheduled baseline | Success log without history or new GCS output at 10:04 PM; same visible symptoms repeat at 10:30 PM after editing minute 00 to 25. Missing-output checks fail; cause and repair pending. [Observation](observations/baseline-scheduled.md) |
| Authenticated UI tests | 1 passed, 2 failed on 2026-10-02: connected canvas passes; Next run and history regressions fail |
| Full provisioning journey | Scaffold only; skipped in the live run, locators not verified |
| Drifted scheduled runs and evidence | Not run |
| Demo video | Pending; add link after recording a real walkthrough |

Three preliminary findings:

1. An earlier manual pipeline execution reported Success while its downloaded output failed the baseline cleaning contract: nine rows remained where five were expected. The corrected manual download now passes the baseline validator. The original mismatch's cause remains unverified. See the [baseline observation](observations/baseline-manual.md).
2. A user-confirmed automatic execution reported Success while its schedule history remained empty and no new GCS output appeared. The same visible symptoms repeated after editing the schedule minute. The [scheduled baseline observation](observations/baseline-scheduled.md) records both attempts; the root cause and repair remain unverified.
3. An enabled schedule's `Next run:` is blank even though the authenticated backend returns a timestamp. That timestamp is already in the past and `last_run_at` is null. [Captured API and UI evidence](observations/evidence/baseline-schedule-playwright-2026-10-02.json) separates the display mismatch from the missing backend history; the underlying scheduler cause is unknown.

## Cleaning contract

The saved AI Builder cleaning prompt requests the following transformations. The [validator](data-validation/validate.py) independently computes the expected result from the S3 source object.

- Trim text, lowercase email, retain the first row per `order_id`, and fill missing `customer_name` with `Unknown`.
- Reject rows with missing `order_id` or email, invalid or nonpositive `amount_usd`, invalid date, or a country other than `US`, `usa`, or `United States`.
- Emit `country=US`, two-decimal USD amounts, ISO `YYYY-MM-DD` dates, and exactly `order_id,customer_email,customer_name,amount_usd,order_date,country`.
- The nine-row baseline should yield five rows. The [local expected output](data-validation/tests/fixtures/expected-baseline-output.csv) is an oracle fixture, **not a Rhombus output**.

Amounts are compared numerically: `42.5` equals `42.50`, as required by float rounding. Incorrect values or extra nonzero decimal precision still fail; no unsupported USD 500 cap is applied. Determinism compares ordered row values with the same numeric treatment. The [corrected real download](observations/evidence/baseline-manual-corrected-output-2026-10-02-2129.csv) is separate from the oracle fixture; its [validation report](observations/evidence/baseline-manual-corrected-validation.json) passes the six evaluated checks and leaves determinism unevaluated.

The two semantic drift datasets retain the baseline headers. `semantic-cents.csv` expresses amounts in cents; `semantic-day-month.csv` switches dates from MM/DD/YYYY to DD/MM/YYYY. Their validator cases compute the intended USD amounts and calendar dates independently, so a pipeline that silently keeps the old interpretation fails.

## Setup

Use Node.js 20 or newer and Python 3.10 or newer. Clone this repository, then:

```bash
npm ci
npx playwright install chromium
python -m venv .venv
# Activate .venv for your shell, then:
pip install -r data-validation/requirements.txt
cp .env.example .env
```

On PowerShell, copy the example with `Copy-Item .env.example .env` and activate `.venv\Scripts\Activate.ps1`. Set the values in `.env`. Keep `.env`, the saved browser session, and the GCS service-account JSON out of git; all are ignored.

Provision a dedicated S3 bucket or prefix and a dedicated GCS bucket. Upload [`baseline.csv`](datasets/baseline.csv) to the configured S3 key. Rhombus [requires its environment-generated read-only S3 bucket policy](https://doc.rhombusai.com/docs/Integrations/aws-s3-connection/) to be applied by someone with AWS access; the UI test assumes that policy already exists. Rhombus [uses a service-account JSON key for GCS destinations](https://doc.rhombusai.com/docs/Integrations/gcp-storage-connection/). Give that account access only to the test bucket and store the JSON at the local `RHOMBUS_GCS_SERVICE_ACCOUNT_JSON_PATH`.

Sign in once in a local Playwright browser and save a gitignored session:

```bash
node ui-tests/save-auth.mjs
```

If Google rejects sign-in in Chrome for Testing, authenticate manually in normal Chrome using a dedicated test profile. Google [may reject browsers controlled by automation](https://support.google.com/accounts/answer/7675428?hl=en). On Windows, open this command from Run (Win+R), adjusting the Chrome path if needed:

```text
"C:\Program Files\Google\Chrome\Application\chrome.exe" --user-data-dir="%LOCALAPPDATA%\RhombusTakeHome\Chrome" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9333 --new-window https://rhombusai.com
```

Complete the sign-in yourself, leave the Rhombus project open, then run:

```bash
node ui-tests/save-auth.mjs --cdp
```

The helper attaches after the manual sign-in, checks the Rhombus session, and saves only Rhombus cookies and storage to the gitignored auth file. It excludes Google browser state. `RHOMBUS_CDP_URL` can override the loopback endpoint. Use a dedicated profile because [Chrome requires a non-default profile for remote debugging](https://developer.chrome.com/blog/remote-debugging-port). Close this test-profile Chrome window when setup is finished. This sign-in path and subsequent headless authenticated tests were verified on 2026-10-02.

The verified [existing-project UI tests](ui-tests/existing-project.spec.ts) open the named project, check the connected S3 input, AI transformation and configured CSV output, then assert schedule display and history outcomes. These tests reuse configured connections and need only the saved session and project name. They do not provision connections or establish correct GCS contents. The separate [full provisioning journey](ui-tests/pipeline-journey.spec.ts) remains an unverified scaffold and was skipped; its locators need inspection before use. If an account lacks Third Party Sources or connector slots, the [Rhombus quick start](https://doc.rhombusai.com/docs/getting-started/pipeline-quickstart/) says that integration may be unavailable.

## Run the suites

```bash
npm run test:api
npm run test:ui
npm run test:validator
```

`test:api` includes three unauthenticated HTTP tests and two [authenticated backend tests](api-tests/authenticated.spec.ts). The authenticated tests obtain the app's authorization header in memory from an observed UI request, then call the actual schedule/history APIs directly and assert status and body. No tokens are printed. Set `RHOMBUS_EXPECT_SCHEDULE_HISTORY=1` only after allowing at least one automatic attempt; this enables the history regressions. The history contract deliberately fails while the defect persists.

`test:ui` runs the existing-project regressions with the saved session. It skips the provisioning scaffold when cloud settings are absent. A green command with a skip is **not** evidence that the pipeline worked. Check `test-results/` and `playwright-report/` locally if it fails; these paths are ignored because traces can contain session headers. On 2026-10-02, `npm run test:all -- --workers=1` completed with **5 passed, 3 failed, 1 skipped**. The failures reproduce the blank Next run and missing history, rather than being marked expected failures.

Capture redacted schedule API responses and a screenshot with:

```bash
npm run capture:schedule -- observations/evidence/my-schedule-capture
```

This read-only command records selected non-secret fields and masks visible email addresses. Review the artifacts before publishing them.

To smoke-test the validator without clouds:

```bash
python data-validation/validate.py --scenario baseline --source datasets/baseline.csv --output data-validation/tests/fixtures/expected-baseline-output.csv
```

For an actual scheduled run, supply the exact S3 source key and timestamped GCS object from that run:

```bash
python data-validation/validate.py --scenario baseline --source s3://SOURCE_BUCKET/rhombus-qa/baseline.csv --output gs://DEST_BUCKET/rhombus-qa-output-TIMESTAMP.csv --report data-validation/reports/baseline.json
```

Add `--repeat-output gs://...` twice to compare three executions of the same input and configuration for determinism. If a run produced no export, replace `--output ...` with `--output-missing`. The validator returns exit code 0 for passed checks and 2 for a data-validation failure. It checks input and output schema, row counts, all cleaning rules, newly invalid values, both semantic drift meanings, and repeated output consistency. `passed: null` means a check was not evaluated, such as determinism without three outputs.

## Drift run procedure

For each case, use the same S3 key configured in the pipeline. Restore the baseline and confirm a successful scheduled run. Replace that object with the case dataset before the next scheduled trigger and choose **Refresh access** in the S3 source. Record the execution ID, time, status, output URI or lack of output, relevant node logs, and the exported schedule-history CSV. Ask the chatbot to diagnose the exact error; apply any proposed repair using the AI builder and verify it on a later run. Run the data validator against the S3 and GCS objects from each run. Restore baseline between cases to isolate effects. [Scheduling documentation](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/) describes execution history, failure nodes, and the effect of saved pipeline changes on later runs.

| Drift case | Change | Pipeline stopped? | Chatbot fix worked? | Severity |
| --- | --- | --- | --- | --- |
| [Drop column](observations/schema-drop-column.md) | Remove `amount_usd` | Not observed | Not observed | Pending |
| [Rename column](observations/schema-rename-column.md) | `customer_email` → `email` | Not observed | Not observed | Pending |
| [Change type](observations/schema-change-type.md) | One numeric amount becomes words | Not observed | Not observed | Pending |
| [Add column](observations/schema-add-column.md) | Add `coupon_code` | Not observed | Not observed | Pending |
| [Combined](observations/schema-combined.md) | Drop, rename, type change, add | Not observed | Not observed | Pending |
| [Cents](observations/semantic-cents.md) | USD values become cents | Not observed | Not observed | Pending |
| [Day/month](observations/semantic-day-month.md) | Date interpretation switches | Not observed | Not observed | Pending |

Severity should be assigned from observed impact: **critical** for silent materially wrong data, **high** for unannounced data loss or a stuck schedule, **medium** for a clear recoverable run failure, and **low** for clear, actionable warning without incorrect output. Do not infer severity from the dataset name alone.

## Usability feedback

The public documentation is helpful: it distinguishes Analysis from `/pipeline` mode and explains that creating nodes does not run them automatically. The source, destination, and scheduling guides also give concrete steps and permissions, which made the test procedure possible to specify.

The manual run exposed a usability issue: the log reported a successful execution while the downloaded output failed the cleaning contract. A later automatic run reported Success without a visible history record or new GCS export. A data-quality summary, explicit export result, and execution link in the log would make these outcomes easier to investigate. The chatbot accurately stated its access limits, then promised that disabling sampling would restore GCS writes without inspecting scheduler logs or credentials. That explanation needs verification. The [captured exchange](observations/evidence/baseline-schedule-chatbot-2026-10-02.md) preserves both the limits and the promise. The [scheduling guide](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/) also says backend error text is available in exported history CSV rather than the table.

## Demo video

Pending a short recording of the authenticated UI journey, API suite, and validator against real S3/GCS objects. Add the public video URL here after recording.
