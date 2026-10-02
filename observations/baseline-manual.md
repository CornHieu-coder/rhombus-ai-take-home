# Manual baseline: failed export followed by a validated corrected CSV

## Scope and provenance

The user supplied the exact AI Builder prompt, confirmed Pipeline mode, and showed a canvas with an Amazon S3 Data Input for `baseline.csv`, a connected Custom transformation (`llm_node_1`), and a Data Output node. The S3 source key was supplied privately; this public record redacts the bucket name. The run shown in the log screenshot started at 9:13:05 PM and completed at 9:13:10 PM (the screenshot does not show a date or execution ID). Its visible log says a Custom code transformation was applied and the pipeline completed successfully. See the [transcribed visible log](evidence/baseline-manual-visible-log.txt).

The user supplied [a new downloaded CSV](evidence/baseline-manual-output-2026-10-01-2113.csv), whose filename timestamp corresponds to 1 October 2026 at about 9:13 PM Australia/Sydney. The user subsequently confirmed that the new GCS object URI ends in `RhombusAI_output_1790853187148.csv` (bucket name redacted), matching the download and the visible run time. The GCS URI supplied earlier ends in `1790836523139.csv` and identifies the *earlier* export. The old and new downloads are byte-for-byte identical (SHA-256 `2c6dfeee49d175de5852c57f2b2977cf6b8175ef886da0228e20bc3d623dd168`). The GCS object's bytes have not been independently fetched for checksum comparison.

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

## Follow-up node inspection

The user subsequently supplied screenshots of the Custom and Data Output previews, each still showing the same nine uncleaned rows. This places the visible mismatch at the Custom node rather than only in the downloaded export. The supplied Edit Code excerpt starts with `df = input_df_1.copy()` and ends after country standardization; it does not include the final three requested steps or an assignment to `output_df`. The excerpt may be incomplete, so it does not establish that those lines are absent from the full generated code.

In a later screenshot follow-up received on 2 October 2026, both node previews show the expected five rows, lowercase emails, `Unknown` for order `1006`, all countries `US`, and ISO date strings. Visible logs show execution start at 9:29:36 PM and successful completion at 9:29:42 PM. The screenshot does not establish the execution date, timezone, ID, or trigger type. See the [transcribed follow-up evidence](evidence/baseline-follow-up-visible-evidence.md).

The follow-up log still visibly begins with `input_df_1.copy()`. Although [the Custom node documentation](https://doc.rhombusai.com/docs/transformer-references/custom-nodes/llm-transform/) names `input_df` as the primary input, the screenshots do not establish that the different variable name caused the earlier mismatch. Later authenticated inspection confirms the saved code includes all 12 steps, begins with `input_df_1.copy()`, and assigns the six requested columns to `output_df`. This establishes the current saved code, not the cause of the original failure.

## Corrected manual export validation

On 2 October 2026, the user supplied the actual 320-byte download `RhombusAI_output_1790940577138.csv`. Its filename and size match the previously shown GCS object created at 9:29:38 PM. The [archived original bytes](evidence/baseline-manual-corrected-output-2026-10-02-2129.csv) have SHA-256 `89cdb162f7d43e9f21ce0a8ae077295575837aa7d46580e8bc067940ab2b63bb`. The GCS checksum was not independently queried.

The [corrected validation report](evidence/baseline-manual-corrected-validation.json) passes all six evaluated checks against the repository baseline: source schema, newly invalid values, output existence, exact output schema, five-row count and cleaning rules. It contains the expected IDs `1001`, `1002`, `1006`, `1007`, `1008`, lowercase emails, `Unknown` for the missing name, ISO dates and country `US`. Determinism is unevaluated because only one corrected output was supplied. Rules for missing order IDs, nonpositive amounts, excluded countries and rounding values with extra precision are not independently exercised by this nine-row source.

The first validator run incorrectly rejected float CSV representations such as `42.5` versus `42.50`. The validator now compares exact numeric values while preserving text and schema checks; it does not round the output before comparison. Regression tests first reproduced the false failure, then passed after the fix. Tests also reject `42.51`, `42.501`, invalid amounts and nonfinite values, and verify that the prompt imposes no USD 500 cap. All 12 validator unit tests pass. Rechecking the earlier nine-row output still fails the row count and cleaning rules.

## Schedule creation follow-up

The user showed an Active Hourly schedule at minute 00, with an enabled switch. Its history table is empty and its `Next run` field has no visible value. A separate log reports execution start and success at 10:04:26 PM, but does not link that execution to the schedule. The supplied GCS listing contains `RhombusAI_output_1790940577138.csv`, created on 2 October 2026 at 9:29:38 PM; that timestamp matches the earlier five-row preview run. No later export is visible in the screenshot. See the [schedule and object-list transcription](evidence/baseline-schedule-visible-evidence.md).

The user subsequently confirmed that the 10:04 PM execution came from the schedule and that neither a history record nor a GCS output appeared. The scheduled trigger is user-confirmed; subsequent authenticated API inspection confirms zero history records. The cause remains unverified. This is tracked in the [scheduled baseline observation](baseline-scheduled.md).

## Interpretation and next checks

**Observed:** the earlier exported CSV failed validation despite execution Success; the corrected manual CSV passes all evaluated baseline checks. A later user-confirmed scheduled execution reported Success without a history record or new GCS output. **Pending:** a verified scheduled delivery, repeat determinism, and drift runs. The chatbot exchange and subsequent schedule API polling are preserved in the [scheduled observation](baseline-scheduled.md); disabling sampling did not restore history within that bounded observation window.
