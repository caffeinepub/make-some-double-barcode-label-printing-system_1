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

  return null;
}
