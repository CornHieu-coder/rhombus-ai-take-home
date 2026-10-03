# Schema drift: change amount type

- **Dataset:** [schema-change-type.csv](../datasets/schema-change-type.csv).
- **Change:** Replace order `1006`'s numeric `amount_usd` with `one hundred twenty`; headers and the nine source rows are unchanged.
- **Expected contract:** The invalid-number filter rejects order `1006`, yielding four cleaned rows. The validator flags that newly invalid input separately from output correctness. A repair that supplies a numeric amount requires an explicit new policy or upstream evidence.
- **Scheduled coverage:** Not evaluated. The required successful automatic baseline was unavailable, so this case has no assessed scheduled outcome, execution logs, GCS output, chatbot diagnosis or repair, or later scheduled recovery. Severity is not assessed.

This is a prepared case, not a scheduled run result. The [scheduler report](scheduler-support-report.md#support-guidance-and-effect-on-the-take-home) explains the blocker and Rhombus's guidance to document its effect on progress.
