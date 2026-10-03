# Scheduled baseline

**A successful automatic baseline was not established.** The [scheduler report](scheduler-support-report.md) is the canonical record of the observation windows, chatbot attempt, support guidance and blocker. [Manual baseline validation](baseline-manual.md) is separate evidence.

This page preserves the earlier report URL and gives the shared procedure for future scheduled checks. **The procedure below was not completed.** Rhombus advised documenting the blocker; this is not a request for more manual drift work before submission.

## Shared procedure for a future drift check

1. Use a dedicated test project and schedule. Preserve the original source bytes, pipeline settings and existing schedule states. Before changing data, establish a successful automatic baseline: a scheduled execution record and a fresh GCS file that passes validation.
2. Upload one case file to the **same S3 object key already selected by the pipeline**, confirming its bytes. Keep the selected source and pipeline unchanged for the first check. Allow the automatic trigger without clicking Run.
3. Record the observation window, execution ID, trigger time, status, node logs and schedule-history CSV when available. Independently refresh GCS and save the actual input and any new output. Run the case's validation command against those files.
4. Give the chatbot the captured result and save its exact advice. Each case explains the information a repair needs. Apply any repair through AI Builder, record the saved changes, then assess a later automatic run for correct output and continued scheduling.
5. Restore the preserved baseline bytes and settings before another case and verify another automatic baseline. When finished, restore the original schedules' prior states.

## Validation and reporting

Each case supplies its own expected result and command. A failed cloud listing or download does not establish that output is absent. Use `--output-missing` only for absence observed within a recorded window; the flag records that observation and does not query GCS.

A passing CSV comparison alone does not identify the trigger as automatic. Keep the execution record and associated object evidence with it. To check repeat consistency, add two `--repeat-output` arguments for later runs using the same input and configuration. Report checks left unevaluated separately from failures.
