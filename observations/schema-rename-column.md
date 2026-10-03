# Schema drift: rename customer_email

**Submission scope, 3 October 2026:** this scheduled case and its chatbot repair/recovery were not run because the required automatic baseline could not be established. Rhombus advised documenting that blocker and said manual drift results need not be submitted. The procedure below is an unexecuted plan, not observed behavior. See the [scheduler report](scheduler-support-report.md#support-guidance-and-effect-on-the-take-home).

- **Dataset:** [`schema-rename-column.csv`](../datasets/schema-rename-column.csv)
- **Change:** Rename `customer_email` to `email`; values and row count are unchanged.
- **Expected:** A pipeline bound to `customer_email` should identify the missing field or explicitly map the new name. Silent loss or an empty export would fail the data contract.
- **Observed run, status, GCS object:** Not run; blocked by the missing successful automatic baseline.
- **Logs:** Pending. Save the schedule-history CSV and node error in [`evidence/`](evidence/).
- **Chatbot diagnosis and proposed fix:** Pending. Supply the exact error, then ask the AI builder to repair the mapping.
- **Did the fix work?** Pending.
- **Schedule afterward:** Pending. Check the next scheduled execution after applying the fix.
- **Data validation:** Run `validate.py --scenario schema-rename-column` against the actual objects or with `--output-missing`; link the report here.

To reproduce, establish a scheduled baseline, replace the same S3 source object with this file, refresh source access, and inspect the next scheduled run. Restore the baseline before another case.
