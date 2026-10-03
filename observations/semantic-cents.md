# Semantic drift: amounts are cents

**Result: not run on a schedule.** The required successful automatic baseline was not established. This is a prepared QA case; scheduled behaviour, logs, output, chatbot repair and later recovery were not assessed, and no severity is assigned. The [scheduler report](scheduler-support-report.md) explains the blocker and Rhombus's guidance to document its effect on progress.

## Prepared change and expected result

[semantic-cents.csv](../datasets/semantic-cents.csv) keeps the six headers and nine rows, but multiplies every numeric baseline amount by 100. `not-a-number` remains invalid. For this case the amounts are declared to be cents: order `1001` has `1995`, meaning USD `19.95`.

Correct interpretation yields the same five cleaned orders and USD amounts as the baseline. The unchanged `amount_usd` header and numeric values alone do not establish the new unit. Automatic detection or a warning must be observed, rather than assumed.

With `--scenario semantic-cents`, the validator uses the declared cents meaning and divides numeric source amounts by 100 before comparison. Keeping `1995` dollars for order `1001` fails the cleaning check even if output headers and five-row count are correct. This checks meaning, not whether Rhombus detected the change.

## How to repeat after a successful scheduled baseline

Follow the [shared scheduled-check procedure](baseline-scheduled.md#shared-procedure-for-a-future-drift-check) for the baseline prerequisite, evidence capture and restoration. This case has not been executed.

1. Replace that same S3 object with `semantic-cents.csv` and confirm the uploaded bytes. Keep the selected source and pipeline unchanged for this first automatic check. Keep the baseline USD interpretation for the first check so its response to the unit change can be assessed.
2. Ask the chatbot to explain the actual result and save its reasoning. Record which unit information it received; do not claim it inferred cents from headers alone. If it proposes a repair, declare cents explicitly, apply it through AI Builder, and validate a later automatic output and continued scheduling.

From the repository root, substitute the actual saved files for this run:

```bash
python data-validation/validate.py --scenario semantic-cents --source ACTUAL_INPUT.csv --output ACTUAL_OUTPUT.csv --report data-validation/reports/semantic-cents.json
```

For missing output and repeated runs, follow the [shared reporting rules](baseline-scheduled.md#validation-and-reporting).
