import { useState } from 'react';
import { ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { LabelSettings as BackendLabelSettings } from '../backend';
import { generateBarcodeSVG } from './barcodePreview';

interface LabelPreviewProps {
  settings: BackendLabelSettings;
}

export default function LabelPreview({ settings }: LabelPreviewProps) {
  const [zoom, setZoom] = useState(100);
  
  // Sample serial inputs for preview
  const [sampleSerial1, setSampleSerial1] = useState('SSVSBM2H7M5JB1');
  const [sampleSerial2, setSampleSerial2] = useState('SSVSBM2H7M5JB2');

  // Scale factor for 1:1 display (1mm = 3.78px at 96 DPI)
  const MM_TO_PX = 3.78;
  
  const widthMm = Number(settings.widthMm);
  const heightMm = Number(settings.heightMm);
  const widthPx = widthMm * MM_TO_PX;
  const heightPx = heightMm * MM_TO_PX;

  // Get sample data from first prefix mapping
  const sampleTitle = settings.prefixMappings[0]?.[1]?.title || 'Dual Band';

  // Helper to convert layout settings to pixels
  const layoutToPx = (layout: any) => ({
    x: Number(layout.x) * MM_TO_PX,
    y: Number(layout.y) * MM_TO_PX,
    width: Number(layout.width) * MM_TO_PX,
    height: Number(layout.height) * MM_TO_PX,
    fontSize: Number(layout.fontSize) * layout.scale,
    scale: layout.scale,
  });

  const titlePx = layoutToPx(settings.titleLayout);
  const barcode1Px = layoutToPx(settings.barcode1Layout);
  const serial1Px = layoutToPx(settings.serialText1Layout);
  const barcode2Px = layoutToPx(settings.barcode2Layout);
  const serial2Px = layoutToPx(settings.serialText2Layout);

  // Generate barcode SVGs
  const barcode1SVG = generateBarcodeSVG(
    sampleSerial1,
    settings.barcodeType,
    barcode1Px.width,
    barcode1Px.height
  );
  
  const barcode2SVG = generateBarcodeSVG(
    sampleSerial2,
    settings.barcodeType,
    barcode2Px.width,
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
            onChange={(e) => setSampleSerial1(e.target.value)}
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
            onChange={(e) => setSampleSerial2(e.target.value)}
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
          {/* Label Canvas */}
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
              {sampleTitle}
            </div>

            {/* Barcode 1 */}
            <div
              className="absolute overflow-hidden"
              style={{
                left: `${barcode1Px.x}px`,
                top: `${barcode1Px.y}px`,
                width: `${barcode1Px.width}px`,
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
                width: `${barcode2Px.width}px`,
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
        <p>• Preview shows exactly how the label will print (1:1 scale at 100%)</p>
        <p>• Edit sample serials above to see different barcodes</p>
        <p>• Adjust settings below to customize layout</p>
      </div>
    </div>
  );
}
