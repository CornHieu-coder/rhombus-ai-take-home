# Semantic drift: dollars become cents

- **Dataset:** [semantic-cents.csv](../datasets/semantic-cents.csv).
- **Change:** Keep the `amount_usd` header and numeric shape, but express values in cents. For order `1001`, `1995` means USD `19.95`.
- **Expected contract:** Interpret the declared units correctly and produce five cleaned rows with amounts divided by 100. The validator's `semantic-cents` oracle checks this meaning; treating `1995` as dollars fails the cleaning comparison. The unchanged headers alone do not identify the unit change.
- **Scheduled coverage:** Not evaluated. The required successful automatic baseline was unavailable, so this case has no assessed scheduled outcome, execution logs, GCS output, chatbot diagnosis or repair, or later scheduled recovery. Severity is not assessed.

This is a prepared case, not a scheduled run result. The [scheduler report](scheduler-support-report.md#support-guidance-and-effect-on-the-take-home) explains the blocker and Rhombus's guidance to document its effect on progress.
