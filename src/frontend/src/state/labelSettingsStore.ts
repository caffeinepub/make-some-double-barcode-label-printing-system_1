import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LabelSettings as BackendLabelSettings, LayoutSettings, BarcodePosition } from '../backend';

// Extended settings with calibration offsets
export interface ExtendedLabelSettings extends BackendLabelSettings {
  calibrationOffsetXmm?: number;
  calibrationOffsetYmm?: number;
}

interface LabelSettingsState {
  settings: ExtendedLabelSettings;
  setSettings: (settings: ExtendedLabelSettings) => void;
  resetToDefaults: () => void;
}

// Default layout settings
const createDefaultLayout = (x: number, y: number, width: number, height: number, fontSize: number, verticalSpacing: number = 0): LayoutSettings => ({
  x: BigInt(x),
  y: BigInt(y),
  scale: 1.0,
  width: BigInt(width),
  height: BigInt(height),
  fontSize: BigInt(fontSize),
  verticalSpacing: BigInt(verticalSpacing),
});

// Default barcode position
const createDefaultBarcodePosition = (x: number, y: number, verticalSpacing: number): BarcodePosition => ({
  x: BigInt(x),
  y: BigInt(y),
  verticalSpacing: BigInt(verticalSpacing),
});

// Updated default settings for 58mm × 43mm label matching reference photo layout:
// - Primary barcode at top (y=2mm) with serial text 1mm below
// - Secondary barcode in middle (y=14mm) with serial text 1mm below
const defaultSettings: ExtendedLabelSettings = {
  widthMm: BigInt(58),
  heightMm: BigInt(43),
  barcodeType: 'CODE128',
  barcodeHeight: BigInt(8),
  spacing: BigInt(3),
  prefixMappings: [],
  // Title at top
  titleLayout: createDefaultLayout(2, 1, 54, 4, 10, 0),
  // Barcode layouts (kept for backward compatibility but positions control actual placement)
  barcode1Layout: createDefaultLayout(2, 2, 54, 8, 8, 0),
  serialText1Layout: createDefaultLayout(2, 11, 54, 2, 7, 0),
  barcode2Layout: createDefaultLayout(2, 14, 54, 8, 8, 0),
  serialText2Layout: createDefaultLayout(2, 23, 54, 2, 7, 0),
  // Barcode positions - these control actual placement
  barcode1Position: createDefaultBarcodePosition(2, 2, 1),  // Top barcode, 1mm spacing to text
  barcode2Position: createDefaultBarcodePosition(2, 14, 1), // Middle barcode, 1mm spacing to text
  // Global offsets
  globalVerticalOffset: BigInt(0),
  globalHorizontalOffset: BigInt(0),
  // Calibration offsets
  calibrationOffsetXmm: 0,
  calibrationOffsetYmm: 0,
};

// Custom storage that handles BigInt serialization with corruption fallback
const bigIntStorage = {
  getItem: (name: string) => {
    const str = localStorage.getItem(name);
    if (!str) return null;
    try {
      return JSON.parse(str, (key, value) => {
        // Convert string representations back to BigInt
        if (typeof value === 'string' && /^\d+n$/.test(value)) {
          return BigInt(value.slice(0, -1));
        }
        return value;
      });
    } catch (error) {
      console.warn('Failed to parse label settings from localStorage, clearing corrupted data:', error);
      // Clear corrupted data
      localStorage.removeItem(name);
      return null;
    }
  },
  setItem: (name: string, value: any) => {
    try {
      const str = JSON.stringify(value, (key, val) => {
        // Convert BigInt to string with 'n' suffix
        if (typeof val === 'bigint') {
          return val.toString() + 'n';
        }
        return val;
      });
      localStorage.setItem(name, str);
    } catch (error) {
      console.error('Failed to save label settings to localStorage:', error);
    }
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

// Migration function to convert old settings to new layout structure
function migrateSettings(settings: any, version: number): ExtendedLabelSettings {
  // Ensure barcode positions exist
  if (!settings.barcode1Position || !settings.barcode2Position) {
    return {
      ...settings,
      widthMm: BigInt(58),
      heightMm: BigInt(43),
      barcode1Position: settings.barcode1Position || createDefaultBarcodePosition(2, 2, 1),
      barcode2Position: settings.barcode2Position || createDefaultBarcodePosition(2, 14, 1),
      calibrationOffsetXmm: settings.calibrationOffsetXmm ?? 0,
      calibrationOffsetYmm: settings.calibrationOffsetYmm ?? 0,
    } as ExtendedLabelSettings;
  }

  // Ensure calibration offsets exist and update dimensions to 58×43
  return {
    ...settings,
    widthMm: BigInt(58),
    heightMm: BigInt(43),
    calibrationOffsetXmm: settings.calibrationOffsetXmm ?? 0,
    calibrationOffsetYmm: settings.calibrationOffsetYmm ?? 0,
  } as ExtendedLabelSettings;
}

export const useLabelSettings = create<LabelSettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      setSettings: (settings) => set({ settings }),
      resetToDefaults: () => set({ settings: defaultSettings }),
    }),
    {
      name: 'label-settings',
      storage: createJSONStorage(() => bigIntStorage),
      version: 6, // Bumped to 6 for 58×43mm dimensions
      migrate: (persistedState: any, version: number) => {
        if (version < 6) {
          // Migrate old settings to include barcode positions and new dimensions
          const migratedSettings = persistedState.settings
            ? migrateSettings(persistedState.settings, version)
            : defaultSettings;
          return {
            settings: migratedSettings,
          };
        }
        return persistedState as LabelSettingsState;
      },
      // Fallback to defaults if hydration fails
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('Failed to rehydrate label settings, using defaults:', error);
          // Store will already have defaultSettings from initial state
        }
      },
    }
  )
);

/**
 * Get current settings synchronously (for use outside React components)
 */
export function getCurrentSettings(): ExtendedLabelSettings {
  return useLabelSettings.getState().settings;
}

/**
 * Update persisted settings directly (for use in components)
 */
export function updatePersistedSettings(settings: ExtendedLabelSettings): void {
  useLabelSettings.getState().setSettings(settings);
}

/**
 * Reset settings to defaults (for recovery)
 */
export function resetSettingsToDefaults(): void {
  useLabelSettings.getState().resetToDefaults();
}
