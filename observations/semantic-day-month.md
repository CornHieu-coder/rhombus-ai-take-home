# Semantic drift: day and month swap

- **Dataset:** [`semantic-day-month.csv`](../datasets/semantic-day-month.csv)
- **Change:** The `order_date` header and slash-separated string shape stay the same, but dates change from MM/DD/YYYY to DD/MM/YYYY. `05/04/2026` means 5 April, not 4 May.
- **Expected:** A safe pipeline should detect ambiguity or flag the format change. The canonical GCS date for order `1001` remains `2026-04-05`.
- **Observed run, status, GCS object:** Pending live access.
- **Logs:** Pending. Save logs or the schedule-history CSV in [`evidence/`](evidence/).
- **Chatbot diagnosis and proposed fix:** Pending. Ask the chatbot to inspect the result without first revealing the new date convention; then capture its proposed fix.
- **Did the fix work?** Pending. Apply any fix through the AI builder and validate the next output.
- **Schedule afterward:** Pending.
- **Data validation:** Run `validate.py --scenario semantic-day-month` against the actual objects and link the report here. The oracle interprets the source as DD/MM/YYYY.

To reproduce, establish a scheduled baseline, replace the same S3 source object with this file before the next trigger, refresh source access, and capture the execution and export. Restore the baseline after this case.
