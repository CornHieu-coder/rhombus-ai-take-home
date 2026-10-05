# Schema drift: change amount to words

**Result: not run on a schedule.** The required successful automatic baseline was not established. This is a prepared QA case; scheduled behaviour, logs, output, chatbot repair and later recovery were not assessed, and no severity is assigned. The [scheduler report](scheduler-support-report.md) explains the blocker and Rhombus's guidance to document its effect on progress.

## Prepared change and expected result

[schema-change-type.csv](../datasets/schema-change-type.csv) changes order `1006` from `amount_usd=120.00` to `one hundred twenty`. The six headers, nine rows and all other cells are unchanged.

The requested invalid-number filter rejects order `1006`, leaving four cleaned orders: `1001, 1002, 1007, 1008`. A clear rejection message would explain the lost row; whether Rhombus provides one is a product observation to collect.

With `--scenario schema-change-type`, a correct four-row export can pass output schema, row count and cleaning checks while the overall report fails. `new_invalid_values` flags newly rejected order `1006`; that is an input-quality alert, not evidence that correct filtering produced bad output. Recovering the row requires upstream numeric data or an explicitly changed rule for parsing words.

## How to repeat after a successful scheduled baseline

Follow the [shared scheduled-check procedure](baseline-scheduled.md#shared-procedure-for-a-future-drift-check) for the baseline prerequisite, evidence capture and restoration. This case has not been executed.

1. Replace that same S3 object with `schema-change-type.csv` and confirm the uploaded bytes. Keep the selected source and pipeline unchanged for this first automatic check.
2. Ask the chatbot to explain the rejection and any warning or lack of warning. Save its reply. If a repair is proposed, record its data source or changed amount policy, apply it through AI Builder, and assess a later automatic export against that declared policy. Record whether scheduling continues.

From the repository root, substitute the actual saved files for this run:

```bash
python data-validation/validate.py --scenario schema-change-type --source ACTUAL_INPUT.csv --output ACTUAL_OUTPUT.csv --report data-validation/reports/schema-change-type.json
```

For missing output and repeated runs, follow the [shared reporting rules](baseline-scheduled.md#validation-and-reporting).


## Local review addendum: controlled type fixture, 5 October 2026

The original file and the prepared original expectation above are preserved. Its baseline already contains `not-a-number` for order `1004`: default `pandas.read_csv` in pandas 3.0.0 infers `amount_usd` as `str` in both the original baseline and original type variant. This original case tests a newly invalid value, not a numeric-to-string column dtype transition.

A separate [controlled numeric baseline](../datasets/controlled-schema-baseline.csv) changes only order `1004`'s invalid amount to synthetic `64.00`. Its [controlled type variant](../datasets/controlled-schema-change-type.csv) changes only order `1006` from `120.00` to `one hundred twenty`. Local pandas inference was `float64` for the controlled baseline and `str` for the type variant. This verifies a local parser dtype transition; it is not evidence of Rhombus ingestion or scheduled behaviour.

Under the existing cleaning rules, this controlled baseline would retain six orders and the controlled type variant would retain five (`1001, 1002, 1004, 1007, 1008`). These expectations belong to the new family and do not replace the original four-row expectation above. The files are prepared only: no upload, automatic run, export, chatbot repair or recovery was performed. A future assessment first needs a successful automatic baseline from the controlled family.

The [dataset family guide](../datasets/README.md) explains provenance, consistent individual/combined variants, the optional pandas dependency and the local reproduction command. The existing validator scenario labels still refer to the original family; the new fixture tests do not claim an actual pipeline result.
