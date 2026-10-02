# Schema drift: drop amount_usd

- **Dataset:** [`schema-drop-column.csv`](../datasets/schema-drop-column.csv)
- **Change:** Remove `amount_usd` while keeping the same nine records.
- **Expected:** The run should reject the incompatible source before export, name the missing column, and keep the schedule enabled for the next trigger. No new GCS output should be mistaken for a successful run.
- **Observed manual run:** 2026-10-02 14:58:40 UTC (3 October 00:58:40 Sydney), task `34b9eeba-503b-4061-8b25-c8bd041b3245`. Actual bytes fetched from the same S3 key match the dataset with no `amount_usd`. HTTP 200 accepted the asynchronous task; it did not establish successful cleaning. [Run evidence](evidence/schema-drop-column-original.json).
- **Worker result:** Failed at `cleaned_orders` with `LLM execution failed ... 'amount_usd'`. No fresh GCS object appeared during the 45-second delivery check.
- **Logs:** At 00:58:46 Sydney, the failure message and a generic `Pipeline execution completed successfully.` message coexist. The expanded error identifies the failed Custom node. [Transcript](evidence/schema-drop-column-original-logs.txt), [screenshot](evidence/schema-drop-column-original-logs.png).
- **Data validation:** Missing required source column and absent output are flagged. Row and cleaning checks are unevaluated because the amount data cannot be reconstructed. The report's `expected_rows=0` is not an expectation that a valid empty export should be produced. [Report](evidence/schema-drop-column-original-validation.json).
- **Evidence limit:** The input preview was not captured before restoring S3 baseline. The fetched source bytes and actual missing-field error establish the source change; no later baseline preview is used as drop-case evidence.
- **Chatbot diagnosis and repair:** Pending. A safe repair can provide a clearer required-schema error; recovering actual amounts requires an upstream data source and must not invent values.
- **Severity:** Medium for the recoverable missing-schema failure; high for contradictory success reporting that can hide a failed delivery.
- **Scheduled behavior:** Unverified. This was a manual run while schedules were paused.

To reproduce, first restore [`baseline.csv`](../datasets/baseline.csv) to the source key and confirm a successful scheduled baseline. Replace that same S3 object with this file before the next trigger, refresh source access in Rhombus, then record the execution ID, trigger time and status. Restore the baseline before another case.
