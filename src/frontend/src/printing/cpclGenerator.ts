import type { LabelSettings as BackendLabelSettings } from '../backend';
import { addLog } from '../state/logStore';
import { getBarcodeMapping, isBarcodeTypeSupported } from './cpclBarcodeMapping';
import {
  validateBarcodeData,
  validateBarcodePosition,
  validateBarcodeHeight,
  logBarcodeGeneration,
} from './cpclBarcodeDiagnostics';
import {
  calculateCenteredBarcodeX,
  estimateBarcodeWidthDots,
  type BarcodeAdjustment,
} from './cpclLayoutAdjustments';

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
  dpi: number,
  barcodeIndex: 1 | 2
): number {
  const mmToDots = (mm: number): number => Math.round((mm / 25.4) * dpi);
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
 * Generate CPCL commands from label settings and serial data
 */
export function generateCPCL(
  settings: BackendLabelSettings,
  leftSerial: string,
  rightSerial: string,
  prefix: string
): string {
  const mappings = new Map(settings.prefixMappings);
  const mapping = mappings.get(prefix);
  const title = mapping?.title || 'Label';

  // Convert bigint to number and mm to dots (assuming 203 DPI)
  const dpi = 203;
  const widthMm = Number(settings.widthMm);
  const heightMm = Number(settings.heightMm);

  const widthDots = Math.round((widthMm / 25.4) * dpi);
  const heightDots = Math.round((heightMm / 25.4) * dpi);

  // Helper to convert mm to dots
  const mmToDots = (mm: number): number => Math.round((mm / 25.4) * dpi);

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

  // Title
  const titleX = mmToDots(Number(titleLayout.x));
  const titleY = mmToDots(Number(titleLayout.y));
  const titleScaleX = clampScale(titleLayout.scale, 'Title X');
  const titleScaleY = clampScale(titleLayout.scale, 'Title Y');
  lines.push(`SETMAG ${titleScaleX} ${titleScaleY}`);
  lines.push(`TEXT 4 0 ${titleX} ${titleY} ${title}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 1 - with centering and clamp adjustment
  const barcode1HeightMm = Number(barcode1Layout.height);
  const barcode1Scale = barcode1Layout.scale;
  const barcode1Height = calculateBarcodeHeight(barcode1HeightMm, barcode1Scale, 'Barcode 1', dpi, 1);

  // Estimate barcode width and calculate centered X
  const barcode1WidthEstimate = estimateBarcodeWidthDots(leftSerial.length, barcodeWidth, barcodeRatio);
  const barcode1RequestedX = mmToDots(Number(barcode1Layout.x));
  const barcode1Adjustment = calculateCenteredBarcodeX(
    barcode1WidthEstimate,
    widthDots,
    barcode1RequestedX,
    1
  );

  // Log adjustment if barcode was clamped
  if (barcode1Adjustment.wasClamped || barcode1Adjustment.adjustedX !== barcode1RequestedX) {
    addLog(
      'warn',
      `Barcode 1 X position adjusted for centering/clipping prevention: ${barcode1RequestedX} → ${barcode1Adjustment.adjustedX} dots`,
      {
        category: 'barcode',
        barcodeIndex: 1,
        reasonCode: 'POSITION_ADJUSTED',
        originalX: barcode1RequestedX,
        adjustedX: barcode1Adjustment.adjustedX,
        estimatedWidth: barcode1WidthEstimate,
        labelWidth: widthDots,
      }
    );
  }

  const barcode1X = barcode1Adjustment.adjustedX;
  const barcode1Y = mmToDots(Number(barcode1Layout.y));

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

  // Serial Text 1
  const serial1X = mmToDots(Number(serial1Layout.x));
  const serial1Y = mmToDots(Number(serial1Layout.y));
  const serial1ScaleX = clampScale(serial1Layout.scale, 'Serial Text 1 X');
  const serial1ScaleY = clampScale(serial1Layout.scale, 'Serial Text 1 Y');
  lines.push(`SETMAG ${serial1ScaleX} ${serial1ScaleY}`);
  lines.push(`TEXT 7 0 ${serial1X} ${serial1Y} ${leftSerial}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 2 - with centering and clamp adjustment
  const barcode2HeightMm = Number(barcode2Layout.height);
  const barcode2Scale = barcode2Layout.scale;
  const barcode2Height = calculateBarcodeHeight(barcode2HeightMm, barcode2Scale, 'Barcode 2', dpi, 2);

  // Estimate barcode width and calculate centered X
  const barcode2WidthEstimate = estimateBarcodeWidthDots(rightSerial.length, barcodeWidth, barcodeRatio);
  const barcode2RequestedX = mmToDots(Number(barcode2Layout.x));
  const barcode2Adjustment = calculateCenteredBarcodeX(
    barcode2WidthEstimate,
    widthDots,
    barcode2RequestedX,
    2
  );

  // Log adjustment if barcode was clamped
  if (barcode2Adjustment.wasClamped || barcode2Adjustment.adjustedX !== barcode2RequestedX) {
    addLog(
      'warn',
      `Barcode 2 X position adjusted for centering/clipping prevention: ${barcode2RequestedX} → ${barcode2Adjustment.adjustedX} dots`,
      {
        category: 'barcode',
        barcodeIndex: 2,
        reasonCode: 'POSITION_ADJUSTED',
        originalX: barcode2RequestedX,
        adjustedX: barcode2Adjustment.adjustedX,
        estimatedWidth: barcode2WidthEstimate,
        labelWidth: widthDots,
      }
    );
  }

  const barcode2X = barcode2Adjustment.adjustedX;
  const barcode2Y = mmToDots(Number(barcode2Layout.y));

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

  // Serial Text 2
  const serial2X = mmToDots(Number(serial2Layout.x));
  const serial2Y = mmToDots(Number(serial2Layout.y));
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
  settings: BackendLabelSettings,
  leftSerial: string,
  rightSerial: string,
  title: string
): string {
  // Convert bigint to number and mm to dots (assuming 203 DPI)
  const dpi = 203;
  const widthMm = Number(settings.widthMm);
  const heightMm = Number(settings.heightMm);

  const widthDots = Math.round((widthMm / 25.4) * dpi);
  const heightDots = Math.round((heightMm / 25.4) * dpi);

  // Helper to convert mm to dots
  const mmToDots = (mm: number): number => Math.round((mm / 25.4) * dpi);

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

  // Title (using explicit title parameter)
  const titleX = mmToDots(Number(titleLayout.x));
  const titleY = mmToDots(Number(titleLayout.y));
  const titleScaleX = clampScale(titleLayout.scale, 'Title X');
  const titleScaleY = clampScale(titleLayout.scale, 'Title Y');
  lines.push(`SETMAG ${titleScaleX} ${titleScaleY}`);
  lines.push(`TEXT 4 0 ${titleX} ${titleY} ${title}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 1 - with centering and clamp adjustment
  const barcode1HeightMm = Number(barcode1Layout.height);
  const barcode1Scale = barcode1Layout.scale;
  const barcode1Height = calculateBarcodeHeight(barcode1HeightMm, barcode1Scale, 'Barcode 1', dpi, 1);

  // Estimate barcode width and calculate centered X
  const barcode1WidthEstimate = estimateBarcodeWidthDots(leftSerial.length, barcodeWidth, barcodeRatio);
  const barcode1RequestedX = mmToDots(Number(barcode1Layout.x));
  const barcode1Adjustment = calculateCenteredBarcodeX(
    barcode1WidthEstimate,
    widthDots,
    barcode1RequestedX,
    1
  );

  // Log adjustment if barcode was clamped
  if (barcode1Adjustment.wasClamped || barcode1Adjustment.adjustedX !== barcode1RequestedX) {
    addLog(
      'warn',
      `Barcode 1 X position adjusted for centering/clipping prevention: ${barcode1RequestedX} → ${barcode1Adjustment.adjustedX} dots`,
      {
        category: 'barcode',
        barcodeIndex: 1,
        reasonCode: 'POSITION_ADJUSTED',
        originalX: barcode1RequestedX,
        adjustedX: barcode1Adjustment.adjustedX,
        estimatedWidth: barcode1WidthEstimate,
        labelWidth: widthDots,
      }
    );
  }

  const barcode1X = barcode1Adjustment.adjustedX;
  const barcode1Y = mmToDots(Number(barcode1Layout.y));

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

  // Serial Text 1
  const serial1X = mmToDots(Number(serial1Layout.x));
  const serial1Y = mmToDots(Number(serial1Layout.y));
  const serial1ScaleX = clampScale(serial1Layout.scale, 'Serial Text 1 X');
  const serial1ScaleY = clampScale(serial1Layout.scale, 'Serial Text 1 Y');
  lines.push(`SETMAG ${serial1ScaleX} ${serial1ScaleY}`);
  lines.push(`TEXT 7 0 ${serial1X} ${serial1Y} ${leftSerial}`);
  lines.push(`SETMAG 1 1`);

  // Barcode 2 - with centering and clamp adjustment
  const barcode2HeightMm = Number(barcode2Layout.height);
  const barcode2Scale = barcode2Layout.scale;
  const barcode2Height = calculateBarcodeHeight(barcode2HeightMm, barcode2Scale, 'Barcode 2', dpi, 2);

  // Estimate barcode width and calculate centered X
  const barcode2WidthEstimate = estimateBarcodeWidthDots(rightSerial.length, barcodeWidth, barcodeRatio);
  const barcode2RequestedX = mmToDots(Number(barcode2Layout.x));
  const barcode2Adjustment = calculateCenteredBarcodeX(
    barcode2WidthEstimate,
    widthDots,
    barcode2RequestedX,
    2
  );

  // Log adjustment if barcode was clamped
  if (barcode2Adjustment.wasClamped || barcode2Adjustment.adjustedX !== barcode2RequestedX) {
    addLog(
      'warn',
      `Barcode 2 X position adjusted for centering/clipping prevention: ${barcode2RequestedX} → ${barcode2Adjustment.adjustedX} dots`,
      {
        category: 'barcode',
        barcodeIndex: 2,
        reasonCode: 'POSITION_ADJUSTED',
        originalX: barcode2RequestedX,
        adjustedX: barcode2Adjustment.adjustedX,
        estimatedWidth: barcode2WidthEstimate,
        labelWidth: widthDots,
      }
    );
  }

  const barcode2X = barcode2Adjustment.adjustedX;
  const barcode2Y = mmToDots(Number(barcode2Layout.y));

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

  // Serial Text 2
  const serial2X = mmToDots(Number(serial2Layout.x));
  const serial2Y = mmToDots(Number(serial2Layout.y));
  const serial2ScaleX = clampScale(serial2Layout.scale, 'Serial Text 2 X');
  const serial2ScaleY = clampScale(serial2Layout.scale, 'Serial Text 2 Y');
  lines.push(`SETMAG ${serial2ScaleX} ${serial2ScaleY}`);
  lines.push(`TEXT 7 0 ${serial2X} ${serial2Y} ${rightSerial}`);
  lines.push(`SETMAG 1 1`);

  lines.push('PRINT');

  addLog('info', 'Generated test print CPCL with explicit title', {
    category: 'printer',
    title,
    leftSerial,
    rightSerial,
  });

  return lines.join('\n');
}
