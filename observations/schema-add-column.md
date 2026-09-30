# Schema drift: add coupon_code

- **Dataset:** [`schema-add-column.csv`](../datasets/schema-add-column.csv)
- **Change:** Add `coupon_code` while preserving the six contracted columns and nine records.
- **Expected:** The run may continue, but the output should retain the six-column contract and five cleaned rows. The new field should be visible as source drift rather than silently added to GCS output.
- **Observed run, status, GCS object:** Pending live access.
- **Logs:** Pending. Save the schedule-history CSV and relevant logs in [`evidence/`](evidence/).
- **Chatbot diagnosis and proposed fix:** Pending. Ask whether the chatbot notices the new field and whether any proposed adjustment changes output as intended.
- **Did the fix work?** Pending.
- **Schedule afterward:** Pending.
- **Data validation:** Run `validate.py --scenario schema-add-column` against the actual objects and link the JSON report here.

To reproduce, establish a scheduled baseline, replace the same S3 source object with this file before the next trigger, refresh source access, and capture the execution and export. Restore the baseline before another case.
