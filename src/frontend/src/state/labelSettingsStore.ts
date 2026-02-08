import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { LabelSettings as BackendLabelSettings, LayoutSettings } from '../backend';

interface LabelSettingsState {
  settings: BackendLabelSettings | null;
  setSettings: (settings: BackendLabelSettings) => void;
}

// Custom storage that handles BigInt serialization
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
    } catch {
      return null;
    }
  },
  setItem: (name: string, value: any) => {
    const str = JSON.stringify(value, (key, val) => {
      // Convert BigInt to string with 'n' suffix
      if (typeof val === 'bigint') {
        return val.toString() + 'n';
      }
      return val;
    });
    localStorage.setItem(name, str);
  },
  removeItem: (name: string) => {
    localStorage.removeItem(name);
  },
};

// Default layout settings
const createDefaultLayout = (x: number, y: number, width: number, height: number, fontSize: number): LayoutSettings => ({
  x: BigInt(x),
  y: BigInt(y),
  scale: 1.0,
  width: BigInt(width),
  height: BigInt(height),
  fontSize: BigInt(fontSize),
});

// Default settings optimized for 48x30mm label with best-fit layout
const defaultSettings: BackendLabelSettings = {
  widthMm: BigInt(48),
  heightMm: BigInt(30),
  barcodeType: 'CODE128',
  barcodeHeight: BigInt(8),
  spacing: BigInt(3),
  prefixMappings: [],
  // Title at top with good margins
  titleLayout: createDefaultLayout(2, 1, 44, 4, 10),
  // First barcode below title
  barcode1Layout: createDefaultLayout(2, 6, 44, 8, 8),
  // First serial text below first barcode
  serialText1Layout: createDefaultLayout(2, 15, 44, 2, 7),
  // Second barcode in middle
  barcode2Layout: createDefaultLayout(2, 18, 44, 8, 8),
  // Second serial text below second barcode
  serialText2Layout: createDefaultLayout(2, 27, 44, 2, 7),
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
  const titlePosition = Number(settings.titlePosition || 0);
  const fontSize = Number(settings.fontSize || 10);

  // Calculate positions based on old layout
  const titleY = titlePosition || 1;
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
    titleLayout: createDefaultLayout(2, titleY, widthMm - 4, 4, fontSize),
    barcode1Layout: createDefaultLayout(2, barcode1Y, widthMm - 4, barcodeHeight, 8),
    serialText1Layout: createDefaultLayout(2, serial1Y, widthMm - 4, 2, 7),
    barcode2Layout: createDefaultLayout(2, barcode2Y, widthMm - 4, barcodeHeight, 8),
    serialText2Layout: createDefaultLayout(2, serial2Y, widthMm - 4, 2, 7),
  };
}

const useSettingsStore = create<LabelSettingsState>()(
  persist(
    (set) => ({
      settings: defaultSettings,
      setSettings: (settings) => {
        const migratedSettings = migrateSettings(settings);
        set({ settings: migratedSettings });
      },
    }),
    {
      name: 'label-settings',
      storage: createJSONStorage(() => bigIntStorage),
      // Migrate on load
      onRehydrateStorage: () => (state) => {
        if (state?.settings) {
          state.settings = migrateSettings(state.settings);
        }
      },
    }
  )
);

// Export a non-hook setter for use in mutation callbacks
export function updatePersistedSettings(settings: BackendLabelSettings) {
  const migratedSettings = migrateSettings(settings);
  useSettingsStore.getState().setSettings(migratedSettings);
}

// Export a non-hook getter for current settings
export function getCurrentSettings(): BackendLabelSettings | null {
  return useSettingsStore.getState().settings;
}

export function useLabelSettings() {
  const { settings, setSettings } = useSettingsStore();

  return { 
    settings, 
    setSettings,
    isLoading: false,
  };
}
