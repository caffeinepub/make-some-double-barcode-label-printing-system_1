import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LabelSettings as BackendLabelSettings } from '../backend';
import type { ExtendedLabelSettings } from '../state/labelSettingsStore';
import { generateBarcodeSVG } from './barcodePreview';
import { calculateLeftAlignedBarcodeX, estimateBarcodeWidthDots } from './cpclLayoutAdjustments';
import { getBarcodeMapping } from './cpclBarcodeMapping';
import { mmToPx, mmToDots, dotsToPx } from './previewUnits';

interface LabelPreviewProps {
  settings: BackendLabelSettings | ExtendedLabelSettings;
  sampleSerial1: string;
  sampleSerial2: string;
  previewTitle: string;
  onSampleSerial1Change: (value: string) => void;
  onSampleSerial2Change: (value: string) => void;
}

export default function LabelPreview({ 
  settings, 
  sampleSerial1, 
  sampleSerial2, 
  previewTitle,
  onSampleSerial1Change,
  onSampleSerial2Change
}: LabelPreviewProps) {
  const [zoom, setZoom] = useState(100);
  
  const widthMm = Number(settings.widthMm);
  const heightMm = Number(settings.heightMm);
  
  // Get all offsets
  const extendedSettings = settings as ExtendedLabelSettings;
  const globalHorizontalOffset = Number(settings.globalHorizontalOffset || 0);
  const globalVerticalOffset = Number(settings.globalVerticalOffset || 0);
  const calibrationOffsetXmm = extendedSettings.calibrationOffsetXmm ?? 0;
  const calibrationOffsetYmm = extendedSettings.calibrationOffsetYmm ?? 0;
  
  // Use authoritative mm-to-px conversion for true 48x30mm sizing
  const widthPx = mmToPx(widthMm);
  const heightPx = mmToPx(heightMm);
  const widthDots = mmToDots(widthMm);

  // Get barcode parameters for width estimation
  const barcodeMapping = getBarcodeMapping(settings.barcodeType);
  const barcodeWidth = barcodeMapping.recommendedWidth;
  const barcodeRatio = barcodeMapping.recommendedRatio;

  // Apply all offsets to a position
  const applyAllOffsets = (xMm: number, yMm: number) => ({
    x: xMm + globalHorizontalOffset + calibrationOffsetXmm,
    y: yMm + globalVerticalOffset + calibrationOffsetYmm,
  });

  // Helper to convert layout settings to pixels with clamp adjustment and all offsets
  const layoutToPx = (layout: any, serial: string, barcodeIndex: 1 | 2 | null) => {
    // Apply all offsets to base position (in mm)
    const offsetPos = applyAllOffsets(Number(layout.x), Number(layout.y));
    
    const basePx = {
      x: mmToPx(offsetPos.x),
      y: mmToPx(offsetPos.y),
      width: mmToPx(Number(layout.width)),
      height: mmToPx(Number(layout.height)),
      fontSize: Number(layout.fontSize) * layout.scale,
      scale: layout.scale,
    };

    // Apply clamp adjustment for barcodes (matching CPCL generator)
    if (barcodeIndex) {
      const estimatedWidthDots = estimateBarcodeWidthDots(serial.length, barcodeWidth, barcodeRatio);
      const requestedXDots = mmToDots(offsetPos.x); // Left edge position in dots
      const adjustment = calculateLeftAlignedBarcodeX(estimatedWidthDots, widthDots, requestedXDots, barcodeIndex);
      // Convert adjusted dots back to preview pixels
      basePx.x = dotsToPx(adjustment.adjustedX);
    }

    return basePx;
  };

  // Title uses titleLayout
  const titlePx = layoutToPx(settings.titleLayout, '', null);
  
  // Barcode 1 uses barcode1Position
  const barcode1HeightMm = Number(settings.barcode1Layout.height);
  const barcode1PositionLayout = {
    x: settings.barcode1Position.x,
    y: settings.barcode1Position.y,
    width: settings.barcode1Layout.width,
    height: settings.barcode1Layout.height,
    fontSize: settings.barcode1Layout.fontSize,
    scale: settings.barcode1Layout.scale,
  };
  const barcode1Px = layoutToPx(barcode1PositionLayout, sampleSerial1, 1);
  
  // Serial 1 positioned below barcode 1 using verticalSpacing
  const serial1PositionLayout = {
    x: settings.barcode1Position.x,
    y: BigInt(Number(settings.barcode1Position.y) + barcode1HeightMm + Number(settings.barcode1Position.verticalSpacing)),
    width: settings.serialText1Layout.width,
    height: settings.serialText1Layout.height,
    fontSize: settings.serialText1Layout.fontSize,
    scale: settings.serialText1Layout.scale,
  };
  const serial1Px = layoutToPx(serial1PositionLayout, '', null);
  
  // Barcode 2 uses barcode2Position
  const barcode2HeightMm = Number(settings.barcode2Layout.height);
  const barcode2PositionLayout = {
    x: settings.barcode2Position.x,
    y: settings.barcode2Position.y,
    width: settings.barcode2Layout.width,
    height: settings.barcode2Layout.height,
    fontSize: settings.barcode2Layout.fontSize,
    scale: settings.barcode2Layout.scale,
  };
  const barcode2Px = layoutToPx(barcode2PositionLayout, sampleSerial2, 2);
  
  // Serial 2 positioned below barcode 2 using verticalSpacing
  const serial2PositionLayout = {
    x: settings.barcode2Position.x,
    y: BigInt(Number(settings.barcode2Position.y) + barcode2HeightMm + Number(settings.barcode2Position.verticalSpacing)),
    width: settings.serialText2Layout.width,
    height: settings.serialText2Layout.height,
    fontSize: settings.serialText2Layout.fontSize,
    scale: settings.serialText2Layout.scale,
  };
  const serial2Px = layoutToPx(serial2PositionLayout, '', null);

  // Generate barcode SVGs with estimated width for accurate preview
  const barcode1WidthDots = estimateBarcodeWidthDots(sampleSerial1.length, barcodeWidth, barcodeRatio);
  const barcode2WidthDots = estimateBarcodeWidthDots(sampleSerial2.length, barcodeWidth, barcodeRatio);
  
  const barcode1SVG = generateBarcodeSVG(
    sampleSerial1,
    settings.barcodeType,
    dotsToPx(barcode1WidthDots),
    barcode1Px.height
  );
  
  const barcode2SVG = generateBarcodeSVG(
    sampleSerial2,
    settings.barcodeType,
    dotsToPx(barcode2WidthDots),
    barcode2Px.height
  );

  const handleZoomIn = () => {
    setZoom(Math.min(zoom + 25, 200));
  };

  const handleZoomOut = () => {
    setZoom(Math.max(zoom - 25, 50));
  };

  const handleReset = () => {
    setZoom(100);
  };

  const zoomFactor = zoom / 100;

  return (
    <div className="space-y-4">
      {/* Sample Serial Inputs */}
      <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
        <div className="space-y-2">
          <Label htmlFor="sample-serial-1" className="text-sm">
            Sample Serial 1
          </Label>
          <Input
            id="sample-serial-1"
            value={sampleSerial1}
            onChange={(e) => onSampleSerial1Change(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="sample-serial-2" className="text-sm">
            Sample Serial 2
          </Label>
          <Input
            id="sample-serial-2"
            value={sampleSerial2}
            onChange={(e) => onSampleSerial2Change(e.target.value)}
            className="font-mono"
          />
        </div>
      </div>

      {/* Zoom Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomOut}
            disabled={zoom <= 50}
            className="h-9 w-9 p-0"
          >
            <ZoomOut className="w-4 h-4" />
          </Button>
          <span className="text-sm font-medium min-w-[4rem] text-center text-green-400">
            {zoom}%
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleZoomIn}
            disabled={zoom >= 200}
            className="h-9 w-9 p-0"
          >
            <ZoomIn className="w-4 h-4" />
          </Button>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleReset}
          className="gap-2"
        >
          <RotateCcw className="w-4 h-4" />
          Reset
        </Button>
      </div>

      {/* Preview Container */}
      <div className="flex justify-center items-center p-6 bg-muted/30 rounded-lg overflow-auto min-h-[400px]">
        <div
          style={{
            transform: `scale(${zoomFactor})`,
            transformOrigin: 'center center',
          }}
        >
          {/* Label Canvas - true 48x30mm size at 100% zoom */}
          <div
            className="bg-white border-2 border-gray-400 relative shadow-lg"
            style={{
              width: `${widthPx}px`,
              height: `${heightPx}px`,
            }}
          >
            {/* Title */}
            <div
              className="absolute text-black font-bold leading-none"
              style={{
                left: `${titlePx.x}px`,
                top: `${titlePx.y}px`,
                fontSize: `${titlePx.fontSize}px`,
                width: `${titlePx.width}px`,
                height: `${titlePx.height}px`,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {previewTitle}
            </div>

            {/* Barcode 1 */}
            <div
              className="absolute overflow-hidden"
              style={{
                left: `${barcode1Px.x}px`,
                top: `${barcode1Px.y}px`,
                width: `${dotsToPx(barcode1WidthDots)}px`,
                height: `${barcode1Px.height}px`,
              }}
              dangerouslySetInnerHTML={{ __html: barcode1SVG }}
            />

            {/* Serial Text 1 */}
            <div
              className="absolute text-black font-mono leading-none"
              style={{
                left: `${serial1Px.x}px`,
                top: `${serial1Px.y}px`,
                fontSize: `${serial1Px.fontSize}px`,
                width: `${serial1Px.width}px`,
                height: `${serial1Px.height}px`,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {sampleSerial1}
            </div>

            {/* Barcode 2 */}
            <div
              className="absolute overflow-hidden"
              style={{
                left: `${barcode2Px.x}px`,
                top: `${barcode2Px.y}px`,
                width: `${dotsToPx(barcode2WidthDots)}px`,
                height: `${barcode2Px.height}px`,
              }}
              dangerouslySetInnerHTML={{ __html: barcode2SVG }}
            />

            {/* Serial Text 2 */}
            <div
              className="absolute text-black font-mono leading-none"
              style={{
                left: `${serial2Px.x}px`,
                top: `${serial2Px.y}px`,
                fontSize: `${serial2Px.fontSize}px`,
                width: `${serial2Px.width}px`,
                height: `${serial2Px.height}px`,
                display: 'flex',
                alignItems: 'center',
              }}
            >
              {sampleSerial2}
            </div>
          </div>
        </div>
      </div>

      {/* Help Text */}
      <div className="text-xs text-muted-foreground space-y-1">
        <p>• Preview shows exactly how the label will print (true 48×30mm at 100% zoom)</p>
        <p>• Barcodes are positioned with minimal margins to prevent clipping</p>
        <p>• Edit sample serials above to see different barcodes</p>
        <p>• Adjust settings below to customize layout</p>
      </div>
    </div>
  );
}
