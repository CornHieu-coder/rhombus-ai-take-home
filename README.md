# Rhombus AI take-home: pipeline testing

This exercise tests **Amazon S3 → AI Builder cleaning → Google Cloud Storage → scheduled runs**. The required UI tests run from the command line, use no fixed sleeps and check real outcomes. The take-home also requires direct API tests, data validation, datasets and case write-ups, with a successful scheduled baseline before drift testing.

## Review at a glance

These are recorded results from 2–3 October 2026, not a fresh assessment of the current service.

| Required work | What was verified |
| --- | --- |
| UI automation — live Rhombus | Playwright completed the setup journey on 3 October, including an enabled schedule. This proves setup, **not automatic delivery**. [Evidence](observations/ui-journey.md). |
| Direct API tests — live Rhombus | Three tests passed, including rejection of protected requests without a login. The history test failed because scheduled records were missing. [Results](observations/ui-journey.md#other-verification-in-this-session), [history findings](observations/scheduler-support-report.md#chatbot-diagnosis-and-automated-checks). |
| Data validation — local saved files | Twelve validator tests passed. Three real manual GCS exports matched and passed checks against actual S3 input, validating the original manual baseline. [Evidence](observations/baseline-manual.md). |
| Scheduled baseline and drift | No successful automatic baseline was established. Scheduled drift, chatbot fixes and recovery remain unassessed. [Blocker](observations/scheduler-support-report.md). |

Code: [`/ui-tests/`](ui-tests/), [`/api-tests/`](api-tests/) and [`/data-validation/`](data-validation/). Data: the baseline and seven drift variants in [`/datasets/`](datasets/). Case write-ups and evidence: [`/observations/`](observations/).

Start with [How to run](#how-to-run) for commands, or [Verified results and limits](#verified-results-and-limits) for evidence and coverage. The required [demo video](#demo-video) is pending; the hosted dashboard is optional.

## Scheduling blocker and submission scope

Two controlled checks with enabled schedules found no history records or fresh GCS output by their deadlines. The cause remains unknown. The user later paused the original schedule; that later state was not counted as a scheduling failure.

On 3 October, Rhombus advised documenting the blocker rather than submitting manual drift results. The prepared cases therefore have no assessed scheduled outcomes. UI tests, API tests, validation and the video remain part of the submission. [Support guidance](observations/scheduler-support-report.md#support-guidance-and-effect-on-the-take-home).

## Top three findings

1. **Manual export worked; automatic delivery was not established.** Manual outputs were valid and matched; controlled scheduled checks found no fresh output. [Controls](observations/scheduler-support-report.md#reproduction-and-controls).
2. **History did not explain the missing runs.** Schedule history was empty, next-run information became stale, and Dashboard showed manual records only. [Findings](observations/scheduler-support-report.md).
3. **The chatbot suggestion did not establish recovery.** Disabling sampling was suggested as a fix, but later checks still found no schedule-history recovery. [Follow-up](observations/scheduler-support-report.md#chatbot-diagnosis-and-automated-checks).

## What the tests prove

The full UI journey builds the required setup in a separate Rhombus project. Existing-project UI/API checks inspect a pipeline and schedule already saved; they do not rebuild the setup or inspect the exported CSV. Data validation checks the contents of actual files independently of Rhombus's Success messages.

## Verified results and limits

The table above records the results. Three limits matter when reviewing them:

- **UI setup is not delivery.** The new schedule was paused during cleanup before its first automatic trigger. The journey's newly generated cleaning code was not validated against a fresh export.
- **Manual validation is not scheduled validation.** The three real exports belong to the original manual baseline. Local semantic tests exercise the validator; scheduled semantic handling remains unverified.
- **Historical failures are separate from current prerequisites.** Controlled scheduling checks used enabled schedules. The original schedule was later paused, and tests requiring an enabled schedule were not rerun against that paused state.

The [scheduler report](observations/scheduler-support-report.md) contains the observation windows and reproduction. The [UI result](observations/ui-journey.md) and [manual validation report](observations/baseline-manual.md) identify the evidence for the passed work. Extra checks we created are described separately below; they are not additional take-home requirements.

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

[`/datasets/`](datasets/) holds the baseline and seven drift variants. Each case links to its `/observations/` write-up of the change, expectation and blocked coverage. They share one [future scheduled-check procedure](observations/baseline-scheduled.md), which has not been completed.

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

The most enjoyable part was using AI Builder to turn plain-English instructions into a visual pipeline. It was satisfying to see the workflow take shape from a description of what I wanted to achieve. The canvas helped me understand how the steps fitted together, and the data previews were useful for checking whether the cleaning matched my intentions. Being able to describe a change and then inspect its effect made the process feel interactive and approachable.

The most frustrating part was knowing what to do when the platform appeared to finish but I could not confirm that the expected result had been delivered. Moving between logs, execution history and cloud storage made troubleshooting slower and left me unsure whether to wait or change something. To make the platform more useful and efficient, I would suggest clearer guidance through unfinished setup steps and a single place to see a run’s progress, result and any problem that needs attention. The chatbot could also make recovery easier by explaining what it has confirmed, what remains uncertain and how to check whether its suggestion worked. These improvements would reduce repeated checking and help me resolve problems with fewer steps.

## Remaining submission checklist

1. Record the required walkthrough and add its link below.
2. Check access to the video and repository links, and the accuracy of the reported coverage.

No further manual drift results are required under Rhombus's support guidance.

## Demo video

**Not recorded; link pending.** The required short walkthrough should show UI tests, API tests and real-file validation, and explain the blocker. Identify manual exports and historical scheduler evidence clearly.

## Optional dashboard

A hosted observability dashboard is an optional bonus. No dashboard link is included in this submission.
