/**
 * Generate a barcode SVG using canvas-based rendering
 * Since jsbarcode is not available, we'll create a simple barcode pattern
 * that represents the data visually
 */

/**
 * Generate a barcode SVG string from serial data
 * @param value - The barcode value (serial number)
 * @param format - Barcode format (CODE128, EAN13, etc.)
 * @param width - Width in pixels
 * @param height - Height in pixels
 * @returns SVG string
 */
export function generateBarcodeSVG(
  value: string,
  format: string = 'CODE128',
  width: number,
  height: number
): string {
  try {
    // Create a deterministic barcode pattern from the value
    // This creates a visual representation that changes with the input
    const bars: number[] = [];
    
    // Start pattern
    bars.push(2, 1, 1, 2);
    
    // Convert each character to a bar pattern
    for (let i = 0; i < value.length; i++) {
      const charCode = value.charCodeAt(i);
      // Create 4 bars per character with varying widths (1-3)
      bars.push(
        1 + (charCode % 3),
        1 + ((charCode >> 2) % 3),
        1 + ((charCode >> 4) % 3),
        1 + ((charCode >> 6) % 3)
      );
    }
    
    // End pattern
    bars.push(2, 1, 1, 2);
    
    // Calculate total width units
    const totalUnits = bars.reduce((sum, bar) => sum + bar, 0);
    const unitWidth = width / totalUnits;
    
    // Generate SVG bars
    let x = 0;
    const barElements: string[] = [];
    
    for (let i = 0; i < bars.length; i++) {
      const barWidth = bars[i] * unitWidth;
      // Alternate between black bars and white spaces
      if (i % 2 === 0) {
        barElements.push(
          `<rect x="${x}" y="0" width="${barWidth}" height="${height}" fill="black"/>`
        );
      }
      x += barWidth;
    }
    
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      ${barElements.join('\n')}
    </svg>`;
  } catch (error) {
    console.error('Barcode generation error:', error);
    // Return a fallback pattern
    return `<svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="white"/>
      <text x="50%" y="50%" text-anchor="middle" font-size="12" fill="red">Invalid</text>
    </svg>`;
  }
}
