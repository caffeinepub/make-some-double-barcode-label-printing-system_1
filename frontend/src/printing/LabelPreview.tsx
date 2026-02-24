import React, { useMemo } from 'react';
import { useLabelSettingsStore } from '../state/labelSettingsStore';
import { generateBarcodeSvgDataUrl } from './barcodePreview';
import { mmToPx, mmToDots, dotsToPx } from './previewUnits';

interface LabelPreviewProps {
  leftSerial: string;
  rightSerial: string;
  title?: string;
}

export default function LabelPreview({ leftSerial, rightSerial, title }: LabelPreviewProps) {
  const { settings } = useLabelSettingsStore();

  const labelWidthPx = mmToPx(settings.widthMm);
  const labelHeightPx = mmToPx(settings.heightMm);

  const barcodeHeightPx = mmToPx(settings.barcodeHeight);
  const barcodeWidth = settings.barcodeWidth ?? 2;

  // Barcode 1 layout
  const b1 = settings.barcode1Position;
  const b1xPx = mmToPx(b1.xMm) + mmToPx(settings.globalHorizontalOffsetMm);
  const b1yPx = mmToPx(b1.yMm) + mmToPx(settings.globalVerticalOffsetMm);
  const b1TextYPx = b1yPx + barcodeHeightPx + mmToPx(b1.textSpacingMm);

  // Barcode 2 layout
  const b2 = settings.barcode2Position;
  const b2xPx = mmToPx(b2.xMm) + mmToPx(settings.globalHorizontalOffsetMm);
  const b2yPx = mmToPx(b2.yMm) + mmToPx(settings.globalVerticalOffsetMm);
  const b2TextYPx = b2yPx + barcodeHeightPx + mmToPx(b2.textSpacingMm);

  // Enforce minimum 1mm spacing between serial text and next barcode
  const minSpacingPx = mmToPx(1);
  const serial1FontSizePx = mmToPx(settings.serialFontSize);
  const serial1BottomPx = b1TextYPx + serial1FontSizePx;
  const adjustedB2yPx = Math.max(b2yPx, serial1BottomPx + minSpacingPx);

  const barcodeWidthPx = labelWidthPx - b1xPx * 2;

  const barcode1Url = useMemo(
    () => generateBarcodeSvgDataUrl(leftSerial || 'SAMPLE001', barcodeWidthPx, barcodeHeightPx, barcodeWidth),
    [leftSerial, barcodeWidthPx, barcodeHeightPx, barcodeWidth]
  );

  const barcode2Url = useMemo(
    () => generateBarcodeSvgDataUrl(rightSerial || 'SAMPLE002', barcodeWidthPx, barcodeHeightPx, barcodeWidth),
    [rightSerial, barcodeWidthPx, barcodeHeightPx, barcodeWidth]
  );

  const titleFontSizePx = mmToPx(settings.titleFontSize);
  const serialFontSizePx = mmToPx(settings.serialFontSize);

  // Title position: top of label with global offset
  const titleYPx = mmToPx(settings.globalVerticalOffsetMm) + titleFontSizePx + 2;

  return (
    <div
      className="relative bg-white border border-border shadow-md overflow-hidden"
      style={{
        width: `${labelWidthPx}px`,
        height: `${labelHeightPx}px`,
        fontFamily: 'monospace',
      }}
    >
      {/* Title */}
      {title && (
        <div
          className="absolute left-0 right-0 text-center text-black font-bold overflow-hidden whitespace-nowrap"
          style={{
            top: `${titleYPx - titleFontSizePx}px`,
            fontSize: `${titleFontSizePx}px`,
            lineHeight: `${titleFontSizePx + 2}px`,
            paddingLeft: `${mmToPx(1)}px`,
            paddingRight: `${mmToPx(1)}px`,
          }}
        >
          {title}
        </div>
      )}

      {/* Barcode 1 */}
      <img
        src={barcode1Url}
        alt="Barcode 1"
        className="absolute"
        style={{
          left: `${b1xPx}px`,
          top: `${b1yPx}px`,
          width: `${barcodeWidthPx}px`,
          height: `${barcodeHeightPx}px`,
          imageRendering: 'pixelated',
        }}
      />
      {/* Serial 1 text */}
      <div
        className="absolute left-0 right-0 text-center text-black overflow-hidden whitespace-nowrap"
        style={{
          top: `${b1TextYPx}px`,
          fontSize: `${serialFontSizePx}px`,
          lineHeight: `${serialFontSizePx + 1}px`,
        }}
      >
        {leftSerial || 'SAMPLE001'}
      </div>

      {/* Barcode 2 */}
      <img
        src={barcode2Url}
        alt="Barcode 2"
        className="absolute"
        style={{
          left: `${b2xPx}px`,
          top: `${adjustedB2yPx}px`,
          width: `${barcodeWidthPx}px`,
          height: `${barcodeHeightPx}px`,
          imageRendering: 'pixelated',
        }}
      />
      {/* Serial 2 text */}
      <div
        className="absolute left-0 right-0 text-center text-black overflow-hidden whitespace-nowrap"
        style={{
          top: `${adjustedB2yPx + barcodeHeightPx + mmToPx(b2.textSpacingMm)}px`,
          fontSize: `${serialFontSizePx}px`,
          lineHeight: `${serialFontSizePx + 1}px`,
        }}
      >
        {rightSerial || 'SAMPLE002'}
      </div>

      {/* Label dimension indicator */}
      <div
        className="absolute bottom-0 right-0 text-black opacity-30"
        style={{ fontSize: '6px', padding: '1px 2px' }}
      >
        {settings.widthMm}×{settings.heightMm}mm
      </div>
    </div>
  );
}
