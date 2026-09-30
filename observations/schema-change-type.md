# Schema drift: change amount type

- **Dataset:** [`schema-change-type.csv`](../datasets/schema-change-type.csv)
- **Change:** Order `1006` has `amount_usd=one hundred twenty` instead of a numeric value. The header is unchanged.
- **Expected:** The run should flag a new invalid numeric value and explain whether that row was rejected or the run stopped. A four-row export without a clear data-quality signal is a loss of an otherwise valid baseline order.
- **Observed run, status, GCS object:** Pending live access.
- **Logs:** Pending. Save the schedule-history CSV and node error in [`evidence/`](evidence/).
- **Chatbot diagnosis and proposed fix:** Pending. Submit the exact error and ask the chatbot to preserve the intended numeric value through the AI builder.
- **Did the fix work?** Pending.
- **Schedule afterward:** Pending.
- **Data validation:** Run `validate.py --scenario schema-change-type` against the actual objects or with `--output-missing`; link the report here. Its `new_invalid_values` check should identify `1006`.

To reproduce, establish a scheduled baseline, replace the same S3 source object with this file before the next trigger, refresh source access, and capture the execution and export. Restore the baseline before another case.
