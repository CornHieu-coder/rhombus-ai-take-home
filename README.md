# Rhombus AI pipeline drift exercise

Amazon S3 → AI-built cleaning in Rhombus → Google Cloud Storage. This repository contains eight datasets, Playwright UI tests, direct backend API tests, an independent validator and scheduler evidence.

## Submission scope after Rhombus's guidance

On **3 October 2026 at 14:08 Sydney time** (`04:08Z`), Rhombus advised that manual drift results need not be submitted and that the submission should explain how scheduling prevented progress. The [scheduler failure report](observations/scheduler-support-report.md) is the canonical write-up.

A successful automatic baseline was never established. Controlled checks of an edited schedule and a fresh schedule returned no execution records or new GCS objects within their observation windows. This prevented assessment of drift, chatbot repair and recovery on subsequent scheduled runs. The cause is unconfirmed. Manual baseline controls verify cleaning/export and determinism; they cannot establish automatic delivery. The support reply did not explicitly waive the UI journey, API tests, validator or demo video.

## Current status and findings

Live results below are dated observations, not claims about the current service.

| Area | Verified state |
| --- | --- |
| Manual baseline and validator | Actual S3 source and three matching-configuration GCS exports pass all seven checks, including ordered determinism. [Control record](observations/baseline-manual.md) |
| Scheduled baseline | Blocked in the recorded windows. Last verified schedule 209 was paused by the user. [Reproduction, evidence and limits](observations/scheduler-support-report.md) |
| API tests, 2 October | 4 passed; history assertion failed with `total=0` |
| Existing-project UI tests, 2 October | Canvas check passed; Next run and history checks failed |
| Complete UI journey | Unverified scaffold, skipped in the captured run; requires further work |
| Scheduled drift and chatbot recovery | Not evaluated because the automatic baseline was unavailable |
| Demo video | Not recorded; link must be added below |

Three main findings, which may share a backend cause:

