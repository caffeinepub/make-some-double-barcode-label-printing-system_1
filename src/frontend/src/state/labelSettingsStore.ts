import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LabelSettings as BackendLabelSettings, LayoutSettings } from '../backend';

interface LabelSettingsState {
  settings: BackendLabelSettings;
  setSettings: (settings: BackendLabelSettings) => void;
  resetToDefaults: () => void;
}

// Default layout settings
const createDefaultLayout = (x: number, y: number, width: number, height: number, fontSize: number): LayoutSettings => ({
  x: BigInt(x),
  y: BigInt(y),
  scale: 1.0,
  width: BigInt(width),
  height: BigInt(height),
  fontSize: BigInt(fontSize),
});

// Default settings optimized for 48x30mm label with improved spacing
const defaultSettings: BackendLabelSettings = {
  widthMm: BigInt(48),
  heightMm: BigInt(30),
  barcodeType: 'CODE128',
  barcodeHeight: BigInt(8),
  spacing: BigInt(3),
  prefixMappings: [],
  // Title at top with good margins
  titleLayout: createDefaultLayout(2, 1, 44, 4, 10),
  // First barcode below title (centered via CPCL generator)
  barcode1Layout: createDefaultLayout(2, 6, 44, 8, 8),
  // First serial text below first barcode
  serialText1Layout: createDefaultLayout(2, 15, 44, 2, 7),
  // Second barcode moved down for better spacing (centered via CPCL generator)
  barcode2Layout: createDefaultLayout(2, 19, 44, 8, 8),
  // Second serial text moved down with barcode 2
  serialText2Layout: createDefaultLayout(2, 28, 44, 2, 7),
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
function migrateSettings(settings: any): BackendLabelSettings {
  // If already has new layout structure, return as-is
  if (settings.titleLayout && settings.barcode1Layout) {
    return settings as BackendLabelSettings;
  }

  // Migrate from old structure
  const widthMm = Number(settings.widthMm || 48);
  const heightMm = Number(settings.heightMm || 30);
  const barcodeHeight = Number(settings.barcodeHeight || 8);
  const spacing = Number(settings.spacing || 3);
  const fontSize = 7;

  // Calculate positions based on old logic
  const titleY = 1;
  const barcode1Y = titleY + 5;
  const serial1Y = barcode1Y + barcodeHeight + 1;
  const barcode2Y = serial1Y + spacing;
  const serial2Y = barcode2Y + barcodeHeight + 1;

  return {
    widthMm: BigInt(widthMm),
    heightMm: BigInt(heightMm),
    barcodeType: settings.barcodeType || 'CODE128',
    barcodeHeight: BigInt(barcodeHeight),
    spacing: BigInt(spacing),
    prefixMappings: settings.prefixMappings || [],
    titleLayout: createDefaultLayout(2, titleY, widthMm - 4, 4, 10),
    barcode1Layout: createDefaultLayout(2, barcode1Y, widthMm - 4, barcodeHeight, fontSize),
    serialText1Layout: createDefaultLayout(2, serial1Y, widthMm - 4, 2, fontSize),
    barcode2Layout: createDefaultLayout(2, barcode2Y, widthMm - 4, barcodeHeight, fontSize),
    serialText2Layout: createDefaultLayout(2, serial2Y, widthMm - 4, 2, fontSize),
  };
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
      version: 2,
      migrate: (persistedState: any, version: number) => {
        if (version === 0 || version === 1) {
          // Migrate old settings to new layout structure
          const migratedSettings = persistedState.settings
            ? migrateSettings(persistedState.settings)
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
export function getCurrentSettings(): BackendLabelSettings {
  return useLabelSettings.getState().settings;
}

/**
 * Update persisted settings directly (for use in components)
 */
export function updatePersistedSettings(settings: BackendLabelSettings): void {
  useLabelSettings.getState().setSettings(settings);
}

/**
 * Reset settings to defaults (for recovery)
 */
export function resetSettingsToDefaults(): void {
  useLabelSettings.getState().resetToDefaults();
}
