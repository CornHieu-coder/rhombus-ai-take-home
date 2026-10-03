# Schema drift: drop amount_usd

- **Dataset:** [schema-drop-column.csv](../datasets/schema-drop-column.csv).
- **Change:** Remove `amount_usd`, preserving the nine source rows.
- **Expected contract:** Identify the missing required column and reject the incompatible source before treating an export as valid. Amounts cannot be reconstructed from this dataset; a repair must not invent them.
- **Scheduled coverage:** Not evaluated. The required successful automatic baseline was unavailable, so this case has no assessed scheduled outcome, execution logs, GCS output, chatbot diagnosis or repair, or later scheduled recovery. Severity is not assessed.

This is a prepared case, not a scheduled run result. The [scheduler report](scheduler-support-report.md#support-guidance-and-effect-on-the-take-home) explains the blocker and Rhombus's guidance to document its effect on progress.
