import type { LabelSettings as BackendLabelSettings } from '../backend';
import type { ExtendedLabelSettings } from '../state/labelSettingsStore';
import { addLog } from '../state/logStore';
import { getBarcodeMapping, isBarcodeTypeSupported } from './cpclBarcodeMapping';
import {
  validateBarcodeData,
  validateBarcodePosition,
  validateBarcodeHeight,
  logBarcodeGeneration,
} from './cpclBarcodeDiagnostics';
import {
  calculateLeftAlignedBarcodeX,
  estimateBarcodeWidthDots,
  type BarcodeAdjustment,
} from './cpclLayoutAdjustments';
import { mmToDots, DPI } from './previewUnits';

/**
 * Clamp SETMAG scale values to safe minimum
 */
function clampScale(scale: number, elementName: string): number {
  const rounded = Math.round(scale);
  if (rounded <= 0 || !isFinite(rounded)) {
    addLog('warn', `CPCL: ${elementName} scale ${scale} is invalid, clamping to 1`, {
      category: 'layout',
      reasonCode: 'INVALID_SCALE',
      computedValue: scale,
      clampedValue: 1,
    });
    return 1;
  }
  if (rounded !== scale) {
    addLog('info', `CPCL: ${elementName} scale ${scale} rounded to ${rounded}`, {
      category: 'layout',
      computedValue: scale,
      clampedValue: rounded,
    });
  }
  return rounded;
}

/**
 * Calculate barcode height in dots with safe fallback
 */
