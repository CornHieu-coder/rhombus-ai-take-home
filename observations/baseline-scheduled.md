# Scheduled baseline

**A successful automatic baseline was not established.** The [scheduler report](scheduler-support-report.md) is the canonical record of the observation windows, chatbot attempt, support guidance and blocker. [Manual baseline validation](baseline-manual.md) is separate evidence.

This page preserves the earlier report URL and gives the shared procedure for future scheduled checks. **The procedure below was not completed.** Rhombus advised documenting the blocker; this is not a request for more manual drift work before submission.

## Shared procedure for a future drift check

1. Start from a working scheduled baseline. Confirm that the normal baseline file produces a scheduled execution and a valid new GCS output.
2. Replace the baseline CSV in the same S3 location with one drift-case file. Do not change the pipeline yet. Wait for the next automatic scheduled run; do not click Run manually.
3. Record what happened: execution status, logs, schedule history and any new GCS output. Validate the actual output file against the drift case.
4. Give the chatbot the real error or result and save its response. If it suggests a fix, apply it through AI Builder and check a later scheduled run to see whether the output is correct and scheduling still works.
5. Restore the original baseline file and pipeline settings before testing the next drift case, and confirm that the scheduled baseline works again.

## Validation and reporting

Each case supplies its own expected result and command. A failed cloud listing or download does not establish that output is absent. Use `--output-missing` only for absence observed within a recorded window; the flag records that observation and does not query GCS.

A passing CSV comparison alone does not identify the trigger as automatic. Keep the execution record and associated object evidence with it. Determinism validation is required and can compare at least two outputs using the same input and configuration: supply at least one `--repeat-output` argument. Two repeat arguments provide stronger optional three-run evidence; three runs are not the minimum requirement. Report checks left unevaluated separately from failures.
