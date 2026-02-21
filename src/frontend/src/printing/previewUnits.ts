/**
 * Shared preview and CPCL unit conversion constants
 * Single source of truth for mm-to-px and dots-to-px conversions
 */

// DPI for CPCL printer (203 DPI standard for thermal printers)
export const DPI = 203;

// CSS pixels per inch (standard browser assumption)
export const CSS_PX_PER_INCH = 96;

// Millimeters per inch
export const MM_PER_INCH = 25.4;

// Authoritative mm-to-px conversion for preview rendering
// At 96 CSS px/inch: 1mm = 96/25.4 ≈ 3.7795 px
export const MM_TO_PX = CSS_PX_PER_INCH / MM_PER_INCH;

// Convert mm to printer dots (203 DPI)
export function mmToDots(mm: number): number {
  return Math.round((mm / MM_PER_INCH) * DPI);
}

// Convert printer dots to preview pixels
// dots * (25.4mm/inch / 203 dots/inch) * (96 px/inch / 25.4mm/inch)
export function dotsToPx(dots: number): number {
  return dots * (MM_PER_INCH / DPI) * MM_TO_PX;
}

// Convert mm to preview pixels (direct)
export function mmToPx(mm: number): number {
  return mm * MM_TO_PX;
}
