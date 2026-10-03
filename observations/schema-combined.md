# Schema drift: combine four changes

**Result: not run on a schedule.** The required successful automatic baseline was not established. This is a prepared QA case; scheduled behaviour, logs, output, chatbot repair and later recovery were not assessed, and no severity is assigned. The [scheduler report](scheduler-support-report.md) explains the blocker and Rhombus's guidance to document its effect on progress.

## Prepared change and expected result

[schema-combined.csv](../datasets/schema-combined.csv) retains nine rows and combines four changes:

- Remove `country`.
- Rename `customer_email` to `contact_email`, retaining the email values.
- Replace order `1006`'s `120.00` amount with `one hundred twenty`.
- Add `loyalty_tier`: `gold` for `1001`, `silver` for both `1002` rows and `bronze` for `1006`; remaining cells are empty.

The expected product response is to identify incompatible fields before an export is accepted as valid. A repair must explain the email mapping, obtain missing country data upstream, preserve the invalid-number rule or explicitly replace it, and retain the six contracted output columns. Resolving only the first error does not establish recovery.

With `--scenario schema-combined`, the validator fails source schema for missing `customer_email` and `country` and records extra fields. It cannot assess cleaned row count or cleaning rules from the unrepaired source. Its `expected_rows=0` is not an expected empty export. The schema failure also leaves the new invalid-amount check unevaluated.

## How to repeat after a successful scheduled baseline

Follow the [shared scheduled-check procedure](baseline-scheduled.md#shared-procedure-for-a-future-drift-check) for the baseline prerequisite, evidence capture and restoration. This case has not been executed.

1. Replace that same S3 object with `schema-combined.csv` and confirm the uploaded bytes. Keep the selected source and pipeline unchanged for this first automatic check.
2. Ask the chatbot to diagnose the captured result and save each proposed repair. Apply repairs through AI Builder only with declared mappings, country provenance and amount policy. Check a later automatic run for all required fields, correct values and continued scheduling; retain the original source-schema alert.

From the repository root, substitute the actual saved files for this run:

```bash
python data-validation/validate.py --scenario schema-combined --source ACTUAL_INPUT.csv --output ACTUAL_OUTPUT.csv --report data-validation/reports/schema-combined.json
```

For missing output and repeated runs, follow the [shared reporting rules](baseline-scheduled.md#validation-and-reporting).
