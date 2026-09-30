# Semantic drift: dollars become cents

- **Dataset:** [`semantic-cents.csv`](../datasets/semantic-cents.csv)
- **Change:** The `amount_usd` header and numeric type stay the same, but values now represent cents. For example, `1995` means USD 19.95.
- **Expected:** A safe pipeline should detect or be told about the unit change; the canonical GCS amount for order `1001` is `19.95`. Treating `1995` as dollars is a semantic failure.
- **Observed run, status, GCS object:** Pending live access.
- **Logs:** Pending. Save logs or the schedule-history CSV in [`evidence/`](evidence/).
- **Chatbot diagnosis and proposed fix:** Pending. Ask the chatbot to interpret the unchanged schema and record whether it identifies the unit shift without being told.
- **Did the fix work?** Pending. If a fix is proposed, apply it through the AI builder and validate the next output.
- **Schedule afterward:** Pending.
- **Data validation:** Run `validate.py --scenario semantic-cents` against the actual objects and link the report here. The oracle divides source amounts by 100 before comparing.

To reproduce, establish a scheduled baseline, replace the same S3 source object with this file before the next trigger, refresh source access, and capture the execution and export. Restore the baseline before another case.
