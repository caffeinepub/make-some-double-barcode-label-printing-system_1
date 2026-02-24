import { LabelSettings, DEFAULT_LABEL_SETTINGS, BarcodePosition } from '../state/labelSettingsStore';

// BigInt-safe JSON serialization
function replacer(_key: string, value: unknown): unknown {
  if (typeof value === 'bigint') {
    return { __bigint__: value.toString() };
  }
  return value;
}

function reviver(_key: string, value: unknown): unknown {
  if (
    typeof value === 'object' &&
    value !== null &&
    '__bigint__' in value &&
    typeof (value as Record<string, unknown>).__bigint__ === 'string'
  ) {
    return BigInt((value as Record<string, string>).__bigint__);
  }
  return value;
}

export function exportLabelSettings(settings: LabelSettings): string {
  return JSON.stringify(settings, replacer, 2);
}

export function importLabelSettings(json: string): LabelSettings {
  const parsed = JSON.parse(json, reviver) as Partial<LabelSettings>;

  // Migrate / backfill missing fields with defaults
  const barcode1Position: BarcodePosition = {
    xMm: parsed.barcode1Position?.xMm ?? DEFAULT_LABEL_SETTINGS.barcode1Position.xMm,
    yMm: parsed.barcode1Position?.yMm ?? DEFAULT_LABEL_SETTINGS.barcode1Position.yMm,
    textSpacingMm:
      parsed.barcode1Position?.textSpacingMm ??
      DEFAULT_LABEL_SETTINGS.barcode1Position.textSpacingMm,
  };

  const barcode2Position: BarcodePosition = {
    xMm: parsed.barcode2Position?.xMm ?? DEFAULT_LABEL_SETTINGS.barcode2Position.xMm,
    yMm: parsed.barcode2Position?.yMm ?? DEFAULT_LABEL_SETTINGS.barcode2Position.yMm,
    textSpacingMm:
      parsed.barcode2Position?.textSpacingMm ??
      DEFAULT_LABEL_SETTINGS.barcode2Position.textSpacingMm,
  };

  return {
    widthMm: parsed.widthMm ?? DEFAULT_LABEL_SETTINGS.widthMm,
    heightMm: parsed.heightMm ?? DEFAULT_LABEL_SETTINGS.heightMm,
    barcodeType: parsed.barcodeType ?? DEFAULT_LABEL_SETTINGS.barcodeType,
    barcodeHeight: parsed.barcodeHeight ?? DEFAULT_LABEL_SETTINGS.barcodeHeight,
    barcodeWidth: parsed.barcodeWidth ?? DEFAULT_LABEL_SETTINGS.barcodeWidth, // migration: default 2
    spacing: parsed.spacing ?? DEFAULT_LABEL_SETTINGS.spacing,
    titleFontSize: parsed.titleFontSize ?? DEFAULT_LABEL_SETTINGS.titleFontSize,
    serialFontSize: parsed.serialFontSize ?? DEFAULT_LABEL_SETTINGS.serialFontSize,
    globalVerticalOffsetMm:
      parsed.globalVerticalOffsetMm ?? DEFAULT_LABEL_SETTINGS.globalVerticalOffsetMm,
    globalHorizontalOffsetMm:
      parsed.globalHorizontalOffsetMm ?? DEFAULT_LABEL_SETTINGS.globalHorizontalOffsetMm,
    barcode1Position,
    barcode2Position,
    prefixMappings: parsed.prefixMappings ?? DEFAULT_LABEL_SETTINGS.prefixMappings,
  };
}
