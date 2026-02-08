import { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Save, Plus, Trash2, X, Download, Upload } from 'lucide-react';
import { useLabelSettings, updatePersistedSettings } from '../state/labelSettingsStore';
import LabelPreview from '../printing/LabelPreview';
import { toast } from 'sonner';
import { getAllLabelTypes, getLabelTypeDisplayName } from '../utils/labelTypes';
import type { LayoutSettings } from '../backend';
import {
  downloadSettingsFile,
  readSettingsFile,
  validatePrefixMappings,
} from '../utils/labelSettingsImportExport';

export default function LabelSettingsTab() {
  const { settings, isLoading } = useLabelSettings();
  
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

  const handleSave = async () => {
    // Validate before saving
    const validationError = validatePrefixMappings(prefixMappings);
    if (validationError) {
      toast.error(validationError);
      return;
    }
    
    const newSettings = {
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
    
    // Local-only save: update persisted store directly
    updatePersistedSettings(newSettings);
    toast.success('Settings saved on this device');
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
      const validationError = validatePrefixMappings(importedSettings.prefixMappings);
      if (validationError) {
        toast.error(`Import validation failed: ${validationError}`);
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

  // Get all label types and extract just the value strings
  const allLabelTypeInfos = getAllLabelTypes(prefixMappings, customTypes);
  const allLabelTypes = allLabelTypeInfos.map(info => info.value);

  if (isLoading) {
    return <div className="p-6">Loading settings...</div>;
  }

  if (!settings) {
    return <div className="p-6">No settings available</div>;
  }

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Preview Card */}
      <Card>
        <CardHeader>
          <CardTitle>Label Preview</CardTitle>
          <CardDescription>
            Live preview of your label design (matches printed output exactly)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LabelPreview settings={settings} />
        </CardContent>
      </Card>

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
                  <SelectItem value="EAN8">EAN8</SelectItem>
                  <SelectItem value="UPC">UPC</SelectItem>
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
                min={5}
                max={30}
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

      {/* Layout Controls */}
      <Card>
        <CardHeader>
          <CardTitle>Element Layout</CardTitle>
          <CardDescription>Fine-tune position and scale of each label element</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Title Layout */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Title</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  value={Number(titleLayout.x)}
                  onChange={(e) => updateLayoutField(titleLayout, setTitleLayout, 'x', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  value={Number(titleLayout.y)}
                  onChange={(e) => updateLayoutField(titleLayout, setTitleLayout, 'y', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Scale</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={titleLayout.scale}
                  onChange={(e) => updateLayoutField(titleLayout, setTitleLayout, 'scale', e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Barcode 1 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Barcode 1</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode1Layout.x)}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'x', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode1Layout.y)}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'y', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Scale</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={barcode1Layout.scale}
                  onChange={(e) => updateLayoutField(barcode1Layout, setBarcode1Layout, 'scale', e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Serial Text 1 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Serial Text 1</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  value={Number(serialText1Layout.x)}
                  onChange={(e) => updateLayoutField(serialText1Layout, setSerialText1Layout, 'x', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  value={Number(serialText1Layout.y)}
                  onChange={(e) => updateLayoutField(serialText1Layout, setSerialText1Layout, 'y', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Scale</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={serialText1Layout.scale}
                  onChange={(e) => updateLayoutField(serialText1Layout, setSerialText1Layout, 'scale', e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Barcode 2 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Barcode 2</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode2Layout.x)}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'x', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  value={Number(barcode2Layout.y)}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'y', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Scale</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={barcode2Layout.scale}
                  onChange={(e) => updateLayoutField(barcode2Layout, setBarcode2Layout, 'scale', e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>

          <Separator />

          {/* Serial Text 2 Layout */}
          <div className="space-y-3">
            <h4 className="font-medium text-sm">Serial Text 2</h4>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">X (mm)</Label>
                <Input
                  type="number"
                  value={Number(serialText2Layout.x)}
                  onChange={(e) => updateLayoutField(serialText2Layout, setSerialText2Layout, 'x', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Y (mm)</Label>
                <Input
                  type="number"
                  value={Number(serialText2Layout.y)}
                  onChange={(e) => updateLayoutField(serialText2Layout, setSerialText2Layout, 'y', e.target.value)}
                  className="h-9"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Scale</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={serialText2Layout.scale}
                  onChange={(e) => updateLayoutField(serialText2Layout, setSerialText2Layout, 'scale', e.target.value)}
                  className="h-9"
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Prefix Mappings */}
      <Card>
        <CardHeader>
          <CardTitle>Prefix Mappings</CardTitle>
          <CardDescription>
            Map serial number prefixes to label types and titles
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {prefixMappings.map(([prefix, mapping], index) => (
            <div key={index} className="flex gap-3 items-end">
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
                    {allLabelTypeInfos.map((typeInfo) => (
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
                variant="destructive"
                size="icon"
                onClick={() => removePrefixMapping(index)}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
          <Button onClick={addPrefixMapping} variant="outline" className="w-full">
            <Plus className="w-4 h-4 mr-2" />
            Add Prefix Mapping
          </Button>
        </CardContent>
      </Card>

      {/* Custom Label Types */}
      <Card>
        <CardHeader>
          <CardTitle>Custom Label Types</CardTitle>
          <CardDescription>
            Add custom label types beyond the built-in options
          </CardDescription>
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
            <Button onClick={addCustomType}>
              <Plus className="w-4 h-4 mr-2" />
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

      {/* Action Buttons */}
      <div className="flex gap-3">
        <Button onClick={handleSave} className="flex-1 h-14 text-lg">
          <Save className="w-5 h-5 mr-2" />
          Save Settings
        </Button>
        <Button onClick={handleExport} variant="outline" className="h-14 px-6">
          <Download className="w-5 h-5 mr-2" />
          Export
        </Button>
        <Button onClick={handleImportClick} variant="outline" className="h-14 px-6">
          <Upload className="w-5 h-5 mr-2" />
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
    </div>
  );
}
