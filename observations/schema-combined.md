# Schema drift: combined changes

- **Dataset:** [schema-combined.csv](../datasets/schema-combined.csv).
- **Change:** Drop `country`, rename `customer_email` to `contact_email`, change order `1006`'s amount to words, and add `loyalty_tier`. The source retains nine rows.
- **Expected contract:** Identify the missing required `country` and `customer_email` fields. The validator flags the incompatible schema and cannot compute valid cleaned rows from it. A repair must define the missing-field mappings and invalid-amount policy before an export can be accepted.
- **Scheduled coverage:** Not evaluated. The required successful automatic baseline was unavailable, so this case has no assessed scheduled outcome, execution logs, GCS output, chatbot diagnosis or repair, or later scheduled recovery. Severity is not assessed.

This is a prepared case, not a scheduled run result. The [scheduler report](scheduler-support-report.md#support-guidance-and-effect-on-the-take-home) explains the blocker and Rhombus's guidance to document its effect on progress.
