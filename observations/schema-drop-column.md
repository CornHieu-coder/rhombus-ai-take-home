# Schema drift: remove amount_usd

**Result: not run on a schedule.** The required successful automatic baseline was not established. This is a prepared QA case; scheduled behaviour, logs, output, chatbot repair and later recovery were not assessed, and no severity is assigned. The [scheduler report](scheduler-support-report.md) explains the blocker and Rhombus's guidance to document its effect on progress.

## Prepared change and expected result

[schema-drop-column.csv](../datasets/schema-drop-column.csv) removes `amount_usd` while retaining nine rows and the other five baseline columns.

The expected product response is a clear missing-column error before an export is accepted as valid. Amounts are absent from this source; a repair must obtain them upstream or explain the missing data, rather than invent them.

With `--scenario schema-drop-column`, the validator fails `source_schema` and cannot assess expected cleaned row count or cleaning rules. Its `expected_rows=0` is a consequence of the missing column, not an expected valid empty export.

## How to repeat after a successful scheduled baseline

Follow the [shared scheduled-check procedure](baseline-scheduled.md#shared-procedure-for-a-future-drift-check) for the baseline prerequisite, evidence capture and restoration. This case has not been executed.

1. Replace that same S3 object with `schema-drop-column.csv` and confirm the uploaded bytes. Keep the selected source and pipeline unchanged for this first automatic check.
2. Ask the chatbot to diagnose the captured missing-column error. Save its reply and any proposed repair. Apply a repair through AI Builder only if it explains where amounts come from; inspect and validate a later automatic run and record whether scheduling continues.

From the repository root, substitute the actual saved files for this run:

```bash
python data-validation/validate.py --scenario schema-drop-column --source ACTUAL_INPUT.csv --output ACTUAL_OUTPUT.csv --report data-validation/reports/schema-drop-column.json
```

For missing output and repeated runs, follow the [shared reporting rules](baseline-scheduled.md#validation-and-reporting).
