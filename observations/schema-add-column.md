# Schema drift: add coupon_code

- **Dataset:** [schema-add-column.csv](../datasets/schema-add-column.csv).
- **Change:** Add `coupon_code`, preserving the six contracted columns and nine source rows.
- **Expected contract:** Produce five cleaned rows with exactly the six contracted output columns. The extra source field must not appear in the export; the validator records it as an extra source column.
- **Scheduled coverage:** Not evaluated. The required successful automatic baseline was unavailable, so this case has no assessed scheduled outcome, execution logs, GCS output, chatbot diagnosis or repair, or later scheduled recovery. Severity is not assessed.

This is a prepared case, not a scheduled run result. The [scheduler report](scheduler-support-report.md#support-guidance-and-effect-on-the-take-home) explains the blocker and Rhombus's guidance to document its effect on progress.
