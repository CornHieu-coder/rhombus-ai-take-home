# Rhombus AI pipeline drift test repository

This repository tests a scheduled Amazon S3 → Rhombus AI → Google Cloud Storage cleaning pipeline. It includes eight source datasets, Playwright UI tests, direct backend API tests, a data validator, and reproducible scheduler evidence. Manual baseline controls produced valid GCS exports, but controlled automatic checks produced no execution history or fresh GCS object within the recorded windows. **The scheduled baseline and scheduled drift coverage are blocked, not passed.**

## Submission scope after Rhombus's guidance

On **3 October 2026 at 14:08 Sydney time** (`04:08Z`), Rhombus replied that manual drift results need not be submitted and asked for an explanation of how the scheduler issue prevented progress, in the README or another appropriate file. This submission therefore focuses on the [scheduler failure report](observations/scheduler-support-report.md), its controls, reproduction steps, evidence and assessment impact. The private correspondence is retained outside this public repository.

The exercise requires a successful automatic baseline before testing source changes on later scheduled runs. That baseline was never verified: the edited schedule and a fresh schedule both returned empty history and unchanged GCS listings. Without it, we cannot assess scheduled handling of drift, scheduled recovery after a chatbot repair, or the next schedule execution. The [detailed observation](observations/baseline-scheduled.md) records the failed checks and their limits. Manual baseline controls establish that the manual cleaning/export path works; they do not establish that the scheduler dispatched work.

No further manual drift runs are planned for this submission. Previously captured manual case files remain as historical records and are not offered as replacements for the scheduled exercise. Rhombus's reply gives a documentation route around the blocker; it does not confirm a scheduler fix or explicitly waive the other repository, automation, validator or video deliverables.

## Current status and findings

| Area | Status |
| --- | --- |
| Direct backend API tests | 4 passed, 1 failed on 2026-10-02: authenticated schedule configuration passes; history regression fails with total=0 |
| Validator unit tests | 12 passed locally on 2026-10-02, including numeric serialization and wrong-amount regressions |
| Manual baseline run | Actual S3 baseline bytes match the repository. Three manual outputs with matching runtime configuration pass all seven checks, including ordered determinism. [Evidence and analysis](observations/baseline-manual.md) |
| Schedule and scheduled baseline | Blocked: controlled edited and fresh schedules leave empty history and no new GCS output. The user later replaced them with schedule 209, tried minute 16 and paused it. Cause unconfirmed. [Observation](observations/baseline-scheduled.md), [reviewed scheduler failure report](observations/scheduler-support-report.md) |
| Support-requested Dashboard check | On 3 October at 10:02 Sydney time, Dashboard/global API returns 13 records, all manual with no schedule ID. Schedule 209 history remains empty. This clarifies where manual records are stored and leaves automatic delivery unverified. [Evidence](observations/evidence/dashboard-executions-2026-10-03.json) |
| Authenticated UI tests | 1 passed, 2 failed on 2026-10-02: connected canvas passes; Next run and history regressions fail |
| Full provisioning journey | Scaffold only; skipped in the live run, locators not verified |
| Drifted scheduled runs and evidence | Blocked by the missing automatic baseline; document the gap per Rhombus's 3 October guidance |
| Manual drift results | Historical only; Rhombus says these need not be submitted. No additional manual cases planned |
| Demo video | Pending; add link after recording a real walkthrough |

Three main observed issues, without assigning a backend root cause:

