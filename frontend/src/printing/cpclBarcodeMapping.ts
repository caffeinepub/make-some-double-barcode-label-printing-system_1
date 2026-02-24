/**
 * CPCL barcode symbology mapping and validation
 * 
 * Maps UI barcode types to CPCL printer tokens and provides
 * fallback behavior for unsupported types.
 */

export interface BarcodeMapping {
  cpclToken: string;
  displayName: string;
  recommendedWidth: number;
  recommendedRatio: number;
}

/**
 * Known-good CPCL barcode type mappings
 * Based on Zebra CPCL documentation
 */
const BARCODE_MAPPINGS: Record<string, BarcodeMapping> = {
  CODE128: {
    cpclToken: '128',
    displayName: 'Code 128',
    recommendedWidth: 2,
    recommendedRatio: 1, // 2.0:1 ratio
  },
  CODE39: {
    cpclToken: '39',
    displayName: 'Code 39',
    recommendedWidth: 2,
    recommendedRatio: 1,
  },
  EAN13: {
    cpclToken: 'EAN13',
    displayName: 'EAN-13',
    recommendedWidth: 2,
    recommendedRatio: 1,
  },
  EAN8: {
    cpclToken: 'EAN8',
    displayName: 'EAN-8',
    recommendedWidth: 2,
    recommendedRatio: 1,
  },
  UPCA: {
    cpclToken: 'UPCA',
    displayName: 'UPC-A',
    recommendedWidth: 2,
    recommendedRatio: 1,
  },
  UPCE: {
    cpclToken: 'UPCE',
    displayName: 'UPC-E',
    recommendedWidth: 2,
    recommendedRatio: 1,
  },
  I2OF5: {
    cpclToken: 'I2OF5',
    displayName: 'Interleaved 2 of 5',
    recommendedWidth: 2,
    recommendedRatio: 1,
  },
  CODABAR: {
    cpclToken: 'CODABAR',
    displayName: 'Codabar',
    recommendedWidth: 2,
    recommendedRatio: 1,
  },
};

/**
 * Default fallback mapping for unknown barcode types
 */
const FALLBACK_MAPPING: BarcodeMapping = {
  cpclToken: '128',
  displayName: 'Code 128 (Fallback)',
  recommendedWidth: 2,
  recommendedRatio: 1,
};

/**
 * Get CPCL barcode mapping for a given UI barcode type
 * Returns fallback mapping if type is not supported
 */
export function getBarcodeMapping(uiType: string): BarcodeMapping {
  const mapping = BARCODE_MAPPINGS[uiType.toUpperCase()];
  if (!mapping) {
    return FALLBACK_MAPPING;
  }
  return mapping;
}

/**
 * Check if a barcode type is supported
 */
export function isBarcodeTypeSupported(uiType: string): boolean {
  return uiType.toUpperCase() in BARCODE_MAPPINGS;
}

/**
 * Get list of all supported barcode types
 */
export function getSupportedBarcodeTypes(): string[] {
  return Object.keys(BARCODE_MAPPINGS);
}
