# Manual baseline run: execution succeeded, cleaning validation failed

## Scope and provenance

The user supplied the exact AI Builder prompt, confirmed Pipeline mode, and showed a canvas with an Amazon S3 Data Input for `baseline.csv`, a connected Custom transformation (`llm_node_1`), and a Data Output node. The S3 source key was supplied privately; this public record redacts the bucket name. The run shown in the log screenshot started at 9:13:05 PM and completed at 9:13:10 PM (the screenshot does not show a date or execution ID). Its visible log says a Custom code transformation was applied and the pipeline completed successfully. See the [transcribed visible log](evidence/baseline-manual-visible-log.txt).

The user supplied [a new downloaded CSV](evidence/baseline-manual-output-2026-10-01-2113.csv), whose filename timestamp corresponds to 1 October 2026 at about 9:13 PM Australia/Sydney. This makes it consistent with the screenshot, but the exact GCS URI for the new object has not yet been confirmed. The GCS URI supplied earlier ends in `1790836523139.csv` and identifies the *earlier* export. The old and new downloads are byte-for-byte identical (SHA-256 `2c6dfeee49d175de5852c57f2b2977cf6b8175ef886da0228e20bc3d623dd168`).

## Prompt and expected result

The exact user-supplied AI Builder prompt was:

> Using baseline.csv as the input, build a cleaning pipeline that:
>
> - trims whitespace from text fields
> - lowercases customer_email
> - removes duplicate order_id rows, keeping the first occurrence
> - fills missing customer_name with "Unknown"
> - removes rows where order_id or customer_email is missing
> - removes rows where amount_usd is invalid or <= 0
> - removes rows with invalid order_date
> - keeps only countries US, usa, or United States
> - standardizes country to "US"
> - formats amount_usd to 2 decimal places
> - formats order_date as YYYY-MM-DD
> - outputs exactly these columns:
>
> order_id, customer_email, customer_name, amount_usd, order_date, country.

The baseline input has nine rows. The expected cleaned output has five order IDs: `1001`, `1002`, `1006`, `1007`, `1008`.

## Observed result

The [validator report](evidence/baseline-manual-validation.json) fails: actual output has nine rows, expected five. The column names and order match the request, and parseable dates appear in ISO format. The following requested cleaning did not appear in the export:

| Rule | Example in the new output |
| --- | --- |
| Trim and lowercase | ` ALICE@Example.COM ` and ` DAVE@example.com ` remain unchanged. |
| Deduplicate | Both `1002` rows remain. |
| Fill missing name | Order `1006` still has an empty name. |
| Filter invalid rows | `1003` has an empty email, `1004` an empty amount, and `1009` an empty date; all remain. |
| Normalize country | `usa`, `us`, and `United States` remain. |

The export contains float-like amounts such as `42.5`; a CSV cannot establish whether the in-memory float was rounded to two decimals. This baseline has no missing `order_id`, nonpositive amount, or disallowed country, so those branches are not independently tested by this result.

## Interpretation and next checks

**Observed:** Rhombus reported a successful manual execution while the downloaded output failed the cleaning contract. **Unconfirmed:** whether the Custom node produced these rows, the Data Output wrote a different result, or the downloaded file was linked to another object. Inspect the Custom node's output preview and configuration, confirm the new GCS object URI and creation time, then compare it with the downloaded CSV. Ask the chatbot to diagnose this mismatch before applying its fix through the AI Builder. A clean manual rerun is a useful preflight; the take-home still requires a successful *scheduled* run on the unchanged baseline as the reference for drift tests.
