# Schema drift: add coupon_code

**Submission scope, 3 October 2026:** scheduled drift and later scheduled repair/recovery were not evaluated because the required automatic baseline could not be established. Rhombus advised documenting that blocker and said manual drift results need not be submitted. The manual record below is historical; no further manual case work is planned. See the [scheduler report](scheduler-support-report.md#support-guidance-and-effect-on-the-take-home).

- **Dataset:** [`schema-add-column.csv`](../datasets/schema-add-column.csv)
- **Change:** Add `coupon_code` while preserving the six contracted columns and nine records.
- **Expected:** The run may continue, but the output should retain the six-column contract and five cleaned rows. The new field should be visible as source drift rather than silently added to GCS output.
- **Observed manual run:** 2026-10-02 14:48:06 UTC (3 October 00:48:06 Sydney), task `e4b11aab-78d2-449a-86e1-a22f117c3005`. The same S3 key was overwritten and its downloaded bytes matched the case dataset. The input preview included `coupon_code`, confirming the changed source was read. [Run evidence](evidence/schema-add-column-original.json).
- **Actual GCS export:** `RhombusAI_output_1790952488975.csv`, 320 bytes, five correct rows. The extra source field is omitted as the six-column contract requires. [Downloaded CSV](evidence/schema-add-column-original-output.csv).
- **Logs:** Success, zero warning/error badges. [Transcript](evidence/schema-add-column-original-logs.txt).
- **Data validation:** All six evaluated checks pass; per-case determinism was not evaluated. [Report](evidence/schema-add-column-original-validation.json).
- **Chatbot diagnosis and repair:** Pending diagnosis. No transformation repair is needed for the observed correct output.
- **Severity:** No data defect observed in this manual case.
- **Scheduled behavior:** Unverified; this run was manual while schedules were paused. It does not establish scheduled drift coverage.

To reproduce, establish a scheduled baseline, replace the same S3 source object with this file before the next trigger, refresh source access, and capture the execution and export. Restore the baseline before another case.
