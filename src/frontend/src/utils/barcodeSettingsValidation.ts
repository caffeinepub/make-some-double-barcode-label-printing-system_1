import type { LabelSettings as BackendLabelSettings } from '../backend';

/**
 * Supported CPCL barcode types
 */
const SUPPORTED_BARCODE_TYPES = [
  'CODE128',
  'CODE39',
  'EAN13',
  'EAN8',
  'UPC',
  'UPCA',
  'UPCE',
  'I2OF5',
  'CODABAR',
];

/**
 * Validate barcode and layout settings to ensure barcodes will be visible
 * Returns an error message or null if valid
 */
export function validateBarcodeSettings(settings: BackendLabelSettings): string | null {
  const dpi = 203;
  const mmToDots = (mm: number): number => Math.round((mm / 25.4) * dpi);

  // Validate barcode type
  if (!SUPPORTED_BARCODE_TYPES.includes(settings.barcodeType)) {
    return `Barcode type "${settings.barcodeType}" is not supported. Please use CODE128, CODE39, EAN13, EAN8, or UPC.`;
  }

  // Validate barcode 1 layout
  const barcode1Scale = settings.barcode1Layout.scale;
  const barcode1HeightMm = Number(settings.barcode1Layout.height);
  const barcode1HeightDots = mmToDots(barcode1HeightMm * barcode1Scale);

  if (barcode1Scale <= 0) {
    return 'Barcode 1 scale must be greater than 0. Please increase the scale value.';
  }

  if (barcode1HeightMm <= 0) {
    return 'Barcode 1 height must be greater than 0. Please increase the height value.';
  }

  if (barcode1HeightDots <= 0 || !isFinite(barcode1HeightDots)) {
    return 'Barcode 1 computed height is too small to print. Please increase height or scale.';
  }

  // Validate barcode 2 layout
  const barcode2Scale = settings.barcode2Layout.scale;
  const barcode2HeightMm = Number(settings.barcode2Layout.height);
  const barcode2HeightDots = mmToDots(barcode2HeightMm * barcode2Scale);

  if (barcode2Scale <= 0) {
    return 'Barcode 2 scale must be greater than 0. Please increase the scale value.';
  }

  if (barcode2HeightMm <= 0) {
    return 'Barcode 2 height must be greater than 0. Please increase the height value.';
  }

  if (barcode2HeightDots <= 0 || !isFinite(barcode2HeightDots)) {
    return 'Barcode 2 computed height is too small to print. Please increase height or scale.';
  }

  // Validate title scale
  if (settings.titleLayout.scale <= 0) {
    return 'Title scale must be greater than 0. Please increase the scale value.';
  }

  // Validate serial text scales
  if (settings.serialText1Layout.scale <= 0) {
    return 'Serial Text 1 scale must be greater than 0. Please increase the scale value.';
  }

  if (settings.serialText2Layout.scale <= 0) {
    return 'Serial Text 2 scale must be greater than 0. Please increase the scale value.';
  }

  // Validate spacing between elements
  const barcode1Y = Number(settings.barcode1Position.y);
  const barcode1Height = barcode1HeightMm * barcode1Scale;
  const barcode1BottomY = barcode1Y + barcode1Height;
  
  const barcode2Y = Number(settings.barcode2Position.y);
  
  // Check if barcodes overlap
  if (barcode1BottomY + 2 > barcode2Y) { // 2mm minimum spacing
    return 'Barcode 1 and Barcode 2 are too close together. Please increase vertical spacing between them (minimum 2mm gap recommended).';
  }

  // Validate barcode positions are within label bounds
  const labelHeightMm = Number(settings.heightMm);
  const barcode2Height = barcode2HeightMm * barcode2Scale;
  const barcode2BottomY = barcode2Y + barcode2Height + Number(settings.barcode2Position.verticalSpacing) + 3; // +3mm for text height
  
  if (barcode2BottomY > labelHeightMm) {
    return `Barcode 2 and its text extend beyond the label height (${labelHeightMm}mm). Please adjust barcode positions or reduce barcode heights.`;
  }

  return null;
}
