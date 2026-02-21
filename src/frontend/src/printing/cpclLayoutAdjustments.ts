/**
 * Shared CPCL layout adjustment utilities for clamping barcodes
 * to prevent left/right clipping on the label.
 */

import { addLog } from '../state/logStore';

export interface BarcodeAdjustment {
  originalX: number;
  adjustedX: number;
  barcodeIndex: 1 | 2;
  wasClamped: boolean;
}

/**
 * Clamp barcode X position to prevent left/right clipping.
 * The requestedX is the left edge position of the barcode in dots.
 * 
 * @param barcodeWidthDots - Estimated barcode width in dots
 * @param labelWidthDots - Label width in dots
 * @param requestedX - Left edge X position from settings (dots)
 * @param barcodeIndex - Barcode index (1 or 2) for logging
 * @returns Adjustment metadata with original and adjusted X positions
 */
export function calculateLeftAlignedBarcodeX(
  barcodeWidthDots: number,
  labelWidthDots: number,
  requestedX: number,
  barcodeIndex: 1 | 2
): BarcodeAdjustment {
  // Define minimum margins (in dots) to prevent edge clipping
  const minMargin = 5; // ~0.6mm at 203 DPI - reduced for tighter fit
  
  // Clamp to ensure barcode stays within safe printable area
  const minX = minMargin;
  const maxX = Math.max(minMargin, labelWidthDots - barcodeWidthDots - minMargin);
  const clampedX = Math.max(minX, Math.min(maxX, requestedX));
  
  const wasClamped = Math.abs(clampedX - requestedX) > 0.5;
  
  if (wasClamped) {
    addLog(
      'warn',
      `Barcode ${barcodeIndex} X clamped to prevent clipping: ${Math.round(requestedX)} → ${Math.round(clampedX)} dots`,
      {
        category: 'barcode',
        barcodeIndex,
        reasonCode: 'POSITION_CLAMPED',
        requestedX,
        clampedX,
        estimatedWidth: barcodeWidthDots,
        labelWidth: labelWidthDots,
        minMargin,
      }
    );
  }
  
  return {
    originalX: requestedX,
    adjustedX: Math.round(clampedX),
    barcodeIndex,
    wasClamped,
  };
}

/**
 * Estimate barcode width in dots based on data length and CPCL parameters.
 * This is a conservative estimate used for clipping prevention.
 * 
 * For CODE128 with width=2, ratio=1:
 * - Each character: ~11 modules
 * - Start/Stop: 6 modules each
 * - Check digit: 11 modules
 * - Quiet zones: 10 modules each side
 * - Module width: 2 dots (narrow bar)
 * 
 * @param dataLength - Length of barcode data string
 * @param width - CPCL width parameter (narrow bar width in dots)
 * @param ratio - CPCL ratio parameter (wide:narrow bar ratio, encoded as integer)
 * @returns Estimated barcode width in dots
 */
export function estimateBarcodeWidthDots(
  dataLength: number,
  width: number,
  ratio: number
): number {
  // CODE128 structure:
  // - Start character: 11 modules
  // - Data characters: 11 modules each
  // - Check digit: 11 modules
  // - Stop character: 13 modules (11 + 2 for termination bar)
  // - Quiet zones: 10 modules on each side
  
  const startModules = 11;
  const dataModules = dataLength * 11;
  const checkModules = 11;
  const stopModules = 13;
  const quietZoneModules = 20; // 10 on each side
  
  const totalModules = startModules + dataModules + checkModules + stopModules + quietZoneModules;
  
  // Each module is `width` dots (narrow bar width)
  // CPCL ratio parameter: 0=2:1, 1=2.5:1, 2=3:1
  // For ratio=1 (2.5:1), wide bars are 2.5x narrow bars
  // Average module width considering mix of narrow and wide bars
  const ratioMultiplier = 2.0 + (ratio * 0.5); // 0→2.0, 1→2.5, 2→3.0
  const avgModuleWidth = width * (1 + ratioMultiplier) / 2;
  
  return Math.ceil(totalModules * avgModuleWidth);
}
