import type { LabelSettings as BackendLabelSettings, LayoutSettings } from '../backend';

/**
 * Serialize label settings to a BigInt-safe JSON string for export
 */
export function exportLabelSettings(settings: BackendLabelSettings): string {
  return JSON.stringify(settings, (key, val) => {
    // Convert BigInt to string with 'n' suffix
    if (typeof val === 'bigint') {
      return val.toString() + 'n';
    }
    return val;
  }, 2);
}

/**
 * Create default layout settings
 */
function createDefaultLayout(x: number, y: number, width: number, height: number, fontSize: number): LayoutSettings {
  return {
    x: BigInt(x),
    y: BigInt(y),
    scale: 1.0,
    width: BigInt(width),
    height: BigInt(height),
    fontSize: BigInt(fontSize),
  };
}

/**
 * Migrate old settings structure to new layout-based structure
 */
function migrateOldSettings(parsed: any): BackendLabelSettings {
  // If already has new structure, return as-is
  if (parsed.titleLayout && parsed.barcode1Layout) {
    return parsed as BackendLabelSettings;
  }

  // Migrate from old structure
  const widthMm = Number(parsed.widthMm || 50);
  const heightMm = Number(parsed.heightMm || 25);
  const barcodeHeight = Number(parsed.barcodeHeight || 10);
  const spacing = Number(parsed.spacing || 5);
  const titlePosition = Number(parsed.titlePosition || 0);
  const fontSize = Number(parsed.fontSize || 12);

  // Calculate positions based on old layout
  const titleY = titlePosition || 2;
  const barcode1Y = titleY + 6;
  const serial1Y = barcode1Y + barcodeHeight + 1;
  const barcode2Y = serial1Y + spacing + 2;
  const serial2Y = barcode2Y + barcodeHeight + 1;

  return {
    widthMm: BigInt(widthMm),
    heightMm: BigInt(heightMm),
    barcodeType: parsed.barcodeType || 'CODE128',
    barcodeHeight: BigInt(barcodeHeight),
    spacing: BigInt(spacing),
    prefixMappings: parsed.prefixMappings || [],
    titleLayout: createDefaultLayout(2, titleY, widthMm - 4, 4, fontSize),
    barcode1Layout: createDefaultLayout(2, barcode1Y, widthMm - 4, barcodeHeight, 10),
    serialText1Layout: createDefaultLayout(2, serial1Y, widthMm - 4, 3, 8),
    barcode2Layout: createDefaultLayout(2, barcode2Y, widthMm - 4, barcodeHeight, 10),
    serialText2Layout: createDefaultLayout(2, serial2Y, widthMm - 4, 3, 8),
  };
}

/**
 * Parse and validate imported JSON into LabelSettings
 * Returns the parsed settings or throws an error with a descriptive message
 */
