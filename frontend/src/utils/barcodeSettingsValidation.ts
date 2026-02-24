import { LabelSettings } from '../state/labelSettingsStore';

export interface ValidationError {
  field: string;
  message: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

export function barcodeSettingsValidation(settings: LabelSettings): ValidationResult {
  const errors: ValidationError[] = [];

  // Barcode height validation
  if (settings.barcodeHeight < 5 || settings.barcodeHeight > 30) {
    errors.push({
      field: 'barcodeHeight',
      message: 'Barcode height must be between 5mm and 30mm.',
    });
  }

  // Barcode width validation (1–10 dots)
  if (
    settings.barcodeWidth === undefined ||
    settings.barcodeWidth === null ||
    !Number.isInteger(settings.barcodeWidth) ||
    settings.barcodeWidth < 1 ||
    settings.barcodeWidth > 10
  ) {
    errors.push({
      field: 'barcodeWidth',
      message: 'Barcode width must be between 1 and 10 dots.',
    });
  }

  // Label dimensions
  if (settings.widthMm < 20 || settings.widthMm > 200) {
    errors.push({
      field: 'widthMm',
      message: 'Label width must be between 20mm and 200mm.',
    });
  }
  if (settings.heightMm < 10 || settings.heightMm > 200) {
    errors.push({
      field: 'heightMm',
      message: 'Label height must be between 10mm and 200mm.',
    });
  }

  // Barcode positions within label bounds
  const b1 = settings.barcode1Position;
  const b2 = settings.barcode2Position;

  if (b1.yMm < 0 || b1.yMm >= settings.heightMm) {
    errors.push({
      field: 'barcode1Position.yMm',
      message: 'Barcode 1 Y position is outside the label boundaries.',
    });
  }
  if (b2.yMm < 0 || b2.yMm >= settings.heightMm) {
    errors.push({
      field: 'barcode2Position.yMm',
      message: 'Barcode 2 Y position is outside the label boundaries.',
    });
  }

  // Minimum 2mm spacing between barcodes
  const b1Bottom = b1.yMm + settings.barcodeHeight + b1.textSpacingMm + 3; // approx serial text height
  const b2Top = b2.yMm;
  if (b2Top - b1Bottom < 2) {
    errors.push({
      field: 'barcode2Position.yMm',
      message: 'Barcodes are too close together. Ensure at least 2mm spacing between them.',
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function getFieldError(result: ValidationResult, field: string): string | undefined {
  return result.errors.find((e) => e.field === field)?.message;
}
