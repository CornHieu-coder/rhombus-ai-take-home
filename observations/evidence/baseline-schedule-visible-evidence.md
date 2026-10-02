# Baseline schedule: automatic run reports Success without history or export

This is a transcription of three screenshots supplied in chat on 2 October 2026, followed by the user's confirmation that the 10:04 PM execution was triggered by the schedule. Original screenshot files and a schedule-history export are not archived here.

## Visible state

- The project has an Active schedule configured Hourly, at minute 00. Its enable switch is on and the notification bell is blue.
- The schedule card displays the label `Next run:` without a visible value.
- The schedule-specific execution table displays `No results.` and a zero-record pagination count. No scheduled execution ID, status, completed nodes, or failed node is shown.
- A separate log crop displays `Pipeline execution started.` and `Pipeline execution completed successfully.`, both at 10:04:26 PM. The crop does not identify the trigger, execution date, schedule, or completed transformation nodes.
- The GCS object list shows `RhombusAI_output_1790940577138.csv`, created Oct 2, 2026, at 9:29:38 PM. This time corresponds to the earlier five-row preview run whose displayed logs span 9:29:36 to 9:29:42 PM. An older object is also visible, created Oct 1, 2026, at 9:13:08 PM.
- No object created around 10:04 PM is visible in the supplied GCS listing. The listing's freshness and whether other objects or versions exist have not been established.

## User confirmation

The user explicitly confirmed: "The run is from the schedule. Basically it run a schedule at 10:04pm but showed nothing on the schedule history and gcs output." The trigger type is therefore recorded as scheduled, based on the user's account. The automatic run occurred; the missing results are the issue under investigation.

## Limits and next checks

The schedule creation time, saved timezone, complete execution logs, saved pipeline snapshot, and backend history/export responses have not been collected. GCS absence is supported by the supplied listing and user confirmation, rather than an independent cloud API query. Whether the history is missing in the backend or only in the UI is unknown. The cause of the missing export and Success status is also unknown.

Refresh both listings, inspect the complete execution log and the history request/response, ask the chatbot to diagnose the contradiction, and repeat the automatic run on unchanged baseline input. Preserve this failing result before applying an AI Builder repair. See the [scheduled baseline observation](../baseline-scheduled.md) and [missing-output validator report](baseline-scheduled-output-missing.json).