export function importLabelSettings(jsonString: string): BackendLabelSettings {
  let parsed: any;
  
  // Step 1: Parse JSON
  try {
    parsed = JSON.parse(jsonString, (key, value) => {
      // Convert string representations back to BigInt
      if (typeof value === 'string' && /^\d+n$/.test(value)) {
        return BigInt(value.slice(0, -1));
      }
      return value;
    });
  } catch (error) {
    throw new Error('Invalid JSON format. Please select a valid settings file.');
  }
  
  // Step 2: Check if migration is needed (old format)
  const needsMigration = !parsed.titleLayout || !parsed.barcode1Layout;
  
  if (needsMigration) {
    // Validate old format fields
    const oldRequiredFields = ['widthMm', 'heightMm', 'barcodeType', 'prefixMappings'];
    for (const field of oldRequiredFields) {
      if (!(field in parsed)) {
        throw new Error(`Missing required field: ${field}`);
      }
    }
    
    // Migrate to new format
    return migrateOldSettings(parsed);
  }
  
  // Step 3: Validate new format required fields
  const requiredFields = [
    'widthMm',
    'heightMm',
    'barcodeType',
    'barcodeHeight',
    'spacing',
    'prefixMappings',
    'titleLayout',
    'barcode1Layout',
    'serialText1Layout',
    'barcode2Layout',
    'serialText2Layout',
  ];
  
  for (const field of requiredFields) {
    if (!(field in parsed)) {
      throw new Error(`Missing required field: ${field}`);
    }
  }
  
  // Validate types
  if (typeof parsed.widthMm !== 'bigint') {
    throw new Error('Invalid type for widthMm (expected number)');
  }
  if (typeof parsed.heightMm !== 'bigint') {
    throw new Error('Invalid type for heightMm (expected number)');
  }
  if (typeof parsed.barcodeType !== 'string') {
    throw new Error('Invalid type for barcodeType (expected string)');
  }
  if (typeof parsed.barcodeHeight !== 'bigint') {
    throw new Error('Invalid type for barcodeHeight (expected number)');
  }
  if (typeof parsed.spacing !== 'bigint') {
    throw new Error('Invalid type for spacing (expected number)');
  }
  if (!Array.isArray(parsed.prefixMappings)) {
    throw new Error('Invalid type for prefixMappings (expected array)');
  }
  
  // Validate layout objects
  const layoutFields = ['titleLayout', 'barcode1Layout', 'serialText1Layout', 'barcode2Layout', 'serialText2Layout'];
  for (const layoutField of layoutFields) {
    const layout = parsed[layoutField];
    if (typeof layout !== 'object' || layout === null) {
      throw new Error(`Invalid ${layoutField} (expected object)`);
    }
    if (typeof layout.x !== 'bigint') {
      throw new Error(`Invalid ${layoutField}.x (expected number)`);
    }
    if (typeof layout.y !== 'bigint') {
      throw new Error(`Invalid ${layoutField}.y (expected number)`);
    }
    if (typeof layout.scale !== 'number') {
      throw new Error(`Invalid ${layoutField}.scale (expected number)`);
    }
    if (typeof layout.width !== 'bigint') {
      throw new Error(`Invalid ${layoutField}.width (expected number)`);
    }
    if (typeof layout.height !== 'bigint') {
      throw new Error(`Invalid ${layoutField}.height (expected number)`);
    }
    if (typeof layout.fontSize !== 'bigint') {
      throw new Error(`Invalid ${layoutField}.fontSize (expected number)`);
    }
  }
  
  // Step 4: Validate prefix mappings structure
  for (let i = 0; i < parsed.prefixMappings.length; i++) {
    const mapping = parsed.prefixMappings[i];
    
    if (!Array.isArray(mapping) || mapping.length !== 2) {
      throw new Error(`Invalid prefix mapping at index ${i} (expected [prefix, {labelType, title}])`);
    }
    
    const [prefix, details] = mapping;
    
    if (typeof prefix !== 'string') {
      throw new Error(`Invalid prefix at index ${i} (expected string)`);
    }
    
    if (typeof details !== 'object' || details === null) {
      throw new Error(`Invalid mapping details at index ${i} (expected object)`);
    }
    
    if (typeof details.labelType !== 'string') {
      throw new Error(`Invalid labelType at index ${i} (expected string)`);
    }
    
    if (typeof details.title !== 'string') {
      throw new Error(`Invalid title at index ${i} (expected string)`);
    }
  }
  
  return parsed as BackendLabelSettings;
}

/**
 * Validate prefix mappings for empty values and duplicates
 * Returns an error message or null if valid
 */
export function validatePrefixMappings(
  prefixMappings: Array<[string, { labelType: string; title: string }]>
): string | null {
  const prefixes = new Set<string>();
  
  for (const [prefix, mapping] of prefixMappings) {
    if (!prefix.trim()) {
      return 'All prefix mappings must have a prefix value';
    }
    if (!mapping.labelType.trim()) {
      return 'All prefix mappings must have a label type';
    }
    if (!mapping.title.trim()) {
      return 'All prefix mappings must have a title';
    }
    if (prefixes.has(prefix)) {
      return `Duplicate prefix found: ${prefix}`;
    }
    prefixes.add(prefix);
  }
  
  return null;
}

/**
 * Download settings as a JSON file
 */
export function downloadSettingsFile(settings: BackendLabelSettings, filename: string = 'label-settings.json') {
  const jsonString = exportLabelSettings(settings);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  
  URL.revokeObjectURL(url);
}

/**
 * Read and parse a settings file from user input
 */
export async function readSettingsFile(file: File): Promise<BackendLabelSettings> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const jsonString = e.target?.result as string;
        const settings = importLabelSettings(jsonString);
        resolve(settings);
      } catch (error: any) {
        reject(error);
      }
    };
    
    reader.onerror = () => {
      reject(new Error('Failed to read file'));
    };
    
    reader.readAsText(file);
  });
}
