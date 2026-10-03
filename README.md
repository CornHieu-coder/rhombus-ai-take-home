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
| UI journey, 3 October | Live configuration journey passed: S3 selection, AI Builder/code generation, GCS settings and its own enabled schedule. Automatic delivery unevaluated. [Run and limits](observations/ui-journey.md) |
| Scheduled drift and chatbot recovery | Not evaluated because the automatic baseline was unavailable |
| Demo video | Not recorded; link must be added below |

Three main findings, which may share a backend cause:

1. **Automatic delivery was not established.** Both controlled schedule checks found no fresh GCS export; the manual control delivered a valid file. [Checks](observations/scheduler-support-report.md#reproduction-and-controls).
2. **Scheduled history offered no diagnostic record.** Schedule APIs returned empty histories; Dashboard returned 13 records, all manual with no schedule ID. [Dashboard check](observations/scheduler-support-report.md#dashboard-check-requested-by-support--3-october-2026).
3. **Monitoring and the chatbot suggestion did not resolve the blocker.** Next-run timestamps stopped advancing and last-run timestamps remained null. Disabling sampling did not restore history in the bounded repeat. [Diagnosis and limits](observations/scheduler-support-report.md#chatbot-diagnosis-and-automated-checks).

## Setup and local verification

The take-home requires browser automation of **S3 connection → AI-built pipeline → GCS destination → scheduling**, runnable from the command line, with no fixed sleeps and assertions on real outcomes. We use Playwright, direct API tests and an independent data validator.

## What the tests prove

| Test | What it does |
| --- | --- |
| **Data validation** | Checks that Rhombus produced the right cleaned CSV: correct columns, correct number of rows, correct cleaning, and the same result across repeated runs. It also tests the validator's handling of the two semantic-drift cases. This uses saved CSV files, so it can run without logging into Rhombus or the cloud. |
| **Existing-project UI tests** | Open the Rhombus project that was already set up and check that the pipeline is still there, the nodes are connected correctly, the schedule shows a next run, and schedule history appears. These tests only inspect the existing project; they do not rebuild the pipeline or check the actual GCS file. |
| **API tests** | Call Rhombus’s backend directly instead of clicking through the website. They check that the server returns the expected status and data, including that unauthenticated requests are rejected and that schedule information and history behave as expected. They do not build the pipeline. |
| **Full Playwright journey** | Automates the main customer flow required by the take-home: choose the S3 input, use AI Builder to create the cleaning step, configure GCS output, and create an enabled schedule. |

The full Playwright journey changes Rhombus settings, so it only runs when explicitly enabled. It uses a separate test project so it does not interfere with the original project or its evidence. After the test finishes, it pauses the schedule it created.

### Important limitation

The full Playwright journey proves that the required pipeline can be configured through the live Rhombus UI. Creating an enabled schedule does not by itself prove that Rhombus automatically ran the pipeline and delivered a new file to GCS.

Automatic scheduled delivery is documented separately in the [scheduler findings](observations/scheduler-support-report.md). In the recorded observation windows, a successful scheduled baseline was not established, so the README must not imply that automatic delivery passed.

### Verified results and limits

**Verified live on 3 October:** the UI setup journey passed in 1.4 minutes; the existing-project canvas check and three signed-out API tests also passed. The [journey evidence](observations/ui-journey.md) proves setup and saved settings. The new generated code's cleaning results and automatic delivery were not validated.

**Verified locally:** 12 validator tests passed. Comparing saved S3 input with three actual downloaded manual GCS exports passed all seven baseline checks, including repeat consistency. The [baseline evidence](observations/baseline-manual.md) identifies the files. Repeating this comparison needs no cloud access and does not test live drift.

**Blocked:** automatic scheduled delivery has not been established. Historical enabled-schedule checks found no execution records or fresh GCS output within their observation windows, preventing scheduled drift and chatbot recovery testing. See the [scheduler report](observations/scheduler-support-report.md).

Schedule checks require an enabled schedule; history checks must be explicitly enabled after an automatic attempt. The original schedule was user-paused, and those checks were not rerun against it. A paused-schedule prerequisite failure would not reproduce the historical defect.

**Unverified live:** an additional delivery check is intended to require a completed new scheduled execution, its fresh GCS export and passing data validation. Nine offline tests of its execution/output matching rules passed; the full live check has not been verified.

The setup-only and delivery-check options and extra matching tests are our implementation choices. Creating a schedule alone does not prove automatic delivery.

### Commands

Use Node.js 20+ and Python 3.10+, and run from the repository root.

**Local checks; no Rhombus login or cloud credentials required:**

```bash
npm ci
npm run test:validator
npm run test:journey-results
python data-validation/validate.py --scenario baseline --source observations/evidence/baseline-source-fetched-2026-10-03.csv --output observations/evidence/baseline-manual-control-output-2026-10-02-2349.csv --repeat-output observations/evidence/baseline-manual-repeat-1-2026-10-03.csv --repeat-output observations/evidence/baseline-manual-repeat-2-2026-10-03.csv
```

`test:validator` tests the validator itself; the Python command checks the saved real exports. `test:journey-results` runs the extra offline matching tests.

**Live signed-out API tests; no login or test browser required:**

```bash
npx playwright test api-tests/backend.spec.ts --workers=1
```

**Live existing-project suites:** follow the [login setup guide](ui-tests/README.md#save-a-session). These suites include schedule-dependent checks:

```bash
npx playwright install chromium
npm run test:api
npm run test:ui
```

**Full UI setup journey:** after completing its [prerequisites](ui-tests/README.md#journey-prerequisites-and-isolation), explicitly enable it for a PowerShell session:

```powershell
$env:RHOMBUS_RUN_PROVISIONING_JOURNEY = '1'
$env:RHOMBUS_JOURNEY_VERIFY_DELIVERY = '0'
npm run test:journey -- --workers=1
Remove-Item Env:RHOMBUS_RUN_PROVISIONING_JOURNEY
Remove-Item Env:RHOMBUS_JOURNEY_VERIFY_DELIVERY
```

For the additional automatic-delivery check, follow the [delivery-check prerequisites and command](ui-tests/README.md#strict-delivery-mode). To run all Playwright files together, use `npm run test:all -- --workers=1`; the journey still requires explicit enablement. Skipped checks provide no passing evidence.

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
- The [UI journey summary](observations/ui-journey.md) links its retained manifest, selected configuration fields, generated code and masked screenshots under `observations/evidence/ui-journey/<run-id>/`. Configuration verification and automatic delivery are separate outcomes.

## Remaining submission checklist

1. Record and link the required short walkthrough of **UI tests, API tests and data validation** using the verified configuration journey, dated scheduler evidence and saved real-output replay.
2. Check the final video link and submission contents.

The hosted observability dashboard is an optional bonus. No additional manual drift runs are required under Rhombus's guidance.

## Demo video

**Not recorded.** Add the video URL here after showing the verified UI journey, dated scheduler evidence, direct backend tests and saved real-output validation. Explain blocked scheduled coverage and distinguish historical captures from the current paused schedule.
