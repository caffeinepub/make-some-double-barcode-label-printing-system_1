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
 * Apply global and calibration offsets to a position (mm)
 */
function applyAllOffsets(
  xMm: number,
  yMm: number,
  globalHorizontalOffset: number,
  globalVerticalOffset: number,
  calibrationOffsetXmm: number,
  calibrationOffsetYmm: number
): { x: number; y: number } {
  return {
    x: xMm + globalHorizontalOffset + calibrationOffsetXmm,
    y: yMm + globalVerticalOffset + calibrationOffsetYmm,
  };
}

/**
 * Calculate text height in dots for proper spacing
 */
function calculateTextHeightDots(fontSize: number, scale: number): number {
  // CPCL font size 7 is approximately 3mm tall
  // Font size 4 is approximately 2mm tall
  // Estimate: fontSize * 0.5mm per unit * scale
  const heightMm = fontSize * 0.5 * scale;
  return mmToDots(heightMm);
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

  // Get all offsets
  const extendedSettings = settings as ExtendedLabelSettings;
  const globalHorizontalOffset = Number(settings.globalHorizontalOffset || 0);
  const globalVerticalOffset = Number(settings.globalVerticalOffset || 0);
  const calibrationOffsetXmm = extendedSettings.calibrationOffsetXmm ?? 0;
  const calibrationOffsetYmm = extendedSettings.calibrationOffsetYmm ?? 0;

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
  const barcode2Layout = settings.barcode2Layout;
  
  // Extract barcode positions (these control actual placement)
  const barcode1Position = settings.barcode1Position;
  const barcode2Position = settings.barcode2Position;

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

  // Calculate barcode heights first (needed for layout calculations)
  const barcode1HeightMm = Number(barcode1Layout.height);
  const barcode1Scale = barcode1Layout.scale;
  const barcode1Height = calculateBarcodeHeight(barcode1HeightMm, barcode1Scale, 'Barcode 1', 1);

  const barcode2HeightMm = Number(barcode2Layout.height);
  const barcode2Scale = barcode2Layout.scale;
  const barcode2Height = calculateBarcodeHeight(barcode2HeightMm, barcode2Scale, 'Barcode 2', 2);

  // Calculate title height for spacing check
  const titleHeightDots = calculateTextHeightDots(Number(titleLayout.fontSize), titleLayout.scale);

  // Title - apply all offsets and ensure it doesn't overlap with barcode 1
  const titlePos = applyAllOffsets(
    Number(titleLayout.x),
    Number(titleLayout.y),
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );
  
  // Check if title would overlap with barcode 1
  const barcode1YDots = mmToDots(Number(barcode1Position.y) + globalVerticalOffset + calibrationOffsetYmm);
  const titleBottomDots = mmToDots(titlePos.y) + titleHeightDots;
  const minSpacingDots = mmToDots(1); // 1mm minimum spacing
  
  let adjustedTitleY = titlePos.y;
  if (titleBottomDots + minSpacingDots > barcode1YDots) {
    // Move title up to prevent overlap
    adjustedTitleY = titlePos.y - ((titleBottomDots + minSpacingDots - barcode1YDots) / mmToDots(1));
    addLog('warn', `Title adjusted to prevent overlap with Barcode 1: ${titlePos.y.toFixed(1)}mm → ${adjustedTitleY.toFixed(1)}mm`, {
      category: 'layout',
      reasonCode: 'TITLE_OVERLAP_PREVENTED',
      originalY: titlePos.y,
      adjustedY: adjustedTitleY,
    });
  }

  const titleX = mmToDots(titlePos.x);
  const titleY = mmToDots(adjustedTitleY);
  const titleScaleX = clampScale(titleLayout.scale, 'Title X');
  const titleScaleY = clampScale(titleLayout.scale, 'Title Y');
  lines.push(`SETMAG ${titleScaleX} ${titleScaleY}`);
  lines.push(`TEXT 4 0 ${titleX} ${titleY} ${title}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 1 - use barcode1Position for placement
  // Apply all offsets to barcode 1 position
  const barcode1Pos = applyAllOffsets(
    Number(barcode1Position.x),
    Number(barcode1Position.y),
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );

  // Estimate barcode width and calculate left-aligned X with clamp
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

  // Serial Text 1 - positioned below barcode 1 using verticalSpacing
  // Ensure minimum spacing between barcode and text
  const minTextSpacing = Math.max(Number(barcode1Position.verticalSpacing), 1); // At least 1mm
  const serial1Pos = applyAllOffsets(
    Number(barcode1Position.x),
    Number(barcode1Position.y) + barcode1HeightMm + minTextSpacing,
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );
  const serial1X = mmToDots(serial1Pos.x);
  const serial1Y = mmToDots(serial1Pos.y);
  const serial1Scale = barcode1Layout.scale;
  const serial1ScaleX = clampScale(serial1Scale, 'Serial Text 1 X');
  const serial1ScaleY = clampScale(serial1Scale, 'Serial Text 1 Y');
  lines.push(`SETMAG ${serial1ScaleX} ${serial1ScaleY}`);
  lines.push(`TEXT 7 0 ${serial1X} ${serial1Y} ${leftSerial}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 2 - use barcode2Position for placement
  // Apply all offsets to barcode 2 position
  const barcode2Pos = applyAllOffsets(
    Number(barcode2Position.x),
    Number(barcode2Position.y),
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );

  // Estimate barcode width and calculate left-aligned X with clamp
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

  // Serial Text 2 - positioned below barcode 2 using verticalSpacing
  // Ensure minimum spacing between barcode and text
  const minTextSpacing2 = Math.max(Number(barcode2Position.verticalSpacing), 1); // At least 1mm
  const serial2Pos = applyAllOffsets(
    Number(barcode2Position.x),
    Number(barcode2Position.y) + barcode2HeightMm + minTextSpacing2,
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );
  const serial2X = mmToDots(serial2Pos.x);
  const serial2Y = mmToDots(serial2Pos.y);
  const serial2Scale = barcode2Layout.scale;
  const serial2ScaleX = clampScale(serial2Scale, 'Serial Text 2 X');
  const serial2ScaleY = clampScale(serial2Scale, 'Serial Text 2 Y');
  lines.push(`SETMAG ${serial2ScaleX} ${serial2ScaleY}`);
  lines.push(`TEXT 7 0 ${serial2X} ${serial2Y} ${rightSerial}`);
  lines.push(`SETMAG 1 1`);

  lines.push('PRINT');

  return lines.join('\n');
}

/**
 * Generate CPCL with custom title (for test prints)
 */
export function generateCPCLWithTitle(
  settings: BackendLabelSettings | ExtendedLabelSettings,
  leftSerial: string,
  rightSerial: string,
  customTitle: string
): string {
  // Convert bigint to number and mm to dots
  const widthMm = Number(settings.widthMm);
  const heightMm = Number(settings.heightMm);

  const widthDots = mmToDots(widthMm);
  const heightDots = mmToDots(heightMm);

  // Get all offsets
  const extendedSettings = settings as ExtendedLabelSettings;
  const globalHorizontalOffset = Number(settings.globalHorizontalOffset || 0);
  const globalVerticalOffset = Number(settings.globalVerticalOffset || 0);
  const calibrationOffsetXmm = extendedSettings.calibrationOffsetXmm ?? 0;
  const calibrationOffsetYmm = extendedSettings.calibrationOffsetYmm ?? 0;

  // Get barcode mapping with fallback
  const uiType = settings.barcodeType;
  const barcodeMapping = getBarcodeMapping(uiType);

  // Extract layout settings
  const titleLayout = settings.titleLayout;
  const barcode1Layout = settings.barcode1Layout;
  const barcode2Layout = settings.barcode2Layout;
  
  // Extract barcode positions
  const barcode1Position = settings.barcode1Position;
  const barcode2Position = settings.barcode2Position;

  // Use recommended width and ratio from mapping
  const barcodeWidth = barcodeMapping.recommendedWidth;
  const barcodeRatio = barcodeMapping.recommendedRatio;

  // CPCL commands
  const lines: string[] = [];
  lines.push('! 0 200 200 ' + heightDots + ' 1');
  lines.push('PAGE-WIDTH ' + widthDots);

  // Calculate barcode heights
  const barcode1HeightMm = Number(barcode1Layout.height);
  const barcode1Scale = barcode1Layout.scale;
  const barcode1Height = calculateBarcodeHeight(barcode1HeightMm, barcode1Scale, 'Barcode 1', 1);

  const barcode2HeightMm = Number(barcode2Layout.height);
  const barcode2Scale = barcode2Layout.scale;
  const barcode2Height = calculateBarcodeHeight(barcode2HeightMm, barcode2Scale, 'Barcode 2', 2);

  // Title - apply all offsets
  const titlePos = applyAllOffsets(
    Number(titleLayout.x),
    Number(titleLayout.y),
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );
  const titleX = mmToDots(titlePos.x);
  const titleY = mmToDots(titlePos.y);
  const titleScaleX = clampScale(titleLayout.scale, 'Title X');
  const titleScaleY = clampScale(titleLayout.scale, 'Title Y');
  lines.push(`SETMAG ${titleScaleX} ${titleScaleY}`);
  lines.push(`TEXT 4 0 ${titleX} ${titleY} ${customTitle}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 1
  const barcode1Pos = applyAllOffsets(
    Number(barcode1Position.x),
    Number(barcode1Position.y),
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );

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

  lines.push(
    `BARCODE ${barcodeMapping.cpclToken} ${barcodeWidth} ${barcodeRatio} ${barcode1Height} ${barcode1X} ${barcode1Y} ${leftSerial}`
  );

  // Serial Text 1
  const minTextSpacing = Math.max(Number(barcode1Position.verticalSpacing), 1);
  const serial1Pos = applyAllOffsets(
    Number(barcode1Position.x),
    Number(barcode1Position.y) + barcode1HeightMm + minTextSpacing,
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );
  const serial1X = mmToDots(serial1Pos.x);
  const serial1Y = mmToDots(serial1Pos.y);
  const serial1Scale = barcode1Layout.scale;
  const serial1ScaleX = clampScale(serial1Scale, 'Serial Text 1 X');
  const serial1ScaleY = clampScale(serial1Scale, 'Serial Text 1 Y');
  lines.push(`SETMAG ${serial1ScaleX} ${serial1ScaleY}`);
  lines.push(`TEXT 7 0 ${serial1X} ${serial1Y} ${leftSerial}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 2
  const barcode2Pos = applyAllOffsets(
    Number(barcode2Position.x),
    Number(barcode2Position.y),
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );

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

  lines.push(
    `BARCODE ${barcodeMapping.cpclToken} ${barcodeWidth} ${barcodeRatio} ${barcode2Height} ${barcode2X} ${barcode2Y} ${rightSerial}`
  );

  // Serial Text 2
  const minTextSpacing2 = Math.max(Number(barcode2Position.verticalSpacing), 1);
  const serial2Pos = applyAllOffsets(
    Number(barcode2Position.x),
    Number(barcode2Position.y) + barcode2HeightMm + minTextSpacing2,
    globalHorizontalOffset,
    globalVerticalOffset,
    calibrationOffsetXmm,
    calibrationOffsetYmm
  );
  const serial2X = mmToDots(serial2Pos.x);
  const serial2Y = mmToDots(serial2Pos.y);
  const serial2Scale = barcode2Layout.scale;
  const serial2ScaleX = clampScale(serial2Scale, 'Serial Text 2 X');
  const serial2ScaleY = clampScale(serial2Scale, 'Serial Text 2 Y');
  lines.push(`SETMAG ${serial2ScaleX} ${serial2ScaleY}`);
  lines.push(`TEXT 7 0 ${serial2X} ${serial2Y} ${rightSerial}`);
  lines.push(`SETMAG 1 1`);

  lines.push('PRINT');

  return lines.join('\n');
}
