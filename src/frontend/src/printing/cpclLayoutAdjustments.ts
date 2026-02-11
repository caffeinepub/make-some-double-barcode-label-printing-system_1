/**
 * Shared CPCL layout adjustment utilities for centering and clamping barcodes
 * to prevent left/right clipping on the label.
 */

export interface BarcodeAdjustment {
  originalX: number;
  adjustedX: number;
  barcodeIndex: 1 | 2;
  wasClamped: boolean;
}

/**
 * Calculate the effective barcode X position, centered within label width
 * and clamped to prevent left/right clipping.
 * 
 * @param barcodeWidthDots - Estimated barcode width in dots
 * @param labelWidthDots - Label width in dots
 * @param requestedX - Original X position from settings (dots)
 * @param barcodeIndex - Barcode index (1 or 2) for logging
 * @returns Adjustment metadata with original and adjusted X positions
 */
export function calculateCenteredBarcodeX(
  barcodeWidthDots: number,
  labelWidthDots: number,
  requestedX: number,
  barcodeIndex: 1 | 2
): BarcodeAdjustment {
  // Center the barcode horizontally
  const centeredX = Math.round((labelWidthDots - barcodeWidthDots) / 2);
  
  // Clamp to prevent left/right clipping
  const minX = 0;
  const maxX = Math.max(0, labelWidthDots - barcodeWidthDots);
  const clampedX = Math.max(minX, Math.min(maxX, centeredX));
  
  const wasClamped = clampedX !== centeredX;
  
  return {
    originalX: requestedX,
    adjustedX: clampedX,
    barcodeIndex,
    wasClamped,
  };
}

/**
 * Estimate barcode width in dots based on data length and barcode parameters.
 * This is a rough estimate for layout purposes.
 * 
 * @param dataLength - Length of barcode data string
 * @param narrowBarWidth - CPCL width parameter (narrow bar width in dots)
 * @param ratio - CPCL ratio parameter (wide:narrow ratio encoded as 0=2:1, 1=2.5:1, etc.)
 * @returns Estimated barcode width in dots
 */
export function estimateBarcodeWidthDots(
  dataLength: number,
  narrowBarWidth: number,
  ratio: number
): number {
  // CODE128 typically uses ~11 modules per character + start/stop/checksum overhead
  // Each module is narrowBarWidth dots
  // Ratio affects wide bars (but CODE128 is mostly narrow bars)
  const modulesPerChar = 11;
  const overheadModules = 35; // start + stop + checksum + quiet zones
  const totalModules = (dataLength * modulesPerChar) + overheadModules;
  
  // Conservative estimate: assume average module width
  const avgModuleWidth = narrowBarWidth * (1 + ratio * 0.1);
  return Math.round(totalModules * avgModuleWidth);
}
