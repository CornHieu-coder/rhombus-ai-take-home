# Scheduled baseline: Success log without history or GCS output

## Result and severity

**Outcome:** the user confirmed an automatic scheduled execution at 10:04 PM. Rhombus reported successful completion, but the schedule-specific history remained empty and no new GCS output was found. This run does not satisfy the successful scheduled ETL baseline.

**Severity: High, provisional.** The expected data delivery is missing while the platform reports Success, and the execution history does not provide a record to investigate. Backend state and the cause have not yet been independently inspected.

## Setup and reproduction

1. Use the unchanged nine-row `datasets/baseline.csv` at the S3 key configured in the project.
2. Use the connected S3 Data Input → Custom cleaning transformation → GCS Data Output pipeline. The preceding node previews showed the expected five cleaned rows, and a GCS object was created at 9:29:38 PM. That object's CSV bytes have not yet been validated.
3. Enable a recurring schedule. The supplied schedule card shows Hourly at minute 00, Active, with its enable switch on.
4. Allow an automatic execution rather than clicking Run. The user confirmed that the 10:04 PM execution came from the schedule; the screenshot alone does not identify its trigger or execution date.
5. Compare the execution log, schedule history, and GCS object listing. The supplied screenshots show successful completion at 10:04:26 PM, no schedule-history rows, and no object newer than the earlier 9:29 PM export.

The saved timezone, configuration at the exact trigger, and schedule creation time have not been captured. A repeat is needed to establish reproducibility.

## Expected behavior

Run the saved three-node pipeline, write a fresh GCS output with the five expected order IDs (`1001`, `1002`, `1006`, `1007`, `1008`), and create a scheduled execution record. If a node or export fails, report the failure and enough detail to diagnose it. Rhombus [documents that scheduled executions create records and use a captured pipeline configuration](https://doc.rhombusai.com/docs/getting-started/basic-concepts/scheduling/).

## Actual behavior and evidence

- The log crop shows both start and successful completion at 10:04:26 PM. It contains no visible transformation or export details; the crop cannot establish whether those nodes ran.
- Schedule History says `No results.` and shows zero records.
- The Active schedule's `Next run:` has no visible value.
- The newest visible GCS object is `RhombusAI_output_1790940577138.csv`, created on 2 October 2026 at 9:29:38 PM. The user confirmed no output appeared for the scheduled execution.
- [Screenshot transcription and user confirmation](evidence/baseline-schedule-visible-evidence.md).
- [Missing-output validator report](evidence/baseline-scheduled-output-missing.json): `passed=false`, `output_exists=false`, `expected_rows=5`, `output_rows=null`. The validator used the repository's baseline source and the explicit `--output-missing` flag; it did not query GCS. Output schema, row count, cleaning rules, and determinism were not evaluated.

## Chatbot diagnosis and repair

Pending. Ask the chatbot why a scheduled run reports Success while neither its history record nor its GCS export appears. Check the saved pipeline/schedule association, execution snapshot, node execution details, and export result before accepting a diagnosis. Apply any repair through the AI Builder and verify on a later automatic run.

## Next checks and limits

Refresh both pages to exclude stale views. Inspect the complete execution logs and, if needed, the backend response that supplies schedule history to distinguish an empty backend result from a UI display issue. Keep the baseline input and pipeline configuration unchanged for one repeat scheduled run before applying a repair. Record both the trigger and whether a fresh object appears.

This is an observed delivery/history mismatch with a user-confirmed scheduled trigger. It does not establish which backend component failed, whether the export was skipped or rejected, or why Success was reported. Drift tests have not yet been performed.
