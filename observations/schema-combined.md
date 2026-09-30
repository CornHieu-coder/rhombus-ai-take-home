# Schema drift: combined changes

- **Dataset:** [`schema-combined.csv`](../datasets/schema-combined.csv)
- **Change:** Drop `country`, rename `customer_email` to `contact_email`, change order `1006`'s amount to words, and add `loyalty_tier`.
- **Expected:** The run should surface all material incompatibilities or at least the first blocker precisely. A repair should restore all required mappings and value handling before an export is accepted.
- **Observed run, status, GCS object:** Pending live access.
- **Logs:** Pending. Save the schedule-history CSV and node errors in [`evidence/`](evidence/).
- **Chatbot diagnosis and proposed fix:** Pending. Give the chatbot the exact error, capture each proposed fix, and check whether it addresses more than the first detected issue.
- **Did the fix work?** Pending.
- **Schedule afterward:** Pending.
- **Data validation:** Run `validate.py --scenario schema-combined` against the actual objects or with `--output-missing`; link the report here.

To reproduce, establish a scheduled baseline, replace the same S3 source object with this file before the next trigger, refresh source access, and capture the execution and export. Restore the baseline after this case.
