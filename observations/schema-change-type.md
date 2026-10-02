# Schema drift: change amount type

- **Dataset:** [`schema-change-type.csv`](../datasets/schema-change-type.csv)
- **Change:** Order `1006` has `amount_usd=one hundred twenty` instead of a numeric value. The header is unchanged.
- **Expected:** The run should flag a new invalid numeric value and explain whether that row was rejected or the run stopped. A four-row export without a clear data-quality signal is a loss of an otherwise valid baseline order.
- **Observed manual run:** 2026-10-02 14:56:40 UTC (3 October 00:56:40 Sydney), task `1bdee0c7-6626-420d-92a8-5b02d22d3158`. Actual bytes fetched from the overwritten S3 key match the case dataset. [Run evidence](evidence/schema-change-type-original.json).
- **Actual GCS export:** `RhombusAI_output_1790953002422.csv`, 269 bytes, four rows. Order `1006` is rejected because its amount is words. [Downloaded CSV](evidence/schema-change-type-original-output.csv).
- **Data validation:** Output schema, row count and every cleaning rule pass. Overall `passed=false` comes only from `new_invalid_values`, which identifies newly rejected order `1006`. This is an input-quality alert; the four-row output correctly follows the requested invalid-number filter. [Report](evidence/schema-change-type-original-validation.json).
- **Logs:** Success and an impact count of five affected rows; zero warning/error badges and no explicit invalid-amount rejection explanation. [Transcript](evidence/schema-change-type-original-logs.txt).
- **Chatbot diagnosis and repair:** Pending diagnosis. Inferring a replacement numeric amount would change the original cleaning contract; a repair must declare that new policy explicitly.
- **Severity:** Low observability gap; no incorrect cleaning observed. The validator makes the new input rejection visible.
- **Scheduled behavior:** Unverified. This was a manual run while schedules were paused.

To reproduce, establish a scheduled baseline, replace the same S3 source object with this file before the next trigger, refresh source access, and capture the execution and export. Restore the baseline before another case.
