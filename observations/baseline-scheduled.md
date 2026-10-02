# Scheduled baseline: Success log without history or GCS output

## Result and severity

**Outcome:** the user confirmed an automatic scheduled execution at 10:04 PM. Rhombus reported successful completion, but the schedule-specific history remained empty and no new GCS output was found. A later repeat showed the same visible symptoms at 10:30:05 PM after the schedule's minute setting changed from 00 to 25. A successful scheduled ETL baseline has not been demonstrated.

**Severity: High, provisional.** The expected data delivery is missing while the platform reports Success, and the execution history does not provide a record to investigate. Backend state and the cause have not yet been independently inspected.

## Setup and reproduction

1. Use the unchanged nine-row `datasets/baseline.csv` at the S3 key configured in the project.
2. Use the connected S3 Data Input → Custom cleaning transformation → GCS Data Output pipeline. The preceding node previews showed the expected five cleaned rows, and a GCS object was created at 9:29:38 PM. That object's CSV bytes have not yet been validated.
3. Enable a recurring schedule. The supplied schedule card shows Hourly at minute 00, Active, with its enable switch on.
4. Allow an automatic execution rather than clicking Run. The user confirmed that the 10:04 PM execution came from the schedule; the screenshot alone does not identify its trigger or execution date.
5. Compare the execution log, schedule history, and GCS object listing. The supplied screenshots show successful completion at 10:04:26 PM, no schedule-history rows, and no object newer than the earlier 9:29 PM export.

6. Edit the existing schedule's minute setting from 00 to 25 and allow the next automatic attempt while retaining the baseline pipeline. The follow-up screenshots show another generic start/Success pair at 10:30:05 PM, an empty history, and the same two earlier GCS objects.

The saved timezone, configuration at the exact trigger, schedule update time, and creation time have not been captured. The second attempt repeats the visible mismatch; its trigger field is inferred from the ongoing automatic-repeat procedure rather than independently retrieved.

## Expected behavior

Run the saved three-node pipeline, write a fresh GCS output with the five expected order IDs (`1001`, `1002`, `1006`, `1007`, `1008`), and create a scheduled execution record. If a node or export fails, report the failure and enough detail to diagnose it. Rhombus [documents that scheduled executions create records and use a captured pipeline configuration](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/).

## Actual behavior and evidence

- The log crop shows both start and successful completion at 10:04:26 PM. It contains no visible transformation or export details; the crop cannot establish whether those nodes ran.
- Schedule History says `No results.` and shows zero records.
- The Active schedule's `Next run:` has no visible value.
- The newest visible GCS object is `RhombusAI_output_1790940577138.csv`, created on 2 October 2026 at 9:29:38 PM. The user confirmed no output appeared for the scheduled execution.
- [Screenshot transcription and user confirmation](evidence/baseline-schedule-visible-evidence.md).
- [Missing-output validator report](evidence/baseline-scheduled-output-missing.json): `passed=false`, `output_exists=false`, `expected_rows=5`, `output_rows=null`. The validator used the repository's baseline source and the explicit `--output-missing` flag; it did not query GCS. Output schema, row count, cleaning rules, and determinism were not evaluated.
- [Repeat screenshot transcription](evidence/baseline-schedule-repeat-visible-evidence.md): minute 25, Success at 10:30:05 PM, no history rows, blank Next run, and no visible new object. The [repeat missing-output report](evidence/baseline-scheduled-repeat-output-missing.json) also fails the output-exists check; row-level output checks remain unevaluated.

## Chatbot diagnosis and repair

Pending. Ask the chatbot why a scheduled run reports Success while neither its history record nor its GCS export appears. Check the saved pipeline/schedule association, execution snapshot, node execution details, and export result before accepting a diagnosis. Apply any repair through the AI Builder and verify on a later automatic run.

## Next checks and limits

The visible symptom has repeated. Inspect complete execution logs and the backend response that supplies schedule history to distinguish an empty backend result from a UI display issue. Ask the chatbot to diagnose both attempts, including which pipeline snapshot and nodes executed and whether the GCS write was attempted. Preserve its exact response, apply any justified repair through the AI Builder, and verify on a later automatic run using unchanged baseline input.

This is an observed delivery/history mismatch with a user-confirmed scheduled trigger. It does not establish which backend component failed, whether the export was skipped or rejected, or why Success was reported. Drift tests have not yet been performed.
