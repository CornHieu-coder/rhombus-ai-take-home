# Email draft — not sent

**To:** Rhombus AI take-home contact (address needed)

**Subject:** Take-home blocker: scheduled pipeline has no history or GCS export — project 4266

Hi Rhombus AI team,

I’m testing the scheduled S3 → AI Builder cleaning → GCS pipeline for the take-home. Manual runs work, but I have not been able to verify an automatic delivery.

For project **4266**, I reproduced empty execution history and no fresh GCS object with the original hourly schedule **202** and a newly created schedule **208** using the current three-node graph. During the controlled checks on **2 October 2026, 13:56–14:04 UTC and 14:11–14:17 UTC**, the history API returned HTTP 200 with `total=0`; `last_run_at` stayed null and `next_run_at` stayed in the past. No manual run occurred in those observation windows. Those schedules have since been replaced by **209**, which is currently paused.

The chatbot suggested disabling input sampling. That saved change did not resolve the issue. The chatbot also said it cannot inspect scheduler logs, worker credentials or the executed pipeline snapshot, so its alternative credential explanation remains unverified.

As a control, three manual runs with matching runtime configuration produced actual five-row GCS CSVs that pass the cleaning validator and determinism comparison. The actual S3 baseline bytes also match the repository dataset.

The [scheduler support report](https://github.com/CornHieu-coder/rhombus-ai-take-home/blob/main/observations/scheduler-support-report.md) includes reproduction steps, project and schedule IDs, UTC observation windows, links to the evidence, and specific questions for investigating the scheduler and workers.

Could you check whether those schedules dispatched jobs, whether workers received them, and why no execution records or export errors are visible? Please also advise whether I should use a different environment or submit clearly labelled manual drift results while this is unresolved. I’m keeping the successful scheduled baseline requirement marked incomplete.

Thank you.

## Evidence for the first email

Use the direct support-report link already included in the email. It gives the project and schedule IDs, UTC windows, reproduction steps and questions for backend investigation, with links to supporting evidence.

Optionally attach the [empty-history screenshot](https://raw.githubusercontent.com/CornHieu-coder/rhombus-ai-take-home/main/observations/evidence/baseline-schedule-edited-repeat-2026-10-02.png). The full 15-file ZIP can be offered if they request the raw evidence; it is not needed as an initial attachment.

The project and schedule IDs in the email are enough to start investigation. If support needs your account email or full cloud object URIs, supply those directly in the private email thread.
