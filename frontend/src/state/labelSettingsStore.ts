import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface BarcodePosition {
  xMm: number;
  yMm: number;
  textSpacingMm: number;
}

export interface LabelSettings {
  widthMm: number;
  heightMm: number;
  barcodeType: string;
  barcodeHeight: number; // mm
  barcodeWidth: number;  // dots (1-10)
  spacing: number;
  titleFontSize: number;
  serialFontSize: number;
  globalVerticalOffsetMm: number;
  globalHorizontalOffsetMm: number;
  barcode1Position: BarcodePosition;
  barcode2Position: BarcodePosition;
  prefixMappings: Record<string, { labelType: string; title: string }>;
}

interface LabelSettingsState {
  settings: LabelSettings;
  updateSettings: (partial: Partial<LabelSettings>) => void;
  resetSettings: () => void;
}

export const DEFAULT_LABEL_SETTINGS: LabelSettings = {
  widthMm: 58,
  heightMm: 43,
  barcodeType: 'CODE128',
  barcodeHeight: 10,
  barcodeWidth: 2,
  spacing: 2,
  titleFontSize: 3,
  serialFontSize: 2,
  globalVerticalOffsetMm: 0,
  globalHorizontalOffsetMm: 0,
  barcode1Position: { xMm: 0, yMm: 6, textSpacingMm: 2 },
  barcode2Position: { xMm: 0, yMm: 20, textSpacingMm: 2 },
  prefixMappings: {},
};

const STORE_VERSION = 8;

export const useLabelSettingsStore = create<LabelSettingsState>()(
  persist(
    (set) => ({
      settings: DEFAULT_LABEL_SETTINGS,
      updateSettings: (partial) =>
        set((state) => ({
          settings: { ...state.settings, ...partial },
        })),
      resetSettings: () => set({ settings: DEFAULT_LABEL_SETTINGS }),
    }),
    {
      name: 'label-settings-store',
      version: STORE_VERSION,
      migrate: (persistedState: unknown, version: number) => {
        const state = persistedState as LabelSettingsState;
        let settings: LabelSettings = { ...DEFAULT_LABEL_SETTINGS, ...(state?.settings ?? {}) };

        // v7 → v8: add barcodeWidth if missing
        if (version < 8) {
          if (settings.barcodeWidth === undefined || settings.barcodeWidth === null) {
            settings = { ...settings, barcodeWidth: DEFAULT_LABEL_SETTINGS.barcodeWidth };
          }
        }

        return { ...state, settings };
      },
    }
  )
);

/**
 * Get current settings synchronously (for use outside React components)
 */
export function getCurrentSettings(): LabelSettings {
  return useLabelSettingsStore.getState().settings;
}
