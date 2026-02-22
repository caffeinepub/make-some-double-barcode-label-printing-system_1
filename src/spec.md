# Specification

## Summary
**Goal:** Fix label dimensions to 58mm × 43mm, adjust barcode width for proper scanning, and improve scan validation with automatic error recovery.

**Planned changes:**
- Update label dimensions to 58mm width × 43mm height in label settings and CPCL generation
- Adjust barcode width parameters to ensure both barcodes fit within 58mm label width and match reference photo layout
- Add automatic input clearing after incorrect barcode prefix detection
- Implement duplicate serial number detection with error message

**User-visible outcome:** Labels print at correct 58mm × 43mm dimensions with full-width scannable barcodes matching reference photos, and scanning errors automatically clear the input for immediate retry. Duplicate serial scans are detected and prevented.
