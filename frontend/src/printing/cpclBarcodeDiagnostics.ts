/**
 * Barcode validation and diagnostic logging utilities
 */

import { addLog } from '../state/logStore';

/**
 * Validate barcode data for common issues
 */
export function validateBarcodeData(
  data: string,
  barcodeType: string,
  barcodeIndex: 1 | 2
): void {
  if (!data || data.length === 0) {
    addLog('error', `Barcode ${barcodeIndex} has empty data`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'EMPTY_DATA',
    });
    return;
  }

  // Check for invalid characters (control characters, etc.)
  const hasInvalidChars = /[\x00-\x1F\x7F]/.test(data);
  if (hasInvalidChars) {
    addLog('warn', `Barcode ${barcodeIndex} contains control characters`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'INVALID_CHARS',
      data,
    });
  }

  // Warn if data is very long (may not fit on label)
  if (data.length > 20) {
    addLog('warn', `Barcode ${barcodeIndex} data is very long (${data.length} chars), may not fit on label`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'DATA_TOO_LONG',
      dataLength: data.length,
    });
  }
}

/**
 * Validate barcode position is within label bounds
 */
export function validateBarcodePosition(
  x: number,
  y: number,
  height: number,
  labelWidth: number,
  labelHeight: number,
  barcodeIndex: 1 | 2
): void {
  // Check if barcode starts outside label
  if (x < 0 || y < 0) {
    addLog('error', `Barcode ${barcodeIndex} position is negative: x=${x}, y=${y}`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'NEGATIVE_POSITION',
      x,
      y,
    });
  }

  // Check if barcode extends beyond label height
  if (y + height > labelHeight) {
    addLog('warn', `Barcode ${barcodeIndex} extends beyond label height: y=${y}, height=${height}, labelHeight=${labelHeight}`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'EXCEEDS_HEIGHT',
      y,
      height,
      labelHeight,
      overflow: (y + height) - labelHeight,
    });
  }

  // Check if barcode X position is near label edge (width check is done by clamp function)
  const rightEdge = labelWidth;
  const minMargin = 8; // dots
  if (x < minMargin) {
    addLog('warn', `Barcode ${barcodeIndex} is very close to left edge: x=${x}`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'NEAR_LEFT_EDGE',
      x,
      minMargin,
    });
  }
}

/**
 * Validate barcode height is reasonable
 */
export function validateBarcodeHeight(
  heightMm: number,
  scale: number,
  heightDots: number,
  barcodeIndex: 1 | 2
): void {
  // Minimum scannable height is typically 5mm
  const minHeightMm = 5;
  const actualHeightMm = heightMm * scale;

  if (actualHeightMm < minHeightMm) {
    addLog('warn', `Barcode ${barcodeIndex} height may be too small for reliable scanning: ${actualHeightMm.toFixed(1)}mm (minimum recommended: ${minHeightMm}mm)`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'HEIGHT_TOO_SMALL',
      heightMm: actualHeightMm,
      minHeightMm,
      heightDots,
    });
  }

  // Maximum practical height for 43mm label
  const maxHeightMm = 15;
  if (actualHeightMm > maxHeightMm) {
    addLog('warn', `Barcode ${barcodeIndex} height is very large: ${actualHeightMm.toFixed(1)}mm (may not fit on 43mm label)`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'HEIGHT_TOO_LARGE',
      heightMm: actualHeightMm,
      maxHeightMm,
      heightDots,
    });
  }
}

/**
 * Log barcode generation details for diagnostics
 */
export function logBarcodeGeneration(
  barcodeIndex: 1 | 2,
  uiType: string,
  cpclToken: string,
  width: number,
  ratio: number,
  height: number,
  x: number,
  y: number,
  data: string,
  wasFallback: boolean
): void {
  addLog('info', `Generated Barcode ${barcodeIndex}: ${cpclToken} at (${x}, ${y}) with height ${height} dots`, {
    category: 'barcode',
    barcodeIndex,
    uiType,
    cpclToken,
    width,
    ratio,
    height,
    x,
    y,
    dataLength: data.length,
    wasFallback,
  });
}