1. **Automatic delivery was not established.** Both controlled schedule checks found no fresh GCS export; the manual control delivered a valid file. [Checks](observations/scheduler-support-report.md#reproduction-and-controls).
2. **Scheduled history offered no diagnostic record.** Schedule APIs returned empty histories; Dashboard returned 13 records, all manual with no schedule ID. [Dashboard check](observations/scheduler-support-report.md#dashboard-check-requested-by-support--3-october-2026).
3. **Monitoring and the chatbot suggestion did not resolve the blocker.** Next-run timestamps stopped advancing and last-run timestamps remained null. Disabling sampling did not restore history in the bounded repeat. [Diagnosis and limits](observations/scheduler-support-report.md#chatbot-diagnosis-and-automated-checks).

## Setup and local verification

Use Node.js 20+ and Python 3.10+. From the repository root:

```bash
npm ci
npx playwright install chromium
npm run test:validator
python data-validation/validate.py --scenario baseline --source observations/evidence/baseline-source-fetched-2026-10-03.csv --output observations/evidence/baseline-manual-control-output-2026-10-02-2349.csv --repeat-output observations/evidence/baseline-manual-repeat-1-2026-10-03.csv --repeat-output observations/evidence/baseline-manual-repeat-2-2026-10-03.csv
```

The validator unit tests and saved-evidence replay need no cloud credentials or Python packages outside the standard library. The replay validates real downloaded bytes. The separate [expected-output fixture](data-validation/tests/fixtures/expected-baseline-output.csv) is an oracle used by unit tests, not a Rhombus export.

For live tests, copy `.env.example` to `.env` (`Copy-Item .env.example .env` in PowerShell), set the exact project name and save a Rhombus session with `node ui-tests/save-auth.mjs`. If Google rejects the test browser, use the [normal-Chrome sign-in procedure](ui-tests/README.md#save-a-session). Authentication files, keys, raw traces and reports are ignored.

```bash
npm run test:api
npm run test:ui
npm run test:all -- --workers=1
```

The API suite contains three unauthenticated direct requests, including negative status/body assertions, and two authenticated schedule/history checks. Authenticated requests use an authorization header observed from the app in memory. Existing-project UI checks verify the connected graph, schedule display and history; they do not create the whole pipeline.

Schedule helpers currently select the first enabled schedule. They require an enabled schedule to inspect; the last captured schedule 209 was paused. A missing enabled schedule is a prerequisite failure. Set `RHOMBUS_EXPECT_SCHEDULE_HISTORY=1` only after an automatic attempt to enable the history assertions. Historical empty-history failures must be distinguished from current prerequisites.

The mutating [pipeline journey](ui-tests/pipeline-journey.spec.ts) is explicitly gated by `RHOMBUS_RUN_PROVISIONING_JOURNEY=1`; cloud settings alone do not enable it. `npm run test:journey` selects this scaffold. It remains unverified, can change the named project and schedule, and may wait up to 80 minutes. Its current result assertion does not prove a fresh successful run or actual GCS delivery. Verify and complete it before using it for the demo.

## Cleaning and cloud validation

The [baseline control record](observations/baseline-manual.md#prompt-and-expected-result) preserves the original builder prompt and the saved ordered cleaning prompt. The nine-row baseline yields five orders: `1001, 1002, 1006, 1007, 1008`. Output columns are exactly `order_id, customer_email, customer_name, amount_usd, order_date, country`.

Amounts are compared numerically: `42.5` equals `42.50`, while incorrect values and extra nonzero decimal precision fail. The cents case requires cents-to-USD conversion; the day/month case requires DD/MM/YYYY interpretation. Their intended meanings are encoded in the validator, with no claim of live semantic coverage.

For direct cloud reads, install `data-validation/requirements.txt` in a Python virtual environment. S3 reads use boto3's default credential chain; GCS reads use Google Application Default Credentials. `RHOMBUS_GCS_SERVICE_ACCOUNT_JSON_PATH` configures the Rhombus destination UI, not validator authentication.

```bash
python data-validation/validate.py --scenario baseline --source s3://SOURCE_BUCKET/baseline.csv --output gs://DEST_BUCKET/OUTPUT_FROM_THIS_RUN.csv --report data-validation/reports/baseline.json
```

The validator checks source/output schema, new invalid values, existence, row count, cleaning and repeat consistency. Add `--repeat-output` for each further same-input, same-configuration run. Exit 0 means evaluated checks passed; exit 2 means validation failed. `passed: null` means unevaluated. `--output-missing` records a reported absence and does not query GCS.

## Scheduled drift coverage summary

All seven datasets are retained. Scheduled execution, per-case logs, chatbot repairs and schedule recovery were **not evaluated** because a successful automatic baseline was unavailable.

| Case | Change | Pipeline stopped? | Chatbot fix worked? | Severity |
| --- | --- | --- | --- | --- |
| [Drop](observations/schema-drop-column.md) | Remove `amount_usd` | Not evaluated | Not evaluated | Not assessed |
| [Rename](observations/schema-rename-column.md) | `customer_email` → `email` | Not evaluated | Not evaluated | Not assessed |
| [Type](observations/schema-change-type.md) | Numeric amount becomes words | Not evaluated | Not evaluated | Not assessed |
| [Add](observations/schema-add-column.md) | Add `coupon_code` | Not evaluated | Not evaluated | Not assessed |
| [Combined](observations/schema-combined.md) | Drop, rename, type and add | Not evaluated | Not evaluated | Not assessed |
| [Cents](observations/semantic-cents.md) | Amounts become cents | Not evaluated | Not evaluated | Not assessed |
| [Day/month](observations/semantic-day-month.md) | Date meaning becomes DD/MM/YYYY | Not evaluated | Not evaluated | Not assessed |

## Usability feedback

The source, destination and scheduling guides helped specify the workflow. However, empty scheduled history and stale Next run values provided little information for investigating missing delivery. Explicit trigger type, an execution link, node outcomes and export details would make verification easier. Dashboard exposed manual records, but these did not establish automatic delivery.

The chatbot stated that it could not inspect scheduler logs or credentials, then promised disabling sampling would restore exports. Later checks did not verify that promise. Advice should reflect those access limits and provide a concrete verification step. The [captured exchange](observations/evidence/baseline-schedule-chatbot-2026-10-02.md) preserves its wording.

## Results and evidence storage

- Actual exports are stored in the configured GCS bucket. Each run must be matched to its own object.
- Playwright writes local diagnostics to `test-results/` and an HTML report to `playwright-report/`. Both are ignored; raw traces can contain credentials.
- Reviewed public evidence is indexed in [observations/evidence/README.md](observations/evidence/README.md). The scheduler report links the captures needed to reproduce its findings.
- **Planned after journey verification:** curate a summary at `observations/ui-journey.md` and redacted evidence under `observations/evidence/ui-journey/<run-id>/`. These artifacts have not been produced.

## Remaining submission checklist

1. Verify and complete the UI journey through S3 connection, AI-built pipeline, GCS destination and scheduling, with honest reporting of the unresolved scheduling result.
2. Record and link the required short walkthrough of **UI tests, API tests and data validation**.
3. Check the final commands, evidence links and publication redaction.

The hosted observability dashboard is an optional bonus. No additional manual drift runs are required under Rhombus's guidance.

## Demo video

**Not recorded.** Add the video URL here after showing the verified UI journey, dated scheduler evidence, direct backend tests and saved real-output validation. Explain blocked scheduled coverage and distinguish historical captures from the current paused schedule.
