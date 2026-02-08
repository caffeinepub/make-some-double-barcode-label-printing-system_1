import type { LabelSettings as BackendLabelSettings } from '../backend';

/**
 * Generate a test print CPCL payload with safe defaults
 */
export function generateTestPrintCPCL(): string {
  const lines: string[] = [];
  lines.push('! 0 200 200 240 1');
  lines.push('PAGE-WIDTH 384');
  lines.push('TEXT 4 0 20 20 TEST PRINT');
  lines.push('TEXT 4 0 20 60 Label Printer');
  lines.push('TEXT 4 0 20 100 Connection OK');
  lines.push('BARCODE CODE128 0 1 60 20 140 TEST123');
  lines.push('PRINT');
  return lines.join('\n');
}

/**
 * Generate CPCL commands from label settings and serial data
 */
export function generateCPCL(
  settings: BackendLabelSettings,
  leftSerial: string,
  rightSerial: string,
  prefix: string
): string {
  const mappings = new Map(settings.prefixMappings);
  const mapping = mappings.get(prefix);
  const title = mapping?.title || 'Label';

  // Convert bigint to number and mm to dots (assuming 203 DPI)
  const dpi = 203;
  const widthMm = Number(settings.widthMm);
  const heightMm = Number(settings.heightMm);
  
  const widthDots = Math.round((widthMm / 25.4) * dpi);
  const heightDots = Math.round((heightMm / 25.4) * dpi);

  // Helper to convert mm to dots
  const mmToDots = (mm: number): number => Math.round((mm / 25.4) * dpi);

  // Extract layout settings
  const titleLayout = settings.titleLayout;
  const barcode1Layout = settings.barcode1Layout;
  const serial1Layout = settings.serialText1Layout;
  const barcode2Layout = settings.barcode2Layout;
  const serial2Layout = settings.serialText2Layout;

  // CPCL commands
  const lines: string[] = [];
  lines.push('! 0 200 200 ' + heightDots + ' 1');
  lines.push('PAGE-WIDTH ' + widthDots);
  
  // Title
  const titleX = mmToDots(Number(titleLayout.x));
  const titleY = mmToDots(Number(titleLayout.y));
  const titleFont = Math.round(Number(titleLayout.fontSize) * titleLayout.scale);
  lines.push(`SETMAG ${Math.round(titleLayout.scale)} ${Math.round(titleLayout.scale)}`);
  lines.push(`TEXT 4 0 ${titleX} ${titleY} ${title}`);
  lines.push(`SETMAG 1 1`);
  
  // Barcode 1
  const barcode1X = mmToDots(Number(barcode1Layout.x));
  const barcode1Y = mmToDots(Number(barcode1Layout.y));
  const barcode1Height = mmToDots(Number(barcode1Layout.height) * barcode1Layout.scale);
  lines.push(`BARCODE ${settings.barcodeType} 0 1 ${barcode1Height} ${barcode1X} ${barcode1Y} ${leftSerial}`);
  
  // Serial Text 1
  const serial1X = mmToDots(Number(serial1Layout.x));
  const serial1Y = mmToDots(Number(serial1Layout.y));
  const serial1Font = Math.round(Number(serial1Layout.fontSize) * serial1Layout.scale);
  lines.push(`SETMAG ${Math.round(serial1Layout.scale)} ${Math.round(serial1Layout.scale)}`);
  lines.push(`TEXT 7 0 ${serial1X} ${serial1Y} ${leftSerial}`);
  lines.push(`SETMAG 1 1`);
  
  // Barcode 2
  const barcode2X = mmToDots(Number(barcode2Layout.x));
  const barcode2Y = mmToDots(Number(barcode2Layout.y));
  const barcode2Height = mmToDots(Number(barcode2Layout.height) * barcode2Layout.scale);
  lines.push(`BARCODE ${settings.barcodeType} 0 1 ${barcode2Height} ${barcode2X} ${barcode2Y} ${rightSerial}`);
  
  // Serial Text 2
  const serial2X = mmToDots(Number(serial2Layout.x));
  const serial2Y = mmToDots(Number(serial2Layout.y));
  const serial2Font = Math.round(Number(serial2Layout.fontSize) * serial2Layout.scale);
  lines.push(`SETMAG ${Math.round(serial2Layout.scale)} ${Math.round(serial2Layout.scale)}`);
  lines.push(`TEXT 7 0 ${serial2X} ${serial2Y} ${rightSerial}`);
  lines.push(`SETMAG 1 1`);
  
  lines.push('PRINT');
  
  return lines.join('\n');
}
