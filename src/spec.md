# Specification

## Summary
**Goal:** Add a “Print test label” action in the Label Settings preview so users can print exactly what’s currently shown in the preview while adjusting label settings.

**Planned changes:**
- Add a “Print test label” button next to the Label Preview in the Label Settings tab, with English UI text and a clear placement (e.g., preview card header/actions).
- Implement test-print behavior that sends a print job to the currently connected printer using the current Label Settings and the exact preview values at click time (sample serial 1, sample serial 2, and the preview title).
- Show safe error handling when no printer is connected (English toast instructing user to connect a printer in the Devices tab).
- Show printing progress state (disable button and show “Printing…” during submission; re-enable on success/failure).
- Refactor the Label Preview component so LabelSettingsTab can read the preview-critical data (sample serial 1, sample serial 2, and computed preview title) without changing preview behavior.
- Update/extend CPCL generation so the Label Settings test print can print with an explicit title matching the preview title (not dependent on prefix mappings), without breaking existing print flows.

**User-visible outcome:** In Label Settings, users can click “Print test label” beside the preview to print a test label that matches the preview (including sample serials and title), see a printing state while it sends, and get a clear message if no printer is connected.
