/**
 * CPCL barcode diagnostics and validation utilities
 * 
 * Provides structured validation and diagnostic logging for barcode
 * generation to help users troubleshoot printing issues.
 */

import { addLog } from '../state/logStore';
import type { LabelSettings as BackendLabelSettings } from '../backend';

export interface BarcodeValidationResult {
  isValid: boolean;
  warnings: string[];
  errors: string[];
}

/**
 * Validate barcode data for common issues
 */
export function validateBarcodeData(
  data: string,
  barcodeType: string,
  barcodeIndex: 1 | 2
): BarcodeValidationResult {
  const result: BarcodeValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
  };

  // Check for empty data
  if (!data || data.trim().length === 0) {
    result.isValid = false;
    result.errors.push(`Barcode ${barcodeIndex}: Empty barcode data`);
    addLog('error', `Barcode ${barcodeIndex} has empty data`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'EMPTY_DATA',
    });
    return result;
  }

  // Check for whitespace
  if (data !== data.trim()) {
    result.warnings.push(`Barcode ${barcodeIndex}: Data contains leading/trailing whitespace`);
    addLog('warn', `Barcode ${barcodeIndex} data contains whitespace: "${data}"`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'WHITESPACE',
    });
  }

  // Check for special characters that might cause issues
  const problematicChars = /[\r\n\t]/g;
  if (problematicChars.test(data)) {
    result.warnings.push(`Barcode ${barcodeIndex}: Data contains control characters (CR/LF/Tab)`);
    addLog('warn', `Barcode ${barcodeIndex} contains control characters`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'CONTROL_CHARS',
    });
  }

  return result;
}

/**
 * Validate barcode positioning against label bounds
 */
export function validateBarcodePosition(
  x: number,
  y: number,
  height: number,
  labelWidthDots: number,
  labelHeightDots: number,
  barcodeIndex: 1 | 2
): BarcodeValidationResult {
  const result: BarcodeValidationResult = {
    isValid: true,
    warnings: [],
    errors: [],
  };

  // Check if barcode is within label bounds
  if (x < 0 || x >= labelWidthDots) {
    result.warnings.push(`Barcode ${barcodeIndex}: X position ${x} is outside label width ${labelWidthDots}`);
    addLog('warn', `Barcode ${barcodeIndex} X position out of bounds`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'X_OUT_OF_BOUNDS',
      computedValue: x,
      clampedValue: Math.max(0, Math.min(x, labelWidthDots - 1)),
    });
  }

  if (y < 0 || y >= labelHeightDots) {
    result.warnings.push(`Barcode ${barcodeIndex}: Y position ${y} is outside label height ${labelHeightDots}`);
    addLog('warn', `Barcode ${barcodeIndex} Y position out of bounds`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'Y_OUT_OF_BOUNDS',
      computedValue: y,
      clampedValue: Math.max(0, Math.min(y, labelHeightDots - 1)),
    });
  }

  if (y + height > labelHeightDots) {
    result.warnings.push(
      `Barcode ${barcodeIndex}: Height ${height} extends beyond label (y=${y}, label height=${labelHeightDots})`
    );
    addLog('warn', `Barcode ${barcodeIndex} extends beyond label height`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'HEIGHT_OVERFLOW',
      computedValue: y + height,
      clampedValue: labelHeightDots,
    });
  }

  return result;
}

/**
 * Validate barcode height calculation
 */
export function validateBarcodeHeight(
  heightMm: number,
  scale: number,
  heightDots: number,
  barcodeIndex: 1 | 2
): void {
  if (heightDots <= 0 || !isFinite(heightDots)) {
    addLog('error', `Barcode ${barcodeIndex} computed height is invalid`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'INVALID_HEIGHT',
      computedValue: heightDots,
    });
  } else if (heightDots < 30) {
    addLog('warn', `Barcode ${barcodeIndex} height ${heightDots} dots may be too small to scan reliably`, {
      category: 'barcode',
      barcodeIndex,
      reasonCode: 'HEIGHT_TOO_SMALL',
      computedValue: heightDots,
    });
  } else {
    addLog('info', `Barcode ${barcodeIndex} height: ${heightDots} dots (${heightMm}mm × ${scale})`, {
      category: 'barcode',
      barcodeIndex,
      computedValue: heightDots,
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
  const level = wasFallback ? 'warn' : 'info';
  const message = wasFallback
    ? `Barcode ${barcodeIndex}: Using fallback type ${cpclToken} (requested: ${uiType})`
    : `Barcode ${barcodeIndex}: Generated ${cpclToken} barcode`;

  addLog(level, message, {
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
