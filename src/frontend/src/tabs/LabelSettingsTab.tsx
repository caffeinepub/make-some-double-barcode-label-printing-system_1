import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Plus, Trash2, X, Download, Upload, RotateCcw, Printer, Target } from 'lucide-react';
import { useLabelSettings, updatePersistedSettings, resetSettingsToDefaults, type ExtendedLabelSettings } from '../state/labelSettingsStore';
import { useLabelSettingsHydration } from '../state/useLabelSettingsHydration';
import LabelPreview from '../printing/LabelPreview';
import SoundEffectsSettings from '../components/SoundEffectsSettings';
import { toast } from 'sonner';
import { getAllLabelTypes, getLabelTypeDisplayName } from '../utils/labelTypes';
import type { LayoutSettings } from '../backend';
import {
  downloadSettingsFile,
  readSettingsFile,
  validatePrefixMappings,
} from '../utils/labelSettingsImportExport';
import { validateBarcodeSettings } from '../utils/barcodeSettingsValidation';
import { usePrinterService } from '../services/printerService';
import { generateCPCLWithTitle, generateCalibrationPatternCPCL } from '../printing/cpclGenerator';
import { addLog } from '../state/logStore';

export default function LabelSettingsTab() {
  const { settings } = useLabelSettings();
  const hasHydrated = useLabelSettingsHydration();
  const { isConnected, sendCPCL } = usePrinterService();
  
  const [widthMm, setWidthMm] = useState(48);
  const [heightMm, setHeightMm] = useState(30);
  const [barcodeType, setBarcodeType] = useState('CODE128');
  const [barcodeHeight, setBarcodeHeight] = useState(8);
  const [spacing, setSpacing] = useState(3);
  const [prefixMappings, setPrefixMappings] = useState<Array<[string, { labelType: string; title: string }]>>([]);
  
  // Calibration offsets
  const [calibrationOffsetXmm, setCalibrationOffsetXmm] = useState(0);
  const [calibrationOffsetYmm, setCalibrationOffsetYmm] = useState(0);
  
  // Layout settings for each element - updated defaults for left-aligned layout
  const [titleLayout, setTitleLayout] = useState<LayoutSettings>({
    x: BigInt(2),
    y: BigInt(1),
    scale: 1.0,
    width: BigInt(44),
    height: BigInt(4),
    fontSize: BigInt(10),
  });
  
  const [barcode1Layout, setBarcode1Layout] = useState<LayoutSettings>({
    x: BigInt(2),
    y: BigInt(6),
    scale: 1.0,
    width: BigInt(44),
    height: BigInt(8),
    fontSize: BigInt(8),
  });
  
  const [serialText1Layout, setSerialText1Layout] = useState<LayoutSettings>({
    x: BigInt(2),
    y: BigInt(15),
    scale: 1.0,
    width: BigInt(44),
    height: BigInt(2),
    fontSize: BigInt(7),
  });
  
  const [barcode2Layout, setBarcode2Layout] = useState<LayoutSettings>({
    x: BigInt(2),
    y: BigInt(18),
    scale: 1.0,
    width: BigInt(44),
    height: BigInt(8),
    fontSize: BigInt(8),
  });
  
  const [serialText2Layout, setSerialText2Layout] = useState<LayoutSettings>({
    x: BigInt(2),
    y: BigInt(27),
    scale: 1.0,
    width: BigInt(44),
    height: BigInt(2),
    fontSize: BigInt(7),
  });
  
  // Custom label types management
  const [customTypes, setCustomTypes] = useState<string[]>([]);
  const [newCustomType, setNewCustomType] = useState('');
  
  // File input ref for import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Preview state (lifted from LabelPreview)
  const [sampleSerial1, setSampleSerial1] = useState('SSVSBM2H7M5JB1');
  const [sampleSerial2, setSampleSerial2] = useState('SSVSBM2H7M5JB2');
  
  // Test print state
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPrintingCalibration, setIsPrintingCalibration] = useState(false);

  useEffect(() => {
    if (settings) {
      setWidthMm(Number(settings.widthMm));
      setHeightMm(Number(settings.heightMm));
      setBarcodeType(settings.barcodeType);
      setBarcodeHeight(Number(settings.barcodeHeight));
      setSpacing(Number(settings.spacing));
      setPrefixMappings(settings.prefixMappings);
      setTitleLayout(settings.titleLayout);
      setBarcode1Layout(settings.barcode1Layout);
      setSerialText1Layout(settings.serialText1Layout);
      setBarcode2Layout(settings.barcode2Layout);
      setSerialText2Layout(settings.serialText2Layout);
      
      // Load calibration offsets
      const extendedSettings = settings as ExtendedLabelSettings;
      setCalibrationOffsetXmm(extendedSettings.calibrationOffsetXmm ?? 0);
      setCalibrationOffsetYmm(extendedSettings.calibrationOffsetYmm ?? 0);
    }
  }, [settings]);

  // Compute preview title from current in-tab settings
  const previewTitle = prefixMappings[0]?.[1]?.title || 'Dual Band';

  // Build current in-tab settings object for preview and test print
  const currentSettings: ExtendedLabelSettings = {
    widthMm: BigInt(widthMm),
    heightMm: BigInt(heightMm),
    barcodeType,
    barcodeHeight: BigInt(barcodeHeight),
    spacing: BigInt(spacing),
    prefixMappings,
    titleLayout,
    barcode1Layout,
    serialText1Layout,
    barcode2Layout,
    serialText2Layout,
    calibrationOffsetXmm,
    calibrationOffsetYmm,
  };

  const handleSave = async () => {
    // Validate prefix mappings
    const prefixError = validatePrefixMappings(prefixMappings);
    if (prefixError) {
      toast.error(prefixError);
      return;
    }

    // Validate barcode settings
    const barcodeError = validateBarcodeSettings(currentSettings);
    if (barcodeError) {
      toast.error(barcodeError);
      return;
    }
    
    // Local-only save: update persisted store directly
    updatePersistedSettings(currentSettings);
    toast.success('Settings saved on this device');
  };

  const handleResetToDefaults = () => {
    resetSettingsToDefaults();
    toast.success('Settings reset to defaults');
  };

  const handleExport = () => {
    if (!settings) {
      toast.error('No settings to export');
      return;
    }
    
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
      const filename = `label-settings-${timestamp}.json`;
      downloadSettingsFile(settings, filename);
      toast.success('Settings exported successfully');
    } catch (error: any) {
      toast.error(`Export failed: ${error.message}`);
      console.error('Export error:', error);
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    
    try {
      // Read and parse the file
      const importedSettings = await readSettingsFile(file);
      
      // Validate prefix mappings
      const prefixError = validatePrefixMappings(importedSettings.prefixMappings);
      if (prefixError) {
        toast.error(`Import validation failed: ${prefixError}`);
        return;
      }

      // Validate barcode settings
      const barcodeError = validateBarcodeSettings(importedSettings);
      if (barcodeError) {
        toast.error(`Import validation failed: ${barcodeError}`);
        return;
      }
      
      // Persist the imported settings
      updatePersistedSettings(importedSettings);
      
      toast.success('Settings imported successfully');
    } catch (error: any) {
      toast.error(`Import failed: ${error.message}`);
      console.error('Import error:', error);
    } finally {
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleTestPrint = async () => {
    if (!isConnected) {
      toast.error('No printer connected. Please connect a printer in the Devices tab.');
      return;
    }

    setIsPrinting(true);
    try {
      // Generate CPCL with the exact preview values
      const cpcl = generateCPCLWithTitle(
        currentSettings,
        sampleSerial1,
        sampleSerial2,
        previewTitle
      );

      // Send to printer
      await sendCPCL(cpcl);
      toast.success('Test label sent to printer');
    } catch (error: any) {
      toast.error(`Print failed: ${error.message || 'Unknown error'}`);
      console.error('Test print error:', error);
    } finally {
      setIsPrinting(false);
    }
  };

  const handlePrintCalibrationPattern = async () => {
    if (!isConnected) {
      toast.error('No printer connected. Please connect a printer in the Devices tab.');
      return;
    }

    setIsPrintingCalibration(true);
    try {
      // Generate calibration pattern CPCL
      const cpcl = generateCalibrationPatternCPCL(widthMm, heightMm);

      // Send to printer
      await sendCPCL(cpcl);
      
      addLog('info', 'Calibration pattern printed successfully', {
        category: 'calibration',
        widthMm,
        heightMm,
      });
      
      toast.success('Calibration pattern sent to printer');
    } catch (error: any) {
      addLog('error', `Calibration pattern print failed: ${error.message}`, {
        category: 'calibration',
        error: error.message,
      });
      toast.error(`Print failed: ${error.message || 'Unknown error'}`);
      console.error('Calibration pattern print error:', error);
    } finally {
      setIsPrintingCalibration(false);
    }
  };

  const addPrefixMapping = () => {
    setPrefixMappings([...prefixMappings, ['', { labelType: 'dualBand', title: '' }]]);
  };

  const removePrefixMapping = (index: number) => {
    setPrefixMappings(prefixMappings.filter((_, i) => i !== index));
  };

  const updatePrefixMapping = (index: number, field: 'prefix' | 'labelType' | 'title', value: string) => {
    const updated = [...prefixMappings];
    if (field === 'prefix') {
      updated[index] = [value, updated[index][1]];
    } else {
      updated[index] = [updated[index][0], { ...updated[index][1], [field]: value }];
    }
    setPrefixMappings(updated);
  };

  const addCustomType = () => {
    if (newCustomType.trim() && !customTypes.includes(newCustomType.trim())) {
      setCustomTypes([...customTypes, newCustomType.trim()]);
      setNewCustomType('');
      toast.success(`Custom type "${newCustomType.trim()}" added`);
    }
  };

  const removeCustomType = (type: string) => {
    setCustomTypes(customTypes.filter(t => t !== type));
    toast.success(`Custom type "${type}" removed`);
  };

  const updateLayoutField = (
    layout: LayoutSettings,
    setter: (layout: LayoutSettings) => void,
    field: keyof LayoutSettings,
    value: string
  ) => {
    const numValue = parseFloat(value);
    if (isNaN(numValue)) return;
    
    if (field === 'scale') {
      setter({ ...layout, [field]: numValue });
    } else {
      setter({ ...layout, [field]: BigInt(Math.round(numValue)) });
    }
  };

  const allLabelTypes = getAllLabelTypes(prefixMappings, customTypes);

  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Label Preview Section */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Label Preview</CardTitle>
              <CardDescription>Live preview of your label design (matches printed output exactly)</CardDescription>
            </div>
            <Button
              onClick={handleTestPrint}
              disabled={!isConnected || isPrinting}
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              {isPrinting ? 'Printing...' : 'Print test label'}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <LabelPreview
            settings={currentSettings}
            sampleSerial1={sampleSerial1}
            sampleSerial2={sampleSerial2}
            previewTitle={previewTitle}
            onSampleSerial1Change={setSampleSerial1}
            onSampleSerial2Change={setSampleSerial2}
          />
        </CardContent>
      </Card>

      {/* Calibration Section */}
      <Card>
        <CardHeader>
          <CardTitle>Printer Calibration</CardTitle>
          <CardDescription>
            Adjust offsets to align the preview with your physical printer output. Use the calibration pattern to identify any shifts.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="calibration-offset-x">Calibration Offset X (mm)</Label>
              <Input
                id="calibration-offset-x"
                type="number"
                step="0.1"
                value={calibrationOffsetXmm}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCalibrationOffsetXmm(isNaN(val) ? 0 : val);
                }}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Positive values shift right, negative values shift left
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="calibration-offset-y">Calibration Offset Y (mm)</Label>
              <Input
                id="calibration-offset-y"
                type="number"
                step="0.1"
                value={calibrationOffsetYmm}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setCalibrationOffsetYmm(isNaN(val) ? 0 : val);
                }}
                className="font-mono"
              />
              <p className="text-xs text-muted-foreground">
                Positive values shift down, negative values shift up
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 pt-2">
            <Button
              onClick={handlePrintCalibrationPattern}
              disabled={!isConnected || isPrintingCalibration}
              variant="outline"
              className="gap-2"
            >
              <Target className="w-4 h-4" />
              {isPrintingCalibration ? 'Printing...' : 'Print calibration pattern'}
            </Button>
            <p className="text-xs text-muted-foreground">
              Prints a border and crosshair to help identify printer offset
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Label Dimensions */}
      <Card>
        <CardHeader>
          <CardTitle>Label Dimensions</CardTitle>
          <CardDescription>Configure the physical size of your labels</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="width">Width (mm)</Label>
              <Input
                id="width"
                type="number"
                value={widthMm}
                onChange={(e) => setWidthMm(parseInt(e.target.value) || 48)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height (mm)</Label>
              <Input
                id="height"
                type="number"
                value={heightMm}
                onChange={(e) => setHeightMm(parseInt(e.target.value) || 30)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barcode Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Barcode Settings</CardTitle>
          <CardDescription>Configure barcode type and dimensions</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="barcode-type">Barcode Type</Label>
              <Select value={barcodeType} onValueChange={setBarcodeType}>
                <SelectTrigger id="barcode-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">CODE128</SelectItem>
                  <SelectItem value="CODE39">CODE39</SelectItem>
                  <SelectItem value="EAN13">EAN13</SelectItem>
                  <SelectItem value="UPCA">UPC-A</SelectItem>
                  <SelectItem value="QR">QR Code</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcode-height">Barcode Height (mm)</Label>
              <Input
                id="barcode-height"
                type="number"
                value={barcodeHeight}
                onChange={(e) => setBarcodeHeight(parseInt(e.target.value) || 8)}
              />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="spacing">Spacing Between Elements (mm)</Label>
            <Input
              id="spacing"
              type="number"
              value={spacing}
              onChange={(e) => setSpacing(parseInt(e.target.value) || 3)}
            />
          </div>
        </CardContent>
      </Card>

      {/* Prefix Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Prefix Mappings</CardTitle>
          <CardDescription>Map serial number prefixes to label types and titles</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefixMappings.map(([prefix, mapping], index) => (
            <div key={index} className="flex gap-2 items-end">
              <div className="flex-1 space-y-2">
                <Label>Prefix</Label>
                <Input
                  value={prefix}
                  onChange={(e) => updatePrefixMapping(index, 'prefix', e.target.value)}
                  placeholder="e.g., SSV"
                />
              </div>
              <div className="flex-1 space-y-2">
                <Label>Label Type</Label>
                <Select
                  value={mapping.labelType}
                  onValueChange={(value) => updatePrefixMapping(index, 'labelType', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {allLabelTypes.map((typeInfo) => (
                      <SelectItem key={typeInfo.value} value={typeInfo.value}>
                        {typeInfo.displayName}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-2">
                <Label>Title</Label>
                <Input
                  value={mapping.title}
                  onChange={(e) => updatePrefixMapping(index, 'title', e.target.value)}
                  placeholder="e.g., Dual Band"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => removePrefixMapping(index)}
                className="flex-shrink-0"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button onClick={addPrefixMapping} variant="outline" className="w-full gap-2">
            <Plus className="w-4 h-4" />
            Add Prefix Mapping
          </Button>
        </CardContent>
      </Card>

      {/* Custom Label Types */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Label Types</CardTitle>
          <CardDescription>Add custom label types for your prefix mappings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={newCustomType}
              onChange={(e) => setNewCustomType(e.target.value)}
              placeholder="Enter custom type name"
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  addCustomType();
                }
              }}
            />
            <Button onClick={addCustomType} className="gap-2">
              <Plus className="w-4 h-4" />
              Add
            </Button>
          </div>
          {customTypes.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {customTypes.map((type) => (
                <Badge key={type} variant="secondary" className="gap-2">
                  {type}
                  <button
                    onClick={() => removeCustomType(type)}
                    className="hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Layout Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Layout Settings</CardTitle>
          <CardDescription>
            Fine-tune the position and size of each element. X acts as left padding for barcodes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Title</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(titleLayout.x)}
                  onChange={(e) => updateLayoutField(titleLayout, setTitleLayout, 'x', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(titleLayout.y)}
                  onChange={(e) => updateLayoutField(titleLayout, setTitleLayout, 'y', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Font Size</Label>
                <Input
                  type="number"
                  value={Number(titleLayout.fontSize)}
                  onChange={(e) => updateLayoutField(titleLayout, setTitleLayout, 'fontSize', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Barcode 1 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Barcode 1</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(barcode1Layout.x)}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'x', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(barcode1Layout.y)}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'y', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Height (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(barcode1Layout.height)}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'height', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Serial Text 1 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Serial Text 1</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(serialText1Layout.x)}
                  onChange={(e) => updateLayoutField(serialText1Layout, setSerialText1Layout, 'x', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(serialText1Layout.y)}
                  onChange={(e) => updateLayoutField(serialText1Layout, setSerialText1Layout, 'y', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Font Size</Label>
                <Input
                  type="number"
                  value={Number(serialText1Layout.fontSize)}
                  onChange={(e) => updateLayoutField(serialText1Layout, setSerialText1Layout, 'fontSize', e.target.value)}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Barcode 2 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Barcode 2</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(barcode2Layout.x)}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'x', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(barcode2Layout.y)}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'y', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Height (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(barcode2Layout.height)}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'height', e.target.value)}
                />
              </div>
            </div>
          </div>

          {/* Serial Text 2 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Serial Text 2</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(serialText2Layout.x)}
                  onChange={(e) => updateLayoutField(serialText2Layout, setSerialText2Layout, 'x', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={Number(serialText2Layout.y)}
                  onChange={(e) => updateLayoutField(serialText2Layout, setSerialText2Layout, 'y', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-xs">Font Size</Label>
                <Input
                  type="number"
                  value={Number(serialText2Layout.fontSize)}
                  onChange={(e) => updateLayoutField(serialText2Layout, setSerialText2Layout, 'fontSize', e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sound Effects */}
      <SoundEffectsSettings />

      {/* Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Settings Management</CardTitle>
          <CardDescription>Save, export, import, or reset your label settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export Settings
            </Button>
            <Button onClick={handleImportClick} variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Import Settings
            </Button>
            <Button onClick={handleResetToDefaults} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            onChange={handleImportFile}
            className="hidden"
          />
        </CardContent>
      </Card>
    </div>
  );
}
