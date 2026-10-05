# Manual baseline: real-file validation

## Result

The original pipeline's manual baseline was verified. Nine S3 input rows produced five correct GCS output rows. Three exports passed the baseline checks and matched each other. The [seven-check report](evidence/baseline-manual-determinism-validation.json) records the comparison.

These were runs started with the Run button, not scheduled triggers. They establish manual cleaning and repeat consistency; the [successful scheduled baseline remained blocked](scheduler-support-report.md).

## What was checked

The validator independently calculates the expected cleaned rows from the input, then compares the export's columns, row count and values. It also checks repeat consistency: **the same input and configuration should produce the same output across repeated runs**. Determinism validation is required and can compare at least two outputs. Here, the three-output comparison, including row order, supplies stronger bonus evidence; three runs are not the minimum requirement.

The source and exports below are actual downloaded cloud files. The [expected-output fixture](../data-validation/tests/fixtures/expected-baseline-output.csv) is used only to test the validator itself; it is not a Rhombus export.

## Prompt and expected result

The baseline starts with **9 rows**. The correct cleaned CSV should contain **5 orders**: `1001`, `1002`, `1006`, `1007` and `1008`.

In those five rows:

- Emails should be lowercase.
- Missing customer names should become `Unknown`.
- Country should be `US` in every row.
- Dates should use the `YYYY-MM-DD` format.

The final CSV should contain exactly these six columns, in this order:

~~~text
order_id, customer_email, customer_name, amount_usd, order_date, country
~~~

Amounts are compared as numbers, so `42.5` and `42.50` are treated as equal.

<details>
<summary>Exact original and saved cleaning prompts</summary>

The original user-supplied AI Builder prompt was:

> Using baseline.csv as the input, build a cleaning pipeline that:
>
> - trims whitespace from text fields
> - lowercases customer_email
> - removes duplicate order_id rows, keeping the first occurrence
> - fills missing customer_name with "Unknown"
> - removes rows where order_id or customer_email is missing
> - removes rows where amount_usd is invalid or <= 0
> - removes rows with invalid order_date
> - keeps only countries US, usa, or United States
> - standardizes country to "US"
> - formats amount_usd to 2 decimal places
> - formats order_date as YYYY-MM-DD
> - outputs exactly these columns:
>
> order_id, customer_email, customer_name, amount_usd, order_date, country.

The saved transformation prompt captured during authenticated inspection specifies the order explicitly:

> Clean the dataframe using the following steps in order: 1. Trim leading/trailing whitespace from all string/object columns. 2. Lowercase the customer_email column. 3. Remove duplicate order_id rows, keeping the first occurrence. 4. Fill missing customer_name values with the string 'Unknown'. 5. Remove rows where order_id is null/empty or customer_email is null/empty. 6. Remove rows where amount_usd is not a valid number or is <= 0. 7. Remove rows where order_date cannot be parsed as a valid date. 8. Keep only rows where the country value (case-insensitive, trimmed) is one of: 'us', 'usa', 'united states'. 9. Standardize the country column to the value 'US' for all remaining rows. 10. Format amount_usd to 2 decimal places (as a float rounded to 2 decimals). 11. Format order_date as a string in YYYY-MM-DD format. 12. Output exactly these columns in this order: order_id, customer_email, customer_name, amount_usd, order_date, country.

</details>

<a id="automated-manual-control-and-direct-gcs-verification"></a>

## Manual runs and actual GCS files

Project **4266** contained the saved S3 baseline → Custom cleaning → GCS pipeline. Sampling was disabled and schedules were paused. Playwright clicked Run; that is still a manual trigger. GCS files were independently downloaded through the authenticated console with HTTP 200.

All trigger times below are UTC on **2 October 2026**. Some local filenames use the Sydney capture date, 3 October.

| Trigger time | GCS object | Downloaded file |
| --- | --- | --- |
| 13:49:53.588 | `RhombusAI_output_1790948994643.csv` | [Control CSV](evidence/baseline-manual-control-output-2026-10-02-2349.csv) |
| 14:35:18.175 | `RhombusAI_output_1790951722682.csv` | [Repeat 1 CSV](evidence/baseline-manual-repeat-1-2026-10-03.csv) |
| 14:35:44.190 | `RhombusAI_output_1790951748444.csv` | [Repeat 2 CSV](evidence/baseline-manual-repeat-2-2026-10-03.csv) |

The [downloaded S3 source](evidence/baseline-source-fetched-2026-10-03.csv) is 531 bytes and equals [datasets/baseline.csv](../datasets/baseline.csv). Each export is 320 bytes. [Control record](evidence/baseline-manual-control-2026-10-02.json), [source/repeat record](evidence/baseline-manual-repeats-2026-10-03.json) and [control screenshot](evidence/baseline-manual-control-2026-10-02.png) record the actions and downloads.

Dashboard later identified executions **16454, 16456 and 16457** as manual, with no schedule ID. That association uses the project and times; the background task IDs are different identifiers. [Dashboard capture](evidence/dashboard-executions-2026-10-03.json).

## Reproduce the validation locally

From the repository root, with Python 3.10+:

~~~bash
python data-validation/validate.py --scenario baseline --source observations/evidence/baseline-source-fetched-2026-10-03.csv --output observations/evidence/baseline-manual-control-output-2026-10-02-2349.csv --repeat-output observations/evidence/baseline-manual-repeat-1-2026-10-03.csv --repeat-output observations/evidence/baseline-manual-repeat-2-2026-10-03.csv
~~~

No Rhombus login, cloud credentials or extra Python packages are needed. This repeats the file comparison, not the cloud runs.

A passing report means the evaluated checks passed. In this three-output comparison, all seven checks were evaluated and passed. A check marked `null` in another report was not evaluated; for example, one export alone cannot establish repeat consistency.

To repeat the cloud experiment, use the original baseline and unchanged pipeline, start at least two manual runs with scheduling paused, and download each resulting GCS object. Save the source, trigger times and file names, then supply one export as `--output` and at least one further export as `--repeat-output`. A third run is optional and reproduces the stronger comparison shown above.

## Limits

- These files validate the original manual pipeline, not the new Playwright journey's generated code or any scheduled run.
- This baseline does not independently exercise missing order IDs, nonpositive amounts, disallowed countries or rounding of extra decimal precision.
- Cents-to-dollars and day/month-date expectations are tested locally by the validator tests. No live scheduled semantic handling was assessed.

<details>
<summary>File identity and comparison records</summary>

The source SHA-256 is `6bc9a17c1734676986c1d48ad1122b132e3d71e1b60c3867f6687b3d8d08139e`. All three export files have SHA-256 `89cdb162f7d43e9f21ce0a8ae077295575837aa7d46580e8bc067940ab2b63bb`.

The three manual process requests recorded the same hash of pipeline settings: `88e52ce85a867167e2a67f5dbca1f1beb957da758722d2c0afce1249f2e98c61`. It covered node names, connections, step types and parameters. The complete requests are not published, so that historical hash cannot be independently recalculated from the selected public fields.

The [historical generated-code capture](evidence/README.md#historical-code-and-archives) is from earlier exploratory work. It is not a complete saved configuration for these three runs. Earlier exploratory results are outside the current submission route.

</details>
