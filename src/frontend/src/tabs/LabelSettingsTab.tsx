import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Plus, Trash2, X, Download, Upload, RotateCcw, Printer } from 'lucide-react';
import { useLabelSettings, updatePersistedSettings, resetSettingsToDefaults } from '../state/labelSettingsStore';
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
import { generateCPCLWithTitle } from '../printing/cpclGenerator';

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
  
  // Layout settings for each element - defaults for 48x30mm
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
    y: BigInt(19),
    scale: 1.0,
    width: BigInt(44),
    height: BigInt(8),
    fontSize: BigInt(8),
  });
  
  const [serialText2Layout, setSerialText2Layout] = useState<LayoutSettings>({
    x: BigInt(2),
    y: BigInt(28),
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
    }
  }, [settings]);

  // Compute preview title from current in-tab settings
  const previewTitle = prefixMappings[0]?.[1]?.title || 'Dual Band';

  // Build current in-tab settings object for preview and test print
  const currentSettings = {
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

  // Get all label types
  const allLabelTypeInfos = getAllLabelTypes(prefixMappings, customTypes);

  // Show loading state while hydrating
  if (!hasHydrated) {
    return (
      <div className="flex items-center justify-center p-12">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="text-center space-y-3">
              <div className="text-lg font-medium">Loading settings…</div>
              <div className="text-sm text-muted-foreground">
                Initializing label configuration
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Action Bar */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-3">
            <Button onClick={handleSave} className="gap-2">
              <Save className="w-4 h-4" />
              Save Settings
            </Button>
            <Button onClick={handleResetToDefaults} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" />
              Reset to Defaults
            </Button>
            <Button onClick={handleExport} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export
            </Button>
            <Button onClick={handleImportClick} variant="outline" className="gap-2">
              <Upload className="w-4 h-4" />
              Import
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json"
              onChange={handleImportFile}
              className="hidden"
            />
          </div>
        </CardContent>
      </Card>

      {/* Preview Card */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Label Preview</CardTitle>
              <CardDescription>
                Live preview of your label design (matches printed output exactly)
              </CardDescription>
            </div>
            <Button
              onClick={handleTestPrint}
              disabled={!isConnected || isPrinting}
              variant="outline"
              className="gap-2"
            >
              <Printer className="w-4 h-4" />
              {isPrinting ? 'Printing…' : 'Print test label'}
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

      {/* Sound Effects Settings */}
      <SoundEffectsSettings />

      {/* Basic Settings */}
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
                min={10}
                max={100}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="height">Height (mm)</Label>
              <Input
                id="height"
                type="number"
                value={heightMm}
                onChange={(e) => setHeightMm(parseInt(e.target.value) || 30)}
                min={10}
                max={100}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Barcode Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Barcode Configuration</CardTitle>
          <CardDescription>Configure barcode format and appearance</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="barcodeType">Barcode Type</Label>
              <Select value={barcodeType} onValueChange={setBarcodeType}>
                <SelectTrigger id="barcodeType">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CODE128">CODE128</SelectItem>
                  <SelectItem value="CODE39">CODE39</SelectItem>
                  <SelectItem value="EAN13">EAN13</SelectItem>
                  <SelectItem value="UPCA">UPC-A</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="barcodeHeight">Barcode Height (mm)</Label>
              <Input
                id="barcodeHeight"
                type="number"
                value={barcodeHeight}
                onChange={(e) => setBarcodeHeight(parseInt(e.target.value) || 8)}
                min={3}
                max={20}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="spacing">Element Spacing (mm)</Label>
              <Input
                id="spacing"
                type="number"
                value={spacing}
                onChange={(e) => setSpacing(parseInt(e.target.value) || 3)}
                min={1}
                max={10}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prefix Mappings */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Prefix Mappings</CardTitle>
              <CardDescription>Map serial number prefixes to label types</CardDescription>
            </div>
            <Button onClick={addPrefixMapping} size="sm" className="gap-2">
              <Plus className="w-4 h-4" />
              Add Mapping
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefixMappings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No prefix mappings configured. Click "Add Mapping" to get started.
            </div>
          ) : (
            prefixMappings.map((mapping, index) => (
              <div key={index} className="flex gap-3 items-end">
                <div className="flex-1 space-y-2">
                  <Label>Prefix</Label>
                  <Input
                    value={mapping[0]}
                    onChange={(e) => updatePrefixMapping(index, 'prefix', e.target.value)}
                    placeholder="e.g., SSV"
                  />
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Label Type</Label>
                  <Select
                    value={mapping[1].labelType}
                    onValueChange={(value) => updatePrefixMapping(index, 'labelType', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {allLabelTypeInfos.map((info) => (
                        <SelectItem key={info.value} value={info.value}>
                          {info.displayName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex-1 space-y-2">
                  <Label>Title</Label>
                  <Input
                    value={mapping[1].title}
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
            ))
          )}
        </CardContent>
      </Card>

      {/* Custom Label Types */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Label Types</CardTitle>
          <CardDescription>
            Add custom label types beyond the built-in options (Dual Band, Tri Band, New Dual Band)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
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
              Add Type
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

      {/* Advanced Layout Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced Layout Settings</CardTitle>
          <CardDescription>
            Fine-tune the position and size of each label element (in millimeters)
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Title</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>X Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(titleLayout.x)}
                  onChange={(e) => updateLayoutField(titleLayout, setTitleLayout, 'x', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Y Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(titleLayout.y)}
                  onChange={(e) => updateLayoutField(titleLayout, setTitleLayout, 'y', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Font Size</Label>
                <Input
                  type="number"
                  value={Number(titleLayout.fontSize)}
                  onChange={(e) => updateLayoutField(titleLayout, setTitleLayout, 'fontSize', e.target.value)}
                  min={6}
                  max={24}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Barcode 1 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Barcode 1</h4>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>X Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode1Layout.x)}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'x', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Y Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode1Layout.y)}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'y', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Width (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode1Layout.width)}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'width', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Height (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode1Layout.height)}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'height', e.target.value)}
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Serial Text 1 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Serial Text 1</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>X Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(serialText1Layout.x)}
                  onChange={(e) => updateLayoutField(serialText1Layout, setSerialText1Layout, 'x', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Y Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(serialText1Layout.y)}
                  onChange={(e) => updateLayoutField(serialText1Layout, setSerialText1Layout, 'y', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Font Size</Label>
                <Input
                  type="number"
                  value={Number(serialText1Layout.fontSize)}
                  onChange={(e) => updateLayoutField(serialText1Layout, setSerialText1Layout, 'fontSize', e.target.value)}
                  min={6}
                  max={24}
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Barcode 2 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Barcode 2</h4>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-2">
                <Label>X Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode2Layout.x)}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'x', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Y Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode2Layout.y)}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'y', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Width (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode2Layout.width)}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'width', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Height (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode2Layout.height)}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'height', e.target.value)}
                  step="0.1"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Serial Text 2 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium">Serial Text 2</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>X Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(serialText2Layout.x)}
                  onChange={(e) => updateLayoutField(serialText2Layout, setSerialText2Layout, 'x', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Y Position (mm)</Label>
                <Input
                  type="number"
                  value={Number(serialText2Layout.y)}
                  onChange={(e) => updateLayoutField(serialText2Layout, setSerialText2Layout, 'y', e.target.value)}
                  step="0.1"
                />
              </div>
              <div className="space-y-2">
                <Label>Font Size</Label>
                <Input
                  type="number"
                  value={Number(serialText2Layout.fontSize)}
                  onChange={(e) => updateLayoutField(serialText2Layout, setSerialText2Layout, 'fontSize', e.target.value)}
                  min={6}
                  max={24}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
