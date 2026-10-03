# Schema drift: add coupon_code

**Result: not run on a schedule.** The required successful automatic baseline was not established. This is a prepared QA case; scheduled behaviour, logs, output, chatbot repair and later recovery were not assessed, and no severity is assigned. The [scheduler report](scheduler-support-report.md) explains the blocker and Rhombus's guidance to document its effect on progress.

## Prepared change and expected result

[schema-add-column.csv](../datasets/schema-add-column.csv) appends `coupon_code` to the six baseline columns, preserving nine rows and existing values. Order `1001` has `SPRING10`; the other coupon cells are empty.

The expected export remains five cleaned rows with exactly `order_id, customer_email, customer_name, amount_usd, order_date, country`. It must omit `coupon_code`. Whether Rhombus flags the added source field is a separate usability observation.

With `--scenario schema-add-column`, the validator records `coupon_code` in `source_extra_columns` but does not fail source schema merely because an extra column exists. A correct five-row, six-column export can pass all evaluated checks. Correct output does not require a transformation repair.

## How to repeat after a successful scheduled baseline

Follow the [shared scheduled-check procedure](baseline-scheduled.md#shared-procedure-for-a-future-drift-check) for the baseline prerequisite, evidence capture and restoration. This case has not been executed.

1. Replace that same S3 object with `schema-add-column.csv` and confirm the uploaded bytes. Keep the selected source and pipeline unchanged for this first automatic check.
2. Save any chatbot explanation of the new field or an actual error. If output already meets the contract, record that no repair was needed. If a repair is attempted through AI Builder, retain its advice and saved changes, then inspect a later automatic run for correct output and continued scheduling.

From the repository root, substitute the actual saved files for this run:

```bash
python data-validation/validate.py --scenario schema-add-column --source ACTUAL_INPUT.csv --output ACTUAL_OUTPUT.csv --report data-validation/reports/schema-add-column.json
```

For missing output and repeated runs, follow the [shared reporting rules](baseline-scheduled.md#validation-and-reporting).
