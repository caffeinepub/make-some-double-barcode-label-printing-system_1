/**
 * Normalizes scanned serial numbers by trimming whitespace and removing
 * common scanner suffix characters (CR, LF, Tab) that may be appended
 * by barcode scanners.
 */
export function normalizeSerial(serial: string): string {
  // Trim leading/trailing whitespace
  let normalized = serial.trim();
  
  // Remove common scanner suffix characters
  // \r (CR), \n (LF), \t (Tab)
  normalized = normalized.replace(/[\r\n\t]+$/g, '');
  
  return normalized;
}
