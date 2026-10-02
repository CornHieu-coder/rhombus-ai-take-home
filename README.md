# Rhombus AI pipeline drift test repository

This repository tests a scheduled Amazon S3 → Rhombus AI → Google Cloud Storage cleaning pipeline. It includes eight source datasets, a Playwright UI journey, direct backend API tests, a data validator, and one observation record per drift case. An earlier manual export failed baseline validation; later Custom and Data Output previews match the expected five-row result, but the fresh export has not been validated. **The scheduled baseline and drift cases have not been observed yet.** Outcomes below distinguish observed results from pending tests.

## Current status and findings

| Area | Status |
| --- | --- |
| Direct backend API tests | 3 passed against public unauthenticated endpoints on 2026-09-30 |
| Validator unit tests | 8 passed locally on 2026-09-30 |
| Manual baseline run | Earlier downloaded output failed validation (9 rows instead of 5); later previews match 5 expected rows. Fresh GCS export validation pending. [Evidence and analysis](observations/baseline-manual.md) |
| Schedule and scheduled baseline | Active Hourly schedule at minute 00 observed; history is empty and Next run is blank in the supplied screenshot. No scheduled execution or export verified. [Evidence](observations/evidence/baseline-schedule-visible-evidence.md) |
| Authenticated UI test | Not run |
| Drifted scheduled runs and evidence | Not run |
| Demo video | Pending; add link after recording a real walkthrough |

Three preliminary findings:

1. A manual pipeline execution reported Success while its downloaded output failed the baseline cleaning contract: nine rows remained where five were expected. Later node previews show the expected five rows; the fresh GCS export, exact repair, and cause of the earlier mismatch remain unverified. See the [baseline observation](observations/baseline-manual.md).
2. The observed backend paths `/api/accounts/users/profile` and `/api/accounts/users/project-limit` return HTTP 401 with `{"detail":"Unauthorized"}` without a session. The [API suite](api-tests/backend.spec.ts) asserts both status and body.
3. Rhombus [documents that backend error text appears in exported execution history CSV](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/), so each drift record asks for that export as evidence. This has not been checked in a scheduled run.

## Cleaning contract

The AI builder prompt in the UI test requests the following transformations. The [validator](data-validation/validate.py) independently computes the expected result from the S3 source object.

- Trim text, lowercase email, retain the first row per `order_id`, and fill missing `customer_name` with `Unknown`.
- Reject rows with missing `order_id` or email, invalid or nonpositive `amount_usd`, invalid date, or a country other than `US`, `usa`, or `United States`.
- Emit `country=US`, two-decimal USD amounts, ISO `YYYY-MM-DD` dates, and exactly `order_id,customer_email,customer_name,amount_usd,order_date,country`.
- The nine-row baseline should yield five rows. The [local expected output](data-validation/tests/fixtures/expected-baseline-output.csv) is an oracle fixture, **not a Rhombus output**.

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

The UI test creates or opens the named test project, connects the pre-authorized S3 source, asks the AI builder for the transformations, configures GCS, creates an hourly schedule, and polls execution history for a new run. It uses UI locators and outcome assertions, with no fixed sleeps. Because no authenticated account was available during development, **the authenticated locators need a first live check**; adjust them if the account's UI differs. If an account lacks Third Party Sources or connector slots, the [Rhombus quick start](https://doc.rhombusai.com/docs/getting-started/pipeline-quickstart/) says that integration may be unavailable.

## Run the suites

```bash
npm run test:api
npm run test:ui
npm run test:validator
```

`test:api` runs three direct HTTP tests against paths captured from the browser's fetch traffic by [`capture-network.mjs`](api-tests/capture-network.mjs); the two protected backend endpoints deliberately use empty authentication state. Re-run `npm run capture:network` after sign-in to discover authenticated paths for further API coverage. The script prints paths, methods, and status codes without request bodies or query strings.

`test:ui` skips the live journey when required environment settings are absent. A green command with that skip is **not** evidence that the pipeline worked. The hourly run may take up to one hour to trigger; the test polls for a new execution rather than sleeping for a fixed duration. Check `test-results/` and `playwright-report/` locally if it fails; these paths are ignored by git.

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

The manual run exposed a usability issue: the log reported a successful execution while the downloaded output failed the cleaning contract. A visible data-quality summary in execution history would make this difference easier to detect. Feedback on the chatbot's diagnosis and on scheduled failures remains pending. The [scheduling guide](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/) also says backend error text is available in exported history CSV rather than the table.

## Demo video

Pending a short recording of the authenticated UI journey, API suite, and validator against real S3/GCS objects. Add the public video URL here after recording.
