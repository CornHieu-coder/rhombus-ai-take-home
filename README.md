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

## Verified results and limits

The take-home requires UI automation of the S3 → AI Builder → GCS → schedule journey, direct API tests, data validation, and a successful scheduled baseline before testing drift.

**UI automation:** On 3 October, the Playwright test successfully completed the required setup journey in the live Rhombus application: it selected the S3 input, used AI Builder to create the cleaning pipeline, configured the GCS output and created an enabled schedule. This proves that the required setup journey can be automated through the UI. It does **not** prove that the new schedule later ran automatically or produced a GCS file. [UI journey evidence](observations/ui-journey.md).

**API tests:** Three signed-out direct backend tests passed against live Rhombus, including checks that protected requests were rejected. During the historical scheduler investigation, schedule-history requests returned no scheduled execution records. The test expecting those records therefore failed. [Recorded API results and findings](observations/scheduler-support-report.md#chatbot-diagnosis-and-automated-checks).

**Data validation:** All 12 validator tests passed locally. The validator was also run locally against the downloaded actual S3 input and three real GCS files produced by manual runs. All three outputs passed the baseline checks and matched each other, showing that the cleaning result was correct and repeatable for this baseline when the pipeline was run manually. These files came from the original pipeline; they do not validate the new journey's generated cleaning code. [Data and validation evidence](observations/baseline-manual.md).

**Scheduled baseline:** A successful automatic scheduled run was not established. During the recorded periods when schedules were enabled, no new scheduled execution appeared in schedule history and no fresh GCS output was observed before the stated deadlines. Because the take-home requires a successful scheduled baseline before the drift tests, the scheduled schema-drift, semantic-drift and chatbot-recovery tests could not be completed. [Observation windows and supporting evidence](observations/scheduler-support-report.md#reproduction-and-controls).

The original schedule was later paused by the user. Tests that require an enabled schedule were therefore not rerun against that paused schedule. An enabled schedule is a prerequisite for those tests; the current paused state is not evidence of the historical scheduler problem.

A separate, stricter delivery check was also developed to verify that a newly created schedule completes a new execution, delivers a fresh GCS file and passes data validation. This is our additional testing approach, not a separate requirement from the take-home. Its logic for identifying the correct run and file was tested locally, but the full live delivery check has not been verified, so this submission does not claim that automatic delivery passed.

## How to run

Use Node.js 20+ and Python 3.10+. From the repository root, install the Node dependencies once:

```bash
npm ci
```

### UI tests — `/ui-tests/` (live Rhombus)

Prepare your Rhombus login, S3 input and GCS access using the [setup guide](ui-tests/README.md#journey-prerequisites-and-isolation). The **S3 → AI Builder → GCS → schedule** test waits for actual responses and checks saved results. Install its browser:

```bash
npx playwright install chromium
```

Explicitly enable the journey in PowerShell because it changes a separate test project:

```powershell
$env:RHOMBUS_RUN_PROVISIONING_JOURNEY = '1'
$env:RHOMBUS_JOURNEY_VERIFY_DELIVERY = '0'
npm run test:journey -- --workers=1
Remove-Item Env:RHOMBUS_RUN_PROVISIONING_JOURNEY
Remove-Item Env:RHOMBUS_JOURNEY_VERIFY_DELIVERY
```

The journey passed live on 3 October, proving UI setup and schedule creation, **not automatic delivery**. It pauses its own schedule afterward. [Recorded result](observations/ui-journey.md).

To inspect the original project instead of rebuilding a pipeline:

```bash
npm run test:ui
```

These inspect the existing pipeline, next-run display and history. The original schedule is paused; schedule checks need it enabled. History checks run only when explicitly enabled after an automatic attempt. See [prerequisites](ui-tests/README.md#existing-project-checks). Skips are not passes.

### API tests — `/api-tests/` (live Rhombus)

Run three direct tests of returned status and data, including negative tests that expect protected requests to be rejected. No login or browser is needed:

```bash
npx playwright test api-tests/backend.spec.ts --workers=1
```

All three passed live. For the complete suite, including checks of an existing schedule, complete the [login setup](ui-tests/README.md#save-a-session) and run:

```bash
npm run test:api
```

Schedule checks need an enabled hourly schedule. History checks also need explicit enablement after an automatic attempt; see [prerequisites](ui-tests/README.md#existing-project-checks). The historical history test failed because no records were returned.

### Data validation — `/data-validation/` (local saved files)

The validator compares input and output columns, row counts, cleaning, repeat consistency and semantic meaning. Test the validator itself:

```bash
npm run test:validator
```

All 12 local tests passed. Compare the actual downloaded S3 input with three real manual GCS exports:

```bash
python data-validation/validate.py --scenario baseline --source observations/evidence/baseline-source-fetched-2026-10-03.csv --output observations/evidence/baseline-manual-control-output-2026-10-02-2349.csv --repeat-output observations/evidence/baseline-manual-repeat-1-2026-10-03.csv --repeat-output observations/evidence/baseline-manual-repeat-2-2026-10-03.csv
```

No login, cloud credentials or extra Python packages are needed. All seven checks passed: nine input rows became five correct rows, and all outputs matched. This validates the original manual baseline, **not scheduled delivery or the new journey's code**. [Files and results](observations/baseline-manual.md).

Local semantic tests check cents-to-dollars conversion and day/month dates. Live scheduled handling remains unverified.

<details>
<summary>Check a fresh S3/GCS pair directly (requires cloud access)</summary>

Install the cloud packages in a Python virtual environment and configure AWS credentials and Google Application Default Credentials for the validator. Logging into Rhombus or setting its GCS destination key does not authenticate this script.

```bash
python -m pip install -r data-validation/requirements.txt
python data-validation/validate.py --scenario baseline --source s3://SOURCE_BUCKET/baseline.csv --output gs://DEST_BUCKET/OUTPUT_FROM_THIS_RUN.csv --report data-validation/reports/baseline.json
```

Replace the example paths with the input and output from the same run. To check repeat consistency, add two `--repeat-output` arguments for further runs with the same input and unchanged pipeline. With one output, consistency remains unevaluated. The report distinguishes failed checks from unevaluated checks.

</details>

<details>
<summary>Additional checks we created</summary>

```bash
npm run test:journey-results
```

These nine local tests check our logic for rejecting old or unrelated runs and files. They passed, but do not test Rhombus's scheduler. Our [additional automatic-delivery check](ui-tests/README.md#strict-delivery-mode) remains unverified live. Both are our implementation choices, not separate take-home requirements.

</details>

## Scheduled drift coverage summary

[`/datasets/`](datasets/) holds the baseline and seven drift variants. Each case links to its `/observations/` write-up of the change, expectation and blocked coverage.

Without a successful scheduled baseline, these scheduled outcomes, chatbot repairs and recovery could not be assessed. Rhombus advised documenting the blocker instead of submitting manual drift results. [Findings and support guidance](observations/scheduler-support-report.md#support-guidance-and-effect-on-the-take-home).

| Case | Change | Pipeline stopped? | Chatbot fix worked? | Severity |
| --- | --- | --- | --- | --- |
| [Drop](observations/schema-drop-column.md) | Remove `amount_usd` | Not evaluated | Not evaluated | Not assessed |
| [Rename](observations/schema-rename-column.md) | `customer_email` → `email` | Not evaluated | Not evaluated | Not assessed |
| [Type](observations/schema-change-type.md) | Numeric amount becomes words | Not evaluated | Not evaluated | Not assessed |
| [Add](observations/schema-add-column.md) | Add `coupon_code` | Not evaluated | Not evaluated | Not assessed |
| [Combined](observations/schema-combined.md) | Drop, rename, type and add | Not evaluated | Not evaluated | Not assessed |
| [Cents](observations/semantic-cents.md) | Amounts become cents | Not evaluated | Not evaluated | Not assessed |
| [Day/month](observations/semantic-day-month.md) | Date meaning becomes DD/MM/YYYY | Not evaluated | Not evaluated | Not assessed |

## Results and evidence storage

The [evidence index](observations/evidence/README.md) links screenshots, logs and downloaded CSVs for the [UI journey](observations/ui-journey.md), [manual validation](observations/baseline-manual.md) and [scheduler findings](observations/scheduler-support-report.md).

Temporary results in `test-results/` and `playwright-report/` can be replaced by later runs. Reviewed evidence under `/observations/` preserves the findings.

## Usability feedback

The connection and scheduling guides explained the workflow, and Dashboard helped find manual runs. Empty schedule history and stale Next run values gave little help with missing delivery. Each automatic attempt should show whether it started, which steps ran, where the output went and any error.

The chatbot could not inspect scheduler logs or credentials, but promised disabling sampling would restore exports. Later checks did not verify that promise. Suggestions should state those access limits and explain how to confirm whether a change worked. [Captured exchange](observations/evidence/baseline-schedule-chatbot-2026-10-02.md).

## Remaining submission checklist

1. Record the required walkthrough and add its link below.
2. Check access to the video and repository links, and the accuracy of the reported coverage.

No further manual drift results are required under Rhombus's support guidance.

## Demo video

**Not recorded; link pending.** The required short walkthrough should show UI tests, API tests and real-file validation, and explain the blocker. Identify manual exports and historical scheduler evidence clearly.

## Optional dashboard

A hosted observability dashboard is an optional bonus. No dashboard link is included in this submission.
