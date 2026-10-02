# Evidence handling

Place redacted screenshots, exported schedule-history CSV files, log excerpts, and validator JSON reports here. Name each file with the scenario and execution ID. Keep credentials, service-account keys, access tokens, personal data, and raw HAR files out of git.

The manual baseline run has a downloaded output CSV, a validator report, and a transcription of the visible log screenshot. The screenshot itself was supplied in chat and is not yet archived here; it should be cropped to remove the visible account email before publication. The user confirmed the new GCS object URI; its bucket name is redacted in the public observation. The object bytes have not been independently fetched from GCS.

The later [preview and log transcription](baseline-follow-up-visible-evidence.md) records matching five-row Custom and Data Output previews. It is screenshot-derived evidence, not an exported dataset or a validator pass. Validation of the fresh GCS output and a scheduled baseline run remain pending.

The [schedule follow-up](baseline-schedule-visible-evidence.md) records an Active hourly schedule, an empty schedule-specific history, a blank Next run value, a 10:04 PM Success log, and the GCS object's earlier 9:29 PM creation time. The user confirmed that the 10:04 PM run was automatic and that no history entry or new export appeared. The [validator report](baseline-scheduled-output-missing.json) records the missing output using the explicit `--output-missing` flag and the local baseline source; it did not independently query GCS.
