# Specification

## Summary
**Goal:** Let users choose the sound effect used for each existing sound event (success scan, error scan, print complete) independently.

**Planned changes:**
- Update the settings UI to provide separate sound selection controls for: success scan, error scan, and print complete.
- Persist and load per-event sound selections so each event plays its chosen sound.
- Ensure no new sound event types are introduced and sound playback remains internal (no external audio libraries).

**User-visible outcome:** In settings, users can assign different sounds to success scans, error scans, and print completion, and the app will play the selected sound for each event.
