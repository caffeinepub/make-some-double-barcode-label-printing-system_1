# Specification

## Summary
**Goal:** Add a barcode width input field to the Label Settings tab so users can control barcode width when printing labels.

**Planned changes:**
- Add a barcode width input control to the Label Settings tab UI, consistent with existing dot-based units
- Wire the input to read from and write to `labelSettingsStore`, with persistence via localStorage
- Validate the barcode width value through the existing `barcodeSettingsValidation` utility and display errors on invalid input
- Update the `LabelPreview` component to reflect barcode width changes in real time
- Include barcode width in label settings JSON import/export serialization
- Update the CPCL generator to use the stored barcode width value when generating print commands

**User-visible outcome:** Users can set a custom barcode width in the Label Settings tab, see it reflected immediately in the label preview, and have it applied when generating CPCL print commands.
