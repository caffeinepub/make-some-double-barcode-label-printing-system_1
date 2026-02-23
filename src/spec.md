# Specification

## Summary
**Goal:** Fix label layout to prevent text and barcode overlap and ensure complete barcode visibility on 58mm × 43mm labels.

**Planned changes:**
- Adjust CPCL generation logic to properly position text and barcode elements with sufficient spacing
- Ensure barcode fits completely within label boundaries without clipping
- Prevent text elements (prefix, serial number) from overlapping with barcode

**User-visible outcome:** Users can print labels where the text and barcode are clearly separated, fully visible, and the barcode is scannable with standard readers.
