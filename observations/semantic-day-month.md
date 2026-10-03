# Semantic drift: day and month swap

- **Dataset:** [semantic-day-month.csv](../datasets/semantic-day-month.csv).
- **Change:** Keep the `order_date` header and slash-separated string shape, but switch from MM/DD/YYYY to DD/MM/YYYY. Order `1001`'s `05/04/2026` means 5 April 2026.
- **Expected contract:** Interpret the declared date format correctly and produce five cleaned rows. The validator's `semantic-day-month` oracle requires order `1001`'s date to be `2026-04-05`; interpreting it as 4 May fails the cleaning comparison. Ambiguous dates alone do not establish the intended format.
- **Scheduled coverage:** Not evaluated. The required successful automatic baseline was unavailable, so this case has no assessed scheduled outcome, execution logs, GCS output, chatbot diagnosis or repair, or later scheduled recovery. Severity is not assessed.

This is a prepared case, not a scheduled run result. The [scheduler report](scheduler-support-report.md#support-guidance-and-effect-on-the-take-home) explains the blocker and Rhombus's guidance to document its effect on progress.
