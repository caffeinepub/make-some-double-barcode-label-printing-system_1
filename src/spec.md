# Specification

## Summary
**Goal:** Fix barcode alignment in CPCL printouts to match the preview display.

**Planned changes:**
- Adjust CPCL barcode generation parameters to ensure barcodes fit completely within label boundaries
- Calibrate barcode positioning calculations to account for CPCL printer coordinate system
- Review and adjust barcode width estimation logic for CODE128 barcodes
- Update label preview to accurately represent CPCL printer output

**User-visible outcome:** Printed labels match the preview exactly, with barcodes fully visible and properly positioned within label boundaries without any clipping.