function calculateBarcodeHeight(
  heightMm: number,
  scale: number,
  elementName: string,
  barcodeIndex: 1 | 2
): number {
  const heightDots = mmToDots(heightMm * scale);

  if (heightDots <= 0 || !isFinite(heightDots)) {
    const fallbackHeight = 60; // Safe default ~7.5mm at 203 DPI
    addLog(
      'warn',
      `CPCL: ${elementName} computed height ${heightDots} dots (${heightMm}mm × ${scale}) is invalid, using fallback ${fallbackHeight} dots`,
      {
        category: 'barcode',
        barcodeIndex,
        reasonCode: 'INVALID_HEIGHT_FALLBACK',
        computedValue: heightDots,
        clampedValue: fallbackHeight,
      }
    );
    return fallbackHeight;
  }

  validateBarcodeHeight(heightMm, scale, heightDots, barcodeIndex);
  return heightDots;
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
  
  // Use reliable CODE128 with standard parameters
  // BARCODE {type} {width} {ratio} {height} {x} {y} {data}
  // width=2 (standard narrow bar), ratio=1 (2.0:1), height=60 dots
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
 * Generate a calibration pattern CPCL payload
 * Prints a border frame and origin marker to help identify print offset issues
 */
export function generateCalibrationPatternCPCL(widthMm: number, heightMm: number): string {
  const widthDots = mmToDots(widthMm);
  const heightDots = mmToDots(heightMm);
  
  const lines: string[] = [];
  lines.push('! 0 200 200 ' + heightDots + ' 1');
  lines.push('PAGE-WIDTH ' + widthDots);
  
  // Draw border frame (4 lines forming a rectangle)
  // LINE x1 y1 x2 y2 thickness
  const borderThickness = 2;
  
  // Top border
  lines.push(`LINE 0 0 ${widthDots} 0 ${borderThickness}`);
  // Right border
  lines.push(`LINE ${widthDots - borderThickness} 0 ${widthDots - borderThickness} ${heightDots} ${borderThickness}`);
  // Bottom border
  lines.push(`LINE 0 ${heightDots - borderThickness} ${widthDots} ${heightDots - borderThickness} ${borderThickness}`);
  // Left border
  lines.push(`LINE 0 0 0 ${heightDots} ${borderThickness}`);
  
  // Draw origin marker (crosshair at top-left)
  const crosshairSize = mmToDots(5); // 5mm crosshair
  const crosshairThickness = 2;
  
  // Horizontal line of crosshair
  lines.push(`LINE 0 ${crosshairSize / 2} ${crosshairSize} ${crosshairSize / 2} ${crosshairThickness}`);
  // Vertical line of crosshair
  lines.push(`LINE ${crosshairSize / 2} 0 ${crosshairSize / 2} ${crosshairSize} ${crosshairThickness}`);
  
  // Add text label
  lines.push('TEXT 4 0 ' + mmToDots(10) + ' ' + mmToDots(10) + ' CALIBRATION');
  lines.push('TEXT 4 0 ' + mmToDots(10) + ' ' + mmToDots(15) + ' PATTERN');
  
  lines.push('PRINT');
  
  addLog('info', 'Generated calibration pattern CPCL', {
    category: 'calibration',
    widthMm,
    heightMm,
    widthDots,
    heightDots,
  });
  
  return lines.join('\n');
}

/**
 * Apply calibration offsets to a position (mm)
 */
function applyCalibrationOffset(
  xMm: number,
  yMm: number,
  offsetXmm: number,
  offsetYmm: number
): { x: number; y: number } {
  return {
    x: xMm + offsetXmm,
    y: yMm + offsetYmm,
  };
}

/**
 * Generate CPCL commands from label settings and serial data
 */
export function generateCPCL(
  settings: BackendLabelSettings | ExtendedLabelSettings,
  leftSerial: string,
  rightSerial: string,
  prefix: string
): string {
  const mappings = new Map(settings.prefixMappings);
  const mapping = mappings.get(prefix);
  const title = mapping?.title || 'Label';

  // Convert bigint to number and mm to dots
  const widthMm = Number(settings.widthMm);
  const heightMm = Number(settings.heightMm);

  const widthDots = mmToDots(widthMm);
  const heightDots = mmToDots(heightMm);

  // Get calibration offsets (default to 0 if not present)
  const extendedSettings = settings as ExtendedLabelSettings;
  const offsetXmm = extendedSettings.calibrationOffsetXmm ?? 0;
  const offsetYmm = extendedSettings.calibrationOffsetYmm ?? 0;

  // Get barcode mapping with fallback
  const uiType = settings.barcodeType;
  const barcodeMapping = getBarcodeMapping(uiType);
  const wasFallback = !isBarcodeTypeSupported(uiType);

  if (wasFallback) {
    addLog('warn', `Barcode type "${uiType}" not supported, using fallback: ${barcodeMapping.cpclToken}`, {
      category: 'barcode',
      reasonCode: 'UNSUPPORTED_TYPE',
      requestedType: uiType,
      fallbackType: barcodeMapping.cpclToken,
    });
  }

  // Extract layout settings
  const titleLayout = settings.titleLayout;
  const barcode1Layout = settings.barcode1Layout;
  const serial1Layout = settings.serialText1Layout;
  const barcode2Layout = settings.barcode2Layout;
  const serial2Layout = settings.serialText2Layout;

  // Validate barcode data
  validateBarcodeData(leftSerial, uiType, 1);
  validateBarcodeData(rightSerial, uiType, 2);

  // Use recommended width and ratio from mapping
  const barcodeWidth = barcodeMapping.recommendedWidth;
  const barcodeRatio = barcodeMapping.recommendedRatio;

  // CPCL commands
  const lines: string[] = [];
  lines.push('! 0 200 200 ' + heightDots + ' 1');
  lines.push('PAGE-WIDTH ' + widthDots);

  // Title - apply calibration offset
  const titlePos = applyCalibrationOffset(
    Number(titleLayout.x),
    Number(titleLayout.y),
    offsetXmm,
    offsetYmm
  );
  const titleX = mmToDots(titlePos.x);
  const titleY = mmToDots(titlePos.y);
  const titleScaleX = clampScale(titleLayout.scale, 'Title X');
  const titleScaleY = clampScale(titleLayout.scale, 'Title Y');
  lines.push(`SETMAG ${titleScaleX} ${titleScaleY}`);
  lines.push(`TEXT 4 0 ${titleX} ${titleY} ${title}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 1 - with left-aligned clamp adjustment and calibration offset
  const barcode1HeightMm = Number(barcode1Layout.height);
  const barcode1Scale = barcode1Layout.scale;
  const barcode1Height = calculateBarcodeHeight(barcode1HeightMm, barcode1Scale, 'Barcode 1', 1);

  // Apply calibration offset to barcode 1 position
  const barcode1Pos = applyCalibrationOffset(
    Number(barcode1Layout.x),
    Number(barcode1Layout.y),
    offsetXmm,
    offsetYmm
  );

  // Estimate barcode width and calculate left-aligned X with clamp (using offset-adjusted X)
  const barcode1WidthEstimate = estimateBarcodeWidthDots(leftSerial.length, barcodeWidth, barcodeRatio);
  const barcode1RequestedX = mmToDots(barcode1Pos.x);
  const barcode1Adjustment = calculateLeftAlignedBarcodeX(
    barcode1WidthEstimate,
    widthDots,
    barcode1RequestedX,
    1
  );

  const barcode1X = barcode1Adjustment.adjustedX;
  const barcode1Y = mmToDots(barcode1Pos.y);

  // Validate position
  validateBarcodePosition(barcode1X, barcode1Y, barcode1Height, widthDots, heightDots, 1);

  lines.push(
    `BARCODE ${barcodeMapping.cpclToken} ${barcodeWidth} ${barcodeRatio} ${barcode1Height} ${barcode1X} ${barcode1Y} ${leftSerial}`
  );

  logBarcodeGeneration(
    1,
    uiType,
    barcodeMapping.cpclToken,
    barcodeWidth,
    barcodeRatio,
    barcode1Height,
    barcode1X,
    barcode1Y,
    leftSerial,
    wasFallback
  );

  // Serial Text 1 - apply calibration offset
  const serial1Pos = applyCalibrationOffset(
    Number(serial1Layout.x),
    Number(serial1Layout.y),
    offsetXmm,
    offsetYmm
  );
  const serial1X = mmToDots(serial1Pos.x);
  const serial1Y = mmToDots(serial1Pos.y);
  const serial1ScaleX = clampScale(serial1Layout.scale, 'Serial Text 1 X');
  const serial1ScaleY = clampScale(serial1Layout.scale, 'Serial Text 1 Y');
  lines.push(`SETMAG ${serial1ScaleX} ${serial1ScaleY}`);
  lines.push(`TEXT 7 0 ${serial1X} ${serial1Y} ${leftSerial}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 2 - with left-aligned clamp adjustment and calibration offset
  const barcode2HeightMm = Number(barcode2Layout.height);
  const barcode2Scale = barcode2Layout.scale;
  const barcode2Height = calculateBarcodeHeight(barcode2HeightMm, barcode2Scale, 'Barcode 2', 2);

  // Apply calibration offset to barcode 2 position
  const barcode2Pos = applyCalibrationOffset(
    Number(barcode2Layout.x),
    Number(barcode2Layout.y),
    offsetXmm,
    offsetYmm
  );

  // Estimate barcode width and calculate left-aligned X with clamp (using offset-adjusted X)
  const barcode2WidthEstimate = estimateBarcodeWidthDots(rightSerial.length, barcodeWidth, barcodeRatio);
  const barcode2RequestedX = mmToDots(barcode2Pos.x);
  const barcode2Adjustment = calculateLeftAlignedBarcodeX(
    barcode2WidthEstimate,
    widthDots,
    barcode2RequestedX,
    2
  );

  const barcode2X = barcode2Adjustment.adjustedX;
  const barcode2Y = mmToDots(barcode2Pos.y);

  // Validate position
  validateBarcodePosition(barcode2X, barcode2Y, barcode2Height, widthDots, heightDots, 2);

  lines.push(
    `BARCODE ${barcodeMapping.cpclToken} ${barcodeWidth} ${barcodeRatio} ${barcode2Height} ${barcode2X} ${barcode2Y} ${rightSerial}`
  );

  logBarcodeGeneration(
    2,
    uiType,
    barcodeMapping.cpclToken,
    barcodeWidth,
    barcodeRatio,
    barcode2Height,
    barcode2X,
    barcode2Y,
    rightSerial,
    wasFallback
  );

  // Serial Text 2 - apply calibration offset
  const serial2Pos = applyCalibrationOffset(
    Number(serial2Layout.x),
    Number(serial2Layout.y),
    offsetXmm,
    offsetYmm
  );
  const serial2X = mmToDots(serial2Pos.x);
  const serial2Y = mmToDots(serial2Pos.y);
  const serial2ScaleX = clampScale(serial2Layout.scale, 'Serial Text 2 X');
  const serial2ScaleY = clampScale(serial2Layout.scale, 'Serial Text 2 Y');
  lines.push(`SETMAG ${serial2ScaleX} ${serial2ScaleY}`);
  lines.push(`TEXT 7 0 ${serial2X} ${serial2Y} ${rightSerial}`);
  lines.push(`SETMAG 1 1`);

  lines.push('PRINT');

  return lines.join('\n');
}

/**
 * Generate CPCL commands with an explicit title (for preview test printing)
 * This bypasses prefix mapping lookup and uses the provided title directly
 */
export function generateCPCLWithTitle(
  settings: BackendLabelSettings | ExtendedLabelSettings,
  leftSerial: string,
  rightSerial: string,
  title: string
): string {
  // Convert bigint to number and mm to dots
  const widthMm = Number(settings.widthMm);
  const heightMm = Number(settings.heightMm);

  const widthDots = mmToDots(widthMm);
  const heightDots = mmToDots(heightMm);

  // Get calibration offsets (default to 0 if not present)
  const extendedSettings = settings as ExtendedLabelSettings;
  const offsetXmm = extendedSettings.calibrationOffsetXmm ?? 0;
  const offsetYmm = extendedSettings.calibrationOffsetYmm ?? 0;

  // Get barcode mapping with fallback
  const uiType = settings.barcodeType;
  const barcodeMapping = getBarcodeMapping(uiType);
  const wasFallback = !isBarcodeTypeSupported(uiType);

  if (wasFallback) {
    addLog('warn', `Barcode type "${uiType}" not supported, using fallback: ${barcodeMapping.cpclToken}`, {
      category: 'barcode',
      reasonCode: 'UNSUPPORTED_TYPE',
      requestedType: uiType,
      fallbackType: barcodeMapping.cpclToken,
    });
  }

  // Extract layout settings
  const titleLayout = settings.titleLayout;
  const barcode1Layout = settings.barcode1Layout;
  const serial1Layout = settings.serialText1Layout;
  const barcode2Layout = settings.barcode2Layout;
  const serial2Layout = settings.serialText2Layout;

  // Validate barcode data
  validateBarcodeData(leftSerial, uiType, 1);
  validateBarcodeData(rightSerial, uiType, 2);

  // Use recommended width and ratio from mapping
  const barcodeWidth = barcodeMapping.recommendedWidth;
  const barcodeRatio = barcodeMapping.recommendedRatio;

  // CPCL commands
  const lines: string[] = [];
  lines.push('! 0 200 200 ' + heightDots + ' 1');
  lines.push('PAGE-WIDTH ' + widthDots);

  // Title (using explicit title parameter) - apply calibration offset
  const titlePos = applyCalibrationOffset(
    Number(titleLayout.x),
    Number(titleLayout.y),
    offsetXmm,
    offsetYmm
  );
  const titleX = mmToDots(titlePos.x);
  const titleY = mmToDots(titlePos.y);
  const titleScaleX = clampScale(titleLayout.scale, 'Title X');
  const titleScaleY = clampScale(titleLayout.scale, 'Title Y');
  lines.push(`SETMAG ${titleScaleX} ${titleScaleY}`);
  lines.push(`TEXT 4 0 ${titleX} ${titleY} ${title}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 1 - with left-aligned clamp adjustment and calibration offset
  const barcode1HeightMm = Number(barcode1Layout.height);
  const barcode1Scale = barcode1Layout.scale;
  const barcode1Height = calculateBarcodeHeight(barcode1HeightMm, barcode1Scale, 'Barcode 1', 1);

  // Apply calibration offset to barcode 1 position
  const barcode1Pos = applyCalibrationOffset(
    Number(barcode1Layout.x),
    Number(barcode1Layout.y),
    offsetXmm,
    offsetYmm
  );

  // Estimate barcode width and calculate left-aligned X with clamp (using offset-adjusted X)
  const barcode1WidthEstimate = estimateBarcodeWidthDots(leftSerial.length, barcodeWidth, barcodeRatio);
  const barcode1RequestedX = mmToDots(barcode1Pos.x);
  const barcode1Adjustment = calculateLeftAlignedBarcodeX(
    barcode1WidthEstimate,
    widthDots,
    barcode1RequestedX,
    1
  );

  const barcode1X = barcode1Adjustment.adjustedX;
  const barcode1Y = mmToDots(barcode1Pos.y);

  // Validate position
  validateBarcodePosition(barcode1X, barcode1Y, barcode1Height, widthDots, heightDots, 1);

  lines.push(
    `BARCODE ${barcodeMapping.cpclToken} ${barcodeWidth} ${barcodeRatio} ${barcode1Height} ${barcode1X} ${barcode1Y} ${leftSerial}`
  );

  logBarcodeGeneration(
    1,
    uiType,
    barcodeMapping.cpclToken,
    barcodeWidth,
    barcodeRatio,
    barcode1Height,
    barcode1X,
    barcode1Y,
    leftSerial,
    wasFallback
  );

  // Serial Text 1 - apply calibration offset
  const serial1Pos = applyCalibrationOffset(
    Number(serial1Layout.x),
    Number(serial1Layout.y),
    offsetXmm,
    offsetYmm
  );
  const serial1X = mmToDots(serial1Pos.x);
  const serial1Y = mmToDots(serial1Pos.y);
  const serial1ScaleX = clampScale(serial1Layout.scale, 'Serial Text 1 X');
  const serial1ScaleY = clampScale(serial1Layout.scale, 'Serial Text 1 Y');
  lines.push(`SETMAG ${serial1ScaleX} ${serial1ScaleY}`);
  lines.push(`TEXT 7 0 ${serial1X} ${serial1Y} ${leftSerial}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 2 - with left-aligned clamp adjustment and calibration offset
  const barcode2HeightMm = Number(barcode2Layout.height);
  const barcode2Scale = barcode2Layout.scale;
  const barcode2Height = calculateBarcodeHeight(barcode2HeightMm, barcode2Scale, 'Barcode 2', 2);

  // Apply calibration offset to barcode 2 position
  const barcode2Pos = applyCalibrationOffset(
    Number(barcode2Layout.x),
    Number(barcode2Layout.y),
    offsetXmm,
    offsetYmm
  );

  // Estimate barcode width and calculate left-aligned X with clamp (using offset-adjusted X)
  const barcode2WidthEstimate = estimateBarcodeWidthDots(rightSerial.length, barcodeWidth, barcodeRatio);
  const barcode2RequestedX = mmToDots(barcode2Pos.x);
  const barcode2Adjustment = calculateLeftAlignedBarcodeX(
    barcode2WidthEstimate,
    widthDots,
    barcode2RequestedX,
    2
  );

  const barcode2X = barcode2Adjustment.adjustedX;
  const barcode2Y = mmToDots(barcode2Pos.y);

  // Validate position
  validateBarcodePosition(barcode2X, barcode2Y, barcode2Height, widthDots, heightDots, 2);

  lines.push(
    `BARCODE ${barcodeMapping.cpclToken} ${barcodeWidth} ${barcodeRatio} ${barcode2Height} ${barcode2X} ${barcode2Y} ${rightSerial}`
  );

  logBarcodeGeneration(
    2,
    uiType,
    barcodeMapping.cpclToken,
    barcodeWidth,
    barcodeRatio,
    barcode2Height,
    barcode2X,
    barcode2Y,
    rightSerial,
    wasFallback
  );

  // Serial Text 2 - apply calibration offset
  const serial2Pos = applyCalibrationOffset(
    Number(serial2Layout.x),
    Number(serial2Layout.y),
    offsetXmm,
    offsetYmm
  );
  const serial2X = mmToDots(serial2Pos.x);
  const serial2Y = mmToDots(serial2Pos.y);
  const serial2ScaleX = clampScale(serial2Layout.scale, 'Serial Text 2 X');
  const serial2ScaleY = clampScale(serial2Layout.scale, 'Serial Text 2 Y');
  lines.push(`SETMAG ${serial2ScaleX} ${serial2ScaleY}`);
  lines.push(`TEXT 7 0 ${serial2X} ${serial2Y} ${rightSerial}`);
  lines.push(`SETMAG 1 1`);

  lines.push('PRINT');

  return lines.join('\n');
}
