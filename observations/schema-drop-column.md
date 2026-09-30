# Schema drift: drop amount_usd

- **Dataset:** [`schema-drop-column.csv`](../datasets/schema-drop-column.csv)
- **Change:** Remove `amount_usd` while keeping the same nine records.
- **Expected:** The run should reject the incompatible source before export, name the missing column, and keep the schedule enabled for the next trigger. No new GCS output should be mistaken for a successful run.
- **Observed run, status, GCS object:** Pending live access.
- **Logs:** Pending. Save the schedule-history CSV and relevant node error in [`evidence/`](evidence/).
- **Chatbot diagnosis and proposed fix:** Pending. Paste the exact error into the chatbot, record its response, apply the suggested fix through the AI builder, and rerun.
- **Did the fix work?** Pending.
- **Schedule afterward:** Pending. Check whether the next trigger occurs and whether it uses the corrected pipeline.
- **Data validation:** Run `validate.py --scenario schema-drop-column` with the actual S3 and GCS objects, or `--output-missing` if no export occurred. Link the JSON report here.

To reproduce, first restore [`baseline.csv`](../datasets/baseline.csv) to the source key and confirm a successful scheduled baseline. Replace that same S3 object with this file before the next trigger, refresh source access in Rhombus, then record the execution ID, trigger time and status. Restore the baseline before another case.
