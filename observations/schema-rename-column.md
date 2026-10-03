# Schema drift: rename customer_email

**Result: not run on a schedule.** The required successful automatic baseline was not established. This is a prepared QA case; scheduled behaviour, logs, output, chatbot repair and later recovery were not assessed, and no severity is assigned. The [scheduler report](scheduler-support-report.md) explains the blocker and Rhombus's guidance to document its effect on progress.

## Prepared change and expected result

[schema-rename-column.csv](../datasets/schema-rename-column.csv) renames `customer_email` to `email`; all nine rows and their values remain unchanged.

The expected product response is to identify the missing contracted field or explicitly map `email` to `customer_email`. A valid repaired export retains the six original output columns and five cleaned rows. Silent loss of email data is unacceptable.

With `--scenario schema-rename-column`, the unchanged validator fails `source_schema`: it requires `customer_email` and does not automatically map `email`. Row count and cleaning checks remain unevaluated even if a repaired pipeline exports five rows. Retain that source-schema alert and separately explain and verify any declared mapping.

## How to repeat after a successful scheduled baseline

Follow the [shared scheduled-check procedure](baseline-scheduled.md#shared-procedure-for-a-future-drift-check) for the baseline prerequisite, evidence capture and restoration. This case has not been executed.

1. Replace that same S3 object with `schema-rename-column.csv` and confirm the uploaded bytes. Keep the selected source and pipeline unchanged for this first automatic check.
2. Give the chatbot the actual error or result and save its diagnosis. If it proposes an email mapping, apply it through AI Builder and record the saved change. Inspect a later automatic run, its six output headers and cleaned values to assess repair and schedule recovery, while retaining the original schema alert.

From the repository root, substitute the actual saved files for this run:

```bash
python data-validation/validate.py --scenario schema-rename-column --source ACTUAL_INPUT.csv --output ACTUAL_OUTPUT.csv --report data-validation/reports/schema-rename-column.json
```

For missing output and repeated runs, follow the [shared reporting rules](baseline-scheduled.md#validation-and-reporting).
