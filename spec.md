# Specification

## Summary
**Goal:** Persist all label settings and prefix mappings locally, auto-reconnect to the last USB printer on app open, and detect duplicate serial numbers in the two-step scan workflow.

**Planned changes:**
- Add Zustand `persist` middleware to `labelSettingsStore.ts` so all label settings (barcode positions, dimensions, font sizes, etc.) and prefix-to-label-type mappings are saved to localStorage and rehydrated on app open.
- On successful USB printer connection, save the printer's vendor ID, product ID, and identifying info to localStorage; on app open, automatically attempt to reconnect using stored details and reflect the result in the existing printer status badge.
- In the ScanPrintTab two-step scan workflow, after the 2nd serial is scanned, compare it (via `serialNormalization.ts`) to the 1st serial; if identical, show an inline error message, play the existing error sound from `soundSystem.ts`, block printing, and clear the 2nd serial field.

**User-visible outcome:** Settings and prefix mappings survive page reloads, the printer reconnects automatically on app open, and scanning a duplicate serial number in the two-step workflow triggers an error message and sound instead of printing.
