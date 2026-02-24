# Specification

## Summary
**Goal:** Fix barcode clipping on printed labels, add a user-adjustable barcode width setting, and enforce unique serial validation in the two-step scan workflow.

**Planned changes:**
- Recalculate default barcode width in the CPCL generator to fit within the label's printable area (label width minus left/right margins), preventing barcodes from being clipped at either edge
- Add a "Barcode Width" numeric input in the Label Settings tab, persisted in the label settings store and applied in the CPCL generator and label preview
- Include the barcode width setting in settings import/export
- In the scan-print workflow, when the 2nd barcode is scanned, compare its normalized serial against the 1st; if they match, show an error message, play the existing error sound, clear the 2nd input, and block printing

**User-visible outcome:** Barcodes print fully within label boundaries without clipping; users can fine-tune barcode width from Label Settings; scanning the same serial twice in the two-step flow triggers an audible error and prevents printing.
