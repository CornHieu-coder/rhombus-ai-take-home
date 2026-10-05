# Check saved input and output files

The validator calculates what the cleaned output should contain, then compares it with the actual CSV. It checks columns, row counts, cleaning, repeated results and the two semantic cases. Saved files can be checked offline; reading an S3 or GCS address instead requires cloud credentials. [Recorded manual results](../observations/baseline-manual.md) remain separate from current local tests.

## Run locally

From the repository root:

```bash
npm run test:validator
```

Most tests use only Python's standard library. Three additional tests need pandas: two check inferred column types and one replays the unmodified saved AI code. They skip if pandas is absent. To reproduce those checks with the version used in this review, install `pandas==3.0.0` in your own Python environment. No pandas package is needed for the validator CLI or the saved baseline comparison in the [main README](../README.md#data-validation--data-validation-local-saved-files).

The new controlled schema files are [prepared test inputs](../datasets/README.md), not observed Rhombus outputs. Existing CLI scenario names still use the original baseline family as their comparison reference.

## Read the report

- `true` means that check passed. `false` means it failed. `null` means it was not evaluated. An overall pass does not turn unevaluated checks into passes.
- Duplicate or empty headers, inconsistent row widths and CSV syntax errors fail schema checks. `csv_errors` identifies the problem and record or line. A correctly headed extra input column is allowed; the final output still needs exactly the six required columns.
- `new_invalid_values` is an input-quality alert. It identifies newly lost valid orders or new reasons for rejecting rows compared with the original baseline. Correctly removing those rows can still pass row-count and cleaning checks.
- Repeat consistency compares the available outputs, including row order and numeric amount values. Two matching outputs pass; different outputs fail; fewer than two leaves the check unevaluated. The optional three-run comparison is stronger evidence, not the minimum requirement.
- If an output or repeat cannot be read, the CLI retains useful checks and writes its JSON report. `retrieval_errors` records the failed file, and the command exits with status `2`. A remaining pair can still be compared; the report states how many files were unavailable. Missing files are not evidence of varying results.

## Date and amount expectations

The local comparison accepts ISO dates (`YYYY-MM-DD`). Slash dates are interpreted as **month/day/year** in the original baseline and schema cases, and **day/month/year** in `semantic-day-month`. For example, `04/05/2026` means 5 April in the baseline and 4 May in that semantic case. Impossible dates are rejected. Other date notations and Rhombus's handling of them have not been assessed by these fixtures.

Amounts must be finite positive numbers before rounding. In `semantic-cents`, the input is divided by 100 before comparison. Amounts are rounded to two decimals; `42.5` and `42.50` are equal, while an incorrect amount remains a mismatch.

Finite large amounts are handled with increased decimal precision. Values requiring more than 1,000 digits for rounding, or otherwise exceeding the calculator's range, produce structured `amount_range` errors. Expected row count and cleaning checks then remain unevaluated. This safety limit belongs to our validator; it is not an extra Rhombus cleaning rule or an observed platform behavior.

## Saved AI code check

The [focused empty-ID test](tests/test_validation_regressions.py) compares a two-row input with an independently written one-row expectation. It also replays the historical AI code locally and confirms that the validator rejects the retained empty-ID row. The artifact stays unchanged. [Finding and required live repair](../observations/ui-journey.md#local-cleaning-check--5-october-2026).
