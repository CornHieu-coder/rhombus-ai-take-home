# Semantic drift: dates use DD/MM/YYYY

**Result: not run on a schedule.** The required successful automatic baseline was not established. This is a prepared QA case; scheduled behaviour, logs, output, chatbot repair and later recovery were not assessed, and no severity is assigned. The [scheduler report](scheduler-support-report.md) explains the blocker and Rhombus's guidance to document its effect on progress.

## Prepared change and expected result

[semantic-day-month.csv](../datasets/semantic-day-month.csv) keeps the six headers, nine rows and other values, but swaps MM/DD/YYYY dates to DD/MM/YYYY. Order `1001` changes from `04/05/2026` to `05/04/2026`; both mean 5 April 2026 under their declared formats. Invalid `13/40/2026` becomes `40/13/2026` and remains invalid.

Correct interpretation yields five cleaned orders with the same calendar dates as the baseline. Order `1001` must export as `2026-04-05`, not `2026-05-04`. Ambiguous slash-separated dates and the unchanged header alone do not establish the intended format; automatic detection or a warning must be observed.

With `--scenario semantic-day-month`, the validator parses the source as DD/MM/YYYY and compares the intended dates. An export using the old month-first interpretation can have correct schema and row count while failing the cleaning check. This checks the declared meaning, not whether Rhombus noticed the change.

## How to repeat after a successful scheduled baseline

Follow the [shared scheduled-check procedure](baseline-scheduled.md#shared-procedure-for-a-future-drift-check) for the baseline prerequisite, evidence capture and restoration. This case has not been executed.

1. Replace that same S3 object with `semantic-day-month.csv` and confirm the uploaded bytes. Keep the selected source and pipeline unchanged for this first automatic check. Keep the baseline date interpretation for the first check.
2. Ask the chatbot to explain the actual result and save its reasoning. Record which format information it received; do not claim that ambiguous dates establish the format. If it proposes a repair, declare DD/MM/YYYY explicitly, apply it through AI Builder, and validate a later automatic output and continued scheduling.

From the repository root, substitute the actual saved files for this run:

```bash
python data-validation/validate.py --scenario semantic-day-month --source ACTUAL_INPUT.csv --output ACTUAL_OUTPUT.csv --report data-validation/reports/semantic-day-month.json
```

For missing output and repeated runs, follow the [shared reporting rules](baseline-scheduled.md#validation-and-reporting).