1. **Automatic delivery could not be verified.** Edited schedule 202 and fresh schedule 208 produced no new GCS object within bounded, independently refreshed checks, while a manual control produced a valid export. This prevented the required scheduled baseline and later drift exercise. [Reproduction and controls](observations/scheduler-support-report.md#reproduction-and-controls).
2. **Scheduled history provided no diagnostic record.** Schedule-specific APIs returned HTTP 200 with zero records. Dashboard showed 13 records, all classified as manual with no schedule ID. Earlier user-confirmed automatic attempts displayed generic Success logs, whose trigger and executed nodes cannot be independently established from the crops. [Dashboard check and limits](observations/scheduler-support-report.md#dashboard-check-requested-by-support--3-october-2026).
3. **Schedule monitoring and chatbot advice did not resolve the blocker.** `last_run_at` stayed null and `next_run_at` stopped advancing after observed boundaries. The UI displayed no Next run value when the timestamp was stale, but rendered a future timestamp after an edit. The chatbot promised that disabling sampling would restore delivery despite stating its access limits; later checks did not verify that promise. [Detailed investigation](observations/baseline-scheduled.md).

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

On 3 October 2026 Sydney time, a targeted history regression still failed on the real `No results.` cell. Its selector and the capture command now open the enabled schedule's history when a paused diagnostic schedule is also present. The final capture command succeeded; the earlier full-suite counts above are retained as dated results, not rerun counts.

To smoke-test the validator without clouds:

```bash
python data-validation/validate.py --scenario baseline --source datasets/baseline.csv --output data-validation/tests/fixtures/expected-baseline-output.csv
```

For an actual scheduled run, supply the exact S3 source key and timestamped GCS object from that run:

```bash
python data-validation/validate.py --scenario baseline --source s3://SOURCE_BUCKET/rhombus-qa/baseline.csv --output gs://DEST_BUCKET/rhombus-qa-output-TIMESTAMP.csv --report data-validation/reports/baseline.json
```

Add `--repeat-output gs://...` twice to compare three executions of the same input and configuration for determinism. If a run produced no export, replace `--output ...` with `--output-missing`. The validator returns exit code 0 for passed checks and 2 for a data-validation failure. It checks input and output schema, row counts, all cleaning rules, newly invalid values, both semantic drift meanings, and repeated output consistency. `passed: null` means a check was not evaluated, such as determinism without three outputs.

## Original drift procedure — blocked

For each case, use the same S3 key configured in the pipeline. Restore the baseline and confirm a successful scheduled run. Replace that object with the case dataset before the next scheduled trigger and choose **Refresh access** in the S3 source. Record the execution ID, time, status, output URI or lack of output, relevant node logs, and the exported schedule-history CSV. Ask the chatbot to diagnose the exact error; apply any proposed repair using the AI builder and verify it on a later run. Run the data validator against the S3 and GCS objects from each run. Restore baseline between cases to isolate effects. [Scheduling documentation](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/) describes execution history, failure nodes, and the effect of saved pipeline changes on later runs.

This is the procedure specified by the original exercise, not an instruction to continue running cases for this submission. Scheduling remained unresolved, and Rhombus subsequently directed the submission toward documenting that blocker.

### Continuing while scheduled delivery is unresolved

Follow Rhombus's 3 October guidance: submit the scheduler report and explain the assessment coverage it prevented. No additional manual drift results are needed. The three manual baseline controls already establish cleaning/export correctness and determinism under the captured configuration.

Schedule 209 was paused by the user and remains paused in the last verified capture. The source was restored to the baseline and its bytes verified after the prior probes. No fresh automatic run or live cloud change was made for this documentation update.

## Remaining submission checklist

| Deliverable from the original exercise | Verified state | Remaining action |
| --- | --- | --- |
| Public GitHub repository with the requested folders and datasets | Present | Final check of setup commands, links and redaction |
| Reproducible findings, severity, evidence, chatbot attempt and limitations | Scheduler report and supporting captures present | Submit the report as the explanation of blocked progress; keep the cause unconfirmed |
| At least one Playwright UI journey through source, AI pipeline, destination, schedule and result | Existing-project checks ran; full provisioning journey is an unverified scaffold | Verify the provisioning locators and runnable steps; record the scheduling step as blocked rather than inventing success |
| At least two direct backend tests, including a negative case, with status/body assertions | Implemented and run; dated results include the missing-history failure | Preserve commands and results; no additional API cases are required to meet the minimum |
| Validator for schema, row count, cleaning, invalid values, semantic drift and determinism | Implemented; actual manual baseline controls and three-output determinism verified | Demonstrate it on the actual saved baseline exports; scheduled output and live semantic coverage remain blocked |
| Summary, three main issues and usability feedback in README | Present, updated around the scheduler blocker | Final review before submission |
| Short demo video linked from README | Not recorded | Record the real pipeline, schedule/history evidence, backend tests and validator; add the video URL |

Rhombus did not explicitly waive the UI journey or video. Those remain the main unfinished deliverables outside scheduling. Historical manual case files and unrun templates are retained for traceability; their run/repair prompts describe the original procedure, not new work requested under the revised submission scope.

## Scheduled drift coverage summary

All seven cases below were blocked by the missing automatic baseline. These rows report scheduled coverage only; previous manual artifacts are historical and are not submitted as scheduled results. No per-case data defect or severity is inferred from an unrun scheduled case.

| Case | Prepared source change | Pipeline stopped? | Chatbot fix worked? | Severity |
| --- | --- | --- | --- | --- |
| [Drop column](observations/schema-drop-column.md) | Remove `amount_usd` | Not evaluated: scheduler blocker | Not evaluated | Not assessed |
| [Rename column](observations/schema-rename-column.md) | `customer_email` → `email` | Not evaluated: scheduler blocker | Not evaluated | Not assessed |
| [Change type](observations/schema-change-type.md) | Numeric amount becomes words | Not evaluated: scheduler blocker | Not evaluated | Not assessed |
| [Add column](observations/schema-add-column.md) | Add `coupon_code` | Not evaluated: scheduler blocker | Not evaluated | Not assessed |
| [Combined](observations/schema-combined.md) | Drop, rename, type change and add | Not evaluated: scheduler blocker | Not evaluated | Not assessed |
| [Cents](observations/semantic-cents.md) | USD amounts become cents | Not evaluated: scheduler blocker | Not evaluated | Not assessed |
| [Day/month](observations/semantic-day-month.md) | Switch date interpretation | Not evaluated: scheduler blocker | Not evaluated | Not assessed |

## Usability feedback

The public documentation is helpful: it distinguishes Analysis from `/pipeline` mode and explains that creating nodes does not run them automatically. The source, destination, and scheduling guides also give concrete steps and permissions, which made the test procedure possible to specify.

The earlier user-confirmed automatic attempts showed generic Success logs without a visible schedule-history record or fresh export; the crops alone do not independently identify the trigger or prove node execution. Later controlled checks provided no schedule record to diagnose. An explicit trigger type, execution link, export result and a clear explanation of a stale Next run value would make these outcomes easier to investigate. Dashboard exposes manual records, which should be distinguishable from evidence of automatic delivery. The chatbot accurately stated its access limits, then promised that disabling sampling would restore GCS writes without inspecting scheduler logs or credentials; later observations did not verify that promise. The [captured exchange](observations/evidence/baseline-schedule-chatbot-2026-10-02.md) preserves both the limits and the promise. The [scheduling guide](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/) also says backend error text is available in exported history CSV rather than the table.

## Demo video

Pending a short recording showing the configured S3 → AI-built cleaning → GCS pipeline, the recorded scheduler failure, the actual Dashboard classifications, direct backend tests and validator results for saved real baseline CSVs. Explain which scheduled and drift steps were blocked, and distinguish recorded evidence from current live observations. Add the public video URL here after recording. No additional manual drift demonstration is needed under Rhombus's guidance.
