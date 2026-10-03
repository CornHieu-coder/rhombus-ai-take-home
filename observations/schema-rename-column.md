# Schema drift: rename customer_email

- **Dataset:** [schema-rename-column.csv](../datasets/schema-rename-column.csv).
- **Change:** Rename `customer_email` to `email`; values and the nine source rows are unchanged.
- **Expected contract:** Identify the missing required `customer_email` field. Any repair must explicitly map the renamed field and preserve the six-column output contract; silent loss of email data is unacceptable. The unchanged validator flags the source schema as incompatible.
- **Scheduled coverage:** Not evaluated. The required successful automatic baseline was unavailable, so this case has no assessed scheduled outcome, execution logs, GCS output, chatbot diagnosis or repair, or later scheduled recovery. Severity is not assessed.

This is a prepared case, not a scheduled run result. The [scheduler report](scheduler-support-report.md#support-guidance-and-effect-on-the-take-home) explains the blocker and Rhombus's guidance to document its effect on progress.
