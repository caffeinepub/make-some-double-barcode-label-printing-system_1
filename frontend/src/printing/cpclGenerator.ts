import { LabelSettings } from '../state/labelSettingsStore';
import { mmToDots } from './previewUnits';
import { getBarcodeMapping } from './cpclBarcodeMapping';
import { validateBarcodeData, validateBarcodePosition } from './cpclBarcodeDiagnostics';
import { calculateLeftAlignedBarcodeX, estimateBarcodeWidthDots } from './cpclLayoutAdjustments';
import { addLog } from '../state/logStore';

export interface CpclPrintJob {
  leftSerial: string;
  rightSerial: string;
  title: string;
  settings: LabelSettings;
}

/**
 * Generate a test print CPCL payload with reliable barcode
 */
export function generateTestPrintCPCL(): string {
  const lines: string[] = [];
  lines.push('! 0 200 200 240 1');
  lines.push('PAGE-WIDTH 384');
  lines.push('TEXT 4 0 20 20 TEST PRINT');
  lines.push('TEXT 4 0 20 60 Label Printer');
  lines.push('TEXT 4 0 20 100 Connection OK');
  lines.push('BARCODE 128 2 1 60 20 140 TEST123');
  lines.push('TEXT 7 0 20 210 TEST123');
  lines.push('PRINT');

  addLog('info', 'Generated test print CPCL with CODE128 barcode', {
    category: 'barcode',
    cpclToken: '128',
    width: 2,
    ratio: 1,
    height: 60,
  });

  return lines.join('\n');
}

/**
 * Generate CPCL commands from label settings and serial data
 */
export function generateCPCL(
  settings: LabelSettings,
  leftSerial: string,
  rightSerial: string,
  prefix: string
): string {
  const mapping = settings.prefixMappings[prefix];
  const title = mapping?.title || 'Label';
  return generateCpclWithTitle(settings, leftSerial, rightSerial, title);
}

/**
 * Generate CPCL with a custom title (for test prints and direct calls)
 */
export function generateCpclWithTitle(
  settings: LabelSettings,
  leftSerial: string,
  rightSerial: string,
  customTitle: string
): string {
  const labelWidthDots = mmToDots(settings.widthMm);
  const labelHeightDots = mmToDots(settings.heightMm);
  const barcodeHeightDots = mmToDots(settings.barcodeHeight);
  const barcodeWidth = Math.max(1, Math.min(10, Math.round(settings.barcodeWidth ?? 2)));

  const globalVDots = mmToDots(settings.globalVerticalOffsetMm);
  const globalHDots = mmToDots(settings.globalHorizontalOffsetMm);

  const barcodeMapping = getBarcodeMapping(settings.barcodeType);
  const barcodeToken = barcodeMapping.cpclToken;
  const barcodeRatio = barcodeMapping.recommendedRatio;

  // Validate barcode data
  validateBarcodeData(leftSerial, settings.barcodeType, 1);
  validateBarcodeData(rightSerial, settings.barcodeType, 2);

  // Title
  const titleFontSize = Math.max(1, Math.round(settings.titleFontSize ?? 3));
  const titleYDots = globalVDots + 4;
  const titleXDots = globalHDots + 4;

  // Barcode 1
  const b1 = settings.barcode1Position;
  const b1xRaw = mmToDots(b1.xMm) + globalHDots;
  const b1yRaw = mmToDots(b1.yMm) + globalVDots;

  const b1WidthEstimate = estimateBarcodeWidthDots(leftSerial.length, barcodeWidth, barcodeRatio);
  const b1Adjustment = calculateLeftAlignedBarcodeX(b1WidthEstimate, labelWidthDots, b1xRaw, 1);
  const b1x = b1Adjustment.adjustedX;
  const b1y = Math.max(0, b1yRaw);

  validateBarcodePosition(b1x, b1y, barcodeHeightDots, labelWidthDots, labelHeightDots, 1);

  const serial1FontSize = Math.max(1, Math.round(settings.serialFontSize ?? 2));
  const serial1TextYDots = b1y + barcodeHeightDots + mmToDots(b1.textSpacingMm);

  // Barcode 2
  const b2 = settings.barcode2Position;
  const b2xRaw = mmToDots(b2.xMm) + globalHDots;
  const b2yRaw = mmToDots(b2.yMm) + globalVDots;

  // Enforce minimum 1mm gap between serial1 text bottom and barcode2 top
  const minGapDots = mmToDots(1);
  const serial1FontHeightDots = mmToDots(settings.serialFontSize ?? 2) + 4;
  const serial1BottomDots = serial1TextYDots + serial1FontHeightDots;
  const b2yAdjusted = Math.max(b2yRaw, serial1BottomDots + minGapDots);

  const b2WidthEstimate = estimateBarcodeWidthDots(rightSerial.length, barcodeWidth, barcodeRatio);
  const b2Adjustment = calculateLeftAlignedBarcodeX(b2WidthEstimate, labelWidthDots, b2xRaw, 2);
  const b2x = b2Adjustment.adjustedX;
  const b2y = Math.max(0, b2yAdjusted);

  validateBarcodePosition(b2x, b2y, barcodeHeightDots, labelWidthDots, labelHeightDots, 2);

  const serial2TextYDots = b2y + barcodeHeightDots + mmToDots(b2.textSpacingMm);

  const lines: string[] = [];

  // CPCL header
  lines.push(`! 0 200 200 ${labelHeightDots} 1`);
  lines.push(`PAGE-WIDTH ${labelWidthDots}`);

  // Title text
  if (customTitle) {
    lines.push(`TEXT ${titleFontSize} 0 ${titleXDots} ${titleYDots} ${customTitle}`);
  }

  // Barcode 1: BARCODE <type> <width> <ratio> <height> <x> <y> <data>
  lines.push(
    `BARCODE ${barcodeToken} ${barcodeWidth} ${barcodeRatio} ${barcodeHeightDots} ${b1x} ${b1y} ${leftSerial}`
  );
  lines.push(`TEXT ${serial1FontSize} 0 ${b1x} ${serial1TextYDots} ${leftSerial}`);

  // Barcode 2
  lines.push(
    `BARCODE ${barcodeToken} ${barcodeWidth} ${barcodeRatio} ${barcodeHeightDots} ${b2x} ${b2y} ${rightSerial}`
  );
  lines.push(`TEXT ${serial1FontSize} 0 ${b2x} ${serial2TextYDots} ${rightSerial}`);

  lines.push('PRINT');

  addLog('info', `Generated CPCL: barcodeWidth=${barcodeWidth} dots, type=${barcodeToken}`, {
    category: 'barcode',
    barcodeWidth,
    barcodeToken,
    barcodeHeightDots,
  });

  return lines.join('\n');
}

// Alias for backward compatibility
export const generateCpclWithTitleAlias = generateCpclWithTitle;
export { generateCpclWithTitle as generateCPCLWithTitle };
