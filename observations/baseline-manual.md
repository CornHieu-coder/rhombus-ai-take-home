# Manual baseline controls

These controls establish manual cleaning/export and consistency. The required automatic baseline remains unverified; see the [scheduler report](scheduler-support-report.md).

## Prompt and expected result

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

The nine source rows yield five orders: `1001, 1002, 1006, 1007, 1008`. Emails are lowercase, order 1006's missing name becomes `Unknown`, countries are `US`, and dates are YYYY-MM-DD.

## Automated manual control and direct GCS verification

Playwright clicked Run on the saved S3 → Custom → GCS pipeline with sampling disabled and schedules paused. GCS objects were independently downloaded through authenticated browser-observed links, with HTTP 200.

| Manual trigger time, UTC on 2 October 2026 | Actual GCS object | Saved output |
| --- | --- | --- |
| 13:49:53.588 | `RhombusAI_output_1790948994643.csv` | [Control CSV](evidence/baseline-manual-control-output-2026-10-02-2349.csv) |
| 14:35:18.175 | `RhombusAI_output_1790951722682.csv` | [Repeat 1 CSV](evidence/baseline-manual-repeat-1-2026-10-03.csv) |
| 14:35:44.190 | `RhombusAI_output_1790951748444.csv` | [Repeat 2 CSV](evidence/baseline-manual-repeat-2-2026-10-03.csv) |

All three are 320 bytes with SHA-256 `89cdb162f7d43e9f21ce0a8ae077295575837aa7d46580e8bc067940ab2b63bb`. Some filenames use the Sydney capture date, 3 October.

The independently downloaded [S3 source](evidence/baseline-source-fetched-2026-10-03.csv) is 531 bytes and equals [datasets/baseline.csv](../datasets/baseline.csv), SHA-256 `6bc9a17c1734676986c1d48ad1122b132e3d71e1b60c3867f6687b3d8d08139e`.

[Control provenance](evidence/baseline-manual-control-2026-10-02.json), [repeat/source provenance](evidence/baseline-manual-repeats-2026-10-03.json) and the [masked control screenshot](evidence/baseline-manual-control-2026-10-02.png) record the triggers, downloads and configuration comparison. The three process requests have the same recorded runtime fingerprint: `88e52ce85a867167e2a67f5dbca1f1beb957da758722d2c0afce1249f2e98c61`, covering node names, wiring, transformation types and parameters. The complete canonical request representation is not published, so that historical fingerprint cannot be independently recomputed from these selected-field records.

Dashboard later classified the corresponding executions `16454, 16456, 16457` as manual with no schedule ID. Their correlation uses project and timestamps; asynchronous task UUIDs are different identifiers. [Dashboard evidence](evidence/dashboard-executions-2026-10-03.json).

## Reproduce the validation locally

Run from the repository root:

```bash
python data-validation/validate.py --scenario baseline --source observations/evidence/baseline-source-fetched-2026-10-03.csv --output observations/evidence/baseline-manual-control-output-2026-10-02-2349.csv --repeat-output observations/evidence/baseline-manual-repeat-1-2026-10-03.csv --repeat-output observations/evidence/baseline-manual-repeat-2-2026-10-03.csv
```

The [saved report](evidence/baseline-manual-determinism-validation.json) passes all seven checks, including ordered determinism. Numerically equal float serialization such as `42.5` and `42.50` is accepted; extra nonzero precision and incorrect values are rejected. The expected-output unit-test fixture is separate from these actual exports.

## Limits

The controls do not prove scheduled dispatch, worker credentials, automatic delivery or live semantic drift handling. This baseline does not independently exercise missing order IDs, nonpositive amounts, disallowed countries or rounding of values with extra precision.

A [historical generated-code snapshot](evidence/README.md#historical-code-and-archives) preserves complete code captured during exploratory manual work. It is evidence of that capture, not a complete saved configuration for the three controls. Earlier exploratory results are available in immutable Git history; they are outside the current submission route.
