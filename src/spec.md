# Specification

## Summary
**Goal:** Add the user-provided app logo to the top-left of the AppShell header, immediately next to the “Make Some Double!!” title, without disrupting existing right-side header controls.

**Planned changes:**
- Add the provided logo image as a static asset under `frontend/public/assets/generated` and reference it via a static path (no backend loading).
- Update the AppShell header layout so the logo and title are grouped on the left, vertically centered, with consistent spacing.
- Ensure the logo is sized appropriately for a tablet header and does not push the existing top-right controls (backend indicator, device controls, lock button) off-screen.
- Add accessibility attributes for the logo (non-empty English alt text such as “Make Some Double” or “App logo”).

**User-visible outcome:** The header shows a properly sized, aligned logo directly next to the “Make Some Double!!” title on the left, while all existing controls remain visible on the right.
