# Specification

## Summary
**Goal:** Make the Scan & Print tab’s two-step serial workflow scanner-only friendly with per-field success feedback, and ensure the app truly auto-prints by sending the generated CPCL to the connected printer after the 2nd valid scan.

**Planned changes:**
- Update the two-step serial inputs to be scanner-only optimized: autofocus the 1st input on entry/reset, suppress on-screen keyboard, and advance focus automatically from 1st to 2nd after a valid scan.
- Add per-input success feedback: on each successful validation, play the existing success sound event and apply a clear green success border directly on the corresponding input.
- After a valid 2nd scan, immediately start auto-print with no extra user action while keeping existing validation blocks (unknown prefix, type mismatch, printer-not-connected) and English error messaging.
- Fix auto-print to actually send the already-generated CPCL payload through the existing printer service transport (CPCL protocol), handling success (printComplete sound, record print history with payload, increment diagnostics, reset to step 1 + autofocus) and failure (error UI state + error sound, no successful record).

**User-visible outcome:** A user can scan serial 1 then serial 2 using only a barcode scanner; each valid scan gives an audible success cue and a green border on the specific field, and after the second valid scan the label is automatically printed via CPCL to the connected printer (or a clear error is shown if printing fails), then the form resets ready for the next item.
