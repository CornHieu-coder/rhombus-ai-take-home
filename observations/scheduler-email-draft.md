# Email draft — not sent

**To:** Rhombus AI take-home contact (address needed)

**Subject:** Take-home blocker: scheduled pipeline has no history or GCS export — project 4266

Hi Rhombus AI team,

I’m testing the scheduled S3 → AI Builder cleaning → GCS pipeline for the take-home. Manual runs work, but I have not been able to verify an automatic delivery.

For project **4266**, I reproduced empty execution history and no fresh GCS object with the original hourly schedule **202** and a newly created schedule **208** using the current three-node graph. During the controlled checks on **2 October 2026, 13:56–14:04 UTC and 14:11–14:17 UTC**, the history API returned HTTP 200 with `total=0`; `last_run_at` stayed null and `next_run_at` stayed in the past. No manual run occurred in those observation windows. Those schedules have since been replaced by **209**, which is currently paused.

The chatbot suggested disabling input sampling. That saved change did not resolve the issue. The chatbot also said it cannot inspect scheduler logs, worker credentials or the executed pipeline snapshot, so its alternative credential explanation remains unverified.

As a control, three manual runs with matching runtime configuration produced actual five-row GCS CSVs that pass the cleaning validator and determinism comparison. The actual S3 baseline bytes also match the repository dataset.

The [documented scheduling failure](https://github.com/CornHieu-coder/rhombus-ai-take-home/blob/main/observations/baseline-scheduled.md) includes reproduction steps, schedule IDs, UTC times, screenshots, API results, GCS observations and the chatbot's attempted repair.

Could you check whether those schedules dispatched jobs, whether workers received them, and why no execution records or export errors are visible? Please also advise whether I should use a different environment or submit clearly labelled manual drift results while this is unresolved. I’m keeping the successful scheduled baseline requirement marked incomplete.

Thank you.

## Attachments for sending

Attach `rhombus-scheduler-evidence-2026-10-03.zip`. It contains the reproduction report, selected schedule/API evidence and screenshots, the chatbot diagnosis, actual baseline source and three manual GCS outputs, and the passing determinism report. Account tokens and cloud keys are excluded.

The project and schedule IDs in the email are enough to start investigation. If support needs your account email or full cloud object URIs, supply those directly in the private email thread.
