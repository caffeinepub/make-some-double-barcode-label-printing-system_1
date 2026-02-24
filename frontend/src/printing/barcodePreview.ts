/**
 * Generates a deterministic SVG barcode pattern from serial data.
 * Accepts an optional barWidth (dots, 1-10) to scale bar widths.
 */
export function generateBarcodeSvg(
  serial: string,
  widthPx: number,
  heightPx: number,
  barWidth: number = 2
): string {
  // Clamp barWidth to valid range
  const clampedBarWidth = Math.max(1, Math.min(10, Math.round(barWidth)));

  // Generate a deterministic bit pattern from the serial string
  const bits: number[] = [];
  // Always start with a quiet zone + start pattern
  bits.push(0, 0, 1, 0, 1, 1, 0); // start guard

  for (let i = 0; i < serial.length; i++) {
    const code = serial.charCodeAt(i);
    // Encode each character as 9 bits (Code 128 style simulation)
    for (let b = 8; b >= 0; b--) {
      bits.push((code >> b) & 1);
    }
  }

  // End guard
  bits.push(1, 1, 0, 1, 0, 1, 0, 0);

  // Scale bar width based on barWidth setting (1 dot = base unit)
  // Base unit: fit all bits into widthPx at barWidth=2
  const totalBits = bits.length;
  const baseUnitPx = widthPx / (totalBits * 2); // at barWidth=2, fills width
  const unitPx = baseUnitPx * clampedBarWidth;

  // Build SVG rects
  const rects: string[] = [];
  let x = 0;

  for (let i = 0; i < bits.length; i++) {
    const barW = unitPx;
    if (bits[i] === 1) {
      rects.push(
        `<rect x="${x.toFixed(2)}" y="0" width="${barW.toFixed(2)}" height="${heightPx}" fill="#000"/>`
      );
    }
    x += barW;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${widthPx}" height="${heightPx}" viewBox="0 0 ${widthPx} ${heightPx}" shape-rendering="crispEdges">${rects.join('')}</svg>`;
}

export function generateBarcodeSvgDataUrl(
  serial: string,
  widthPx: number,
  heightPx: number,
  barWidth: number = 2
): string {
  const svg = generateBarcodeSvg(serial, widthPx, heightPx, barWidth);
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
