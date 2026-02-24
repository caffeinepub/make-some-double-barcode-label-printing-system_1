import React, { useState, useCallback, useRef } from 'react';
import { useLabelSettingsStore, DEFAULT_LABEL_SETTINGS } from '../state/labelSettingsStore';
import { barcodeSettingsValidation, getFieldError } from '../utils/barcodeSettingsValidation';
import { exportLabelSettings, importLabelSettings } from '../utils/labelSettingsImportExport';
import LabelPreview from '../printing/LabelPreview';
import SoundEffectsSettings from '../components/SoundEffectsSettings';
import { getLabelTypeDisplayName, getMergedLabelTypes } from '../utils/labelTypes';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { Download, Upload, RotateCcw, Save, Plus, Trash2, AlertCircle } from 'lucide-react';

const BARCODE_TYPES = ['CODE128', 'CODE39', 'EAN13', 'EAN8', 'UPC-A', 'UPCE', 'I2OF5', 'CODABAR'];

interface PrefixMappingEntry {
  prefix: string;
  labelType: string;
  title: string;
}

export default function LabelSettingsTab() {
  const { settings, updateSettings, resetSettings } = useLabelSettingsStore();

  const [newPrefix, setNewPrefix] = useState('');
  const [newLabelType, setNewLabelType] = useState('');
  const [newTitle, setNewTitle] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const validationResult = barcodeSettingsValidation(settings);

  const handleNumberInput = useCallback(
    (field: string, value: string, isFloat = false) => {
      const parsed = isFloat ? parseFloat(value) : parseInt(value, 10);
      if (!isNaN(parsed)) {
        updateSettings({ [field]: parsed } as never);
      }
    },
    [updateSettings]
  );

  const handleBarcodePositionInput = useCallback(
    (barcodeKey: 'barcode1Position' | 'barcode2Position', field: string, value: string) => {
      const parsed = parseFloat(value);
      if (!isNaN(parsed)) {
        updateSettings({
          [barcodeKey]: {
            ...settings[barcodeKey],
            [field]: parsed,
          },
        });
      }
    },
    [settings, updateSettings]
  );

  const handleAddPrefix = () => {
    if (!newPrefix.trim() || !newLabelType.trim() || !newTitle.trim()) {
      toast.error('Please fill in all prefix mapping fields.');
      return;
    }
    updateSettings({
      prefixMappings: {
        ...settings.prefixMappings,
        [newPrefix.trim().toUpperCase()]: {
          labelType: newLabelType.trim(),
          title: newTitle.trim(),
        },
      },
    });
    setNewPrefix('');
    setNewLabelType('');
    setNewTitle('');
    toast.success(`Prefix "${newPrefix.trim().toUpperCase()}" added.`);
  };

  const handleRemovePrefix = (prefix: string) => {
    const updated = { ...settings.prefixMappings };
    delete updated[prefix];
    updateSettings({ prefixMappings: updated });
    toast.success(`Prefix "${prefix}" removed.`);
  };

  const handleExport = () => {
    try {
      const json = exportLabelSettings(settings);
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'label-settings.json';
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Settings exported successfully.');
    } catch {
      toast.error('Failed to export settings.');
    }
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const imported = importLabelSettings(ev.target?.result as string);
        updateSettings(imported);
        toast.success('Settings imported successfully.');
      } catch {
        toast.error('Failed to import settings. Invalid file format.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleSave = () => {
    if (!validationResult.valid) {
      toast.error('Please fix validation errors before saving.');
      return;
    }
    // Settings are already persisted via Zustand persist middleware on every update.
    // This button provides explicit user confirmation.
    toast.success('Settings saved on this device.');
  };

  const handleReset = () => {
    resetSettings();
    toast.info('Settings reset to defaults.');
  };

  const prefixEntries: PrefixMappingEntry[] = Object.entries(settings.prefixMappings).map(
    ([prefix, mapping]) => ({ prefix, ...mapping })
  );

  const sampleSerials = ['55Y20M1AE00502', '55Y20M1AE00280'];
  const sampleTitle =
    prefixEntries.length > 0 ? prefixEntries[0].title : 'SAMPLE PRODUCT TITLE';

  return (
    <div className="space-y-6 p-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h2 className="text-lg font-semibold text-foreground">Label Settings</h2>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1" />
            Export
          </Button>
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
            <Upload className="w-4 h-4 mr-1" />
            Import
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" className="hidden" onChange={handleImport} />
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="w-4 h-4 mr-1" />
            Reset
          </Button>
          <Button
            size="sm"
            onClick={handleSave}
            disabled={!validationResult.valid}
          >
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Validation errors */}
      {!validationResult.valid && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-3 space-y-1">
          {validationResult.errors.map((err) => (
            <div key={err.field} className="flex items-start gap-2 text-sm text-destructive">
              <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>{err.message}</span>
            </div>
          ))}
        </div>
      )}

      <Tabs defaultValue="label">
        <TabsList className="w-full">
          <TabsTrigger value="label" className="flex-1">Label</TabsTrigger>
          <TabsTrigger value="barcodes" className="flex-1">Barcodes</TabsTrigger>
          <TabsTrigger value="prefixes" className="flex-1">Prefixes</TabsTrigger>
          <TabsTrigger value="sound" className="flex-1">Sound</TabsTrigger>
        </TabsList>

        {/* ── Label Tab ── */}
        <TabsContent value="label" className="space-y-4 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Width (mm)</Label>
              <Input
                type="number"
                value={settings.widthMm}
                onChange={(e) => handleNumberInput('widthMm', e.target.value)}
                min={20}
                max={200}
              />
            </div>
            <div className="space-y-1">
              <Label>Height (mm)</Label>
              <Input
                type="number"
                value={settings.heightMm}
                onChange={(e) => handleNumberInput('heightMm', e.target.value)}
                min={10}
                max={200}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Title Font Size (mm)</Label>
              <Input
                type="number"
                value={settings.titleFontSize}
                onChange={(e) => handleNumberInput('titleFontSize', e.target.value, true)}
                min={1}
                max={10}
                step={0.5}
              />
            </div>
            <div className="space-y-1">
              <Label>Serial Font Size (mm)</Label>
              <Input
                type="number"
                value={settings.serialFontSize}
                onChange={(e) => handleNumberInput('serialFontSize', e.target.value, true)}
                min={1}
                max={8}
                step={0.5}
              />
            </div>
          </div>

          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Calibration Offsets (move all elements)
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Vertical Offset (mm)</Label>
              <Input
                type="number"
                value={settings.globalVerticalOffsetMm}
                onChange={(e) => handleNumberInput('globalVerticalOffsetMm', e.target.value, true)}
                step={0.5}
              />
            </div>
            <div className="space-y-1">
              <Label>Horizontal Offset (mm)</Label>
              <Input
                type="number"
                value={settings.globalHorizontalOffsetMm}
                onChange={(e) => handleNumberInput('globalHorizontalOffsetMm', e.target.value, true)}
                step={0.5}
              />
            </div>
          </div>

          {/* Preview */}
          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Preview</p>
          <div className="flex justify-center overflow-x-auto py-2">
            <LabelPreview
              leftSerial={sampleSerials[0]}
              rightSerial={sampleSerials[1]}
              title={sampleTitle}
            />
          </div>
        </TabsContent>

        {/* ── Barcodes Tab ── */}
        <TabsContent value="barcodes" className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Barcode Type &amp; Dimensions
          </p>

          <div className="space-y-1">
            <Label>Barcode Type</Label>
            <select
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
              value={settings.barcodeType}
              onChange={(e) => updateSettings({ barcodeType: e.target.value })}
            >
              {BARCODE_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Barcode Height (mm)</Label>
              <Input
                type="number"
                value={settings.barcodeHeight}
                onChange={(e) => handleNumberInput('barcodeHeight', e.target.value, true)}
                min={5}
                max={30}
                step={0.5}
              />
              {getFieldError(validationResult, 'barcodeHeight') && (
                <p className="text-xs text-destructive">
                  {getFieldError(validationResult, 'barcodeHeight')}
                </p>
              )}
            </div>

            {/* Barcode Width */}
            <div className="space-y-1">
              <Label>Barcode Width (dots)</Label>
              <Input
                type="number"
                value={settings.barcodeWidth ?? 2}
                onChange={(e) => handleNumberInput('barcodeWidth', e.target.value)}
                min={1}
                max={10}
                step={1}
              />
              {getFieldError(validationResult, 'barcodeWidth') && (
                <p className="text-xs text-destructive">
                  {getFieldError(validationResult, 'barcodeWidth')}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                Controls bar thickness (1–10 dots). Default: 2.
              </p>
            </div>
          </div>

          <Separator />

          {/* Barcode Positions */}
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Barcode Positions
          </p>

          {/* Barcode 1 */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Barcode 1</Badge>
              <span className="text-xs text-muted-foreground">(left / primary serial)</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>X (mm)</Label>
                <Input
                  type="number"
                  value={settings.barcode1Position.xMm}
                  onChange={(e) => handleBarcodePositionInput('barcode1Position', 'xMm', e.target.value)}
                  step={0.5}
                />
              </div>
              <div className="space-y-1">
                <Label>Y (mm)</Label>
                <Input
                  type="number"
                  value={settings.barcode1Position.yMm}
                  onChange={(e) => handleBarcodePositionInput('barcode1Position', 'yMm', e.target.value)}
                  step={0.5}
                />
                {getFieldError(validationResult, 'barcode1Position.yMm') && (
                  <p className="text-xs text-destructive">
                    {getFieldError(validationResult, 'barcode1Position.yMm')}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Text Gap (mm)</Label>
                <Input
                  type="number"
                  value={settings.barcode1Position.textSpacingMm}
                  onChange={(e) =>
                    handleBarcodePositionInput('barcode1Position', 'textSpacingMm', e.target.value)
                  }
                  step={0.5}
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Barcode 2 */}
          <div className="rounded-md border border-border p-3 space-y-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Barcode 2</Badge>
              <span className="text-xs text-muted-foreground">(right / secondary serial)</span>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label>X (mm)</Label>
                <Input
                  type="number"
                  value={settings.barcode2Position.xMm}
                  onChange={(e) => handleBarcodePositionInput('barcode2Position', 'xMm', e.target.value)}
                  step={0.5}
                />
              </div>
              <div className="space-y-1">
                <Label>Y (mm)</Label>
                <Input
                  type="number"
                  value={settings.barcode2Position.yMm}
                  onChange={(e) => handleBarcodePositionInput('barcode2Position', 'yMm', e.target.value)}
                  step={0.5}
                />
                {getFieldError(validationResult, 'barcode2Position.yMm') && (
                  <p className="text-xs text-destructive">
                    {getFieldError(validationResult, 'barcode2Position.yMm')}
                  </p>
                )}
              </div>
              <div className="space-y-1">
                <Label>Text Gap (mm)</Label>
                <Input
                  type="number"
                  value={settings.barcode2Position.textSpacingMm}
                  onChange={(e) =>
                    handleBarcodePositionInput('barcode2Position', 'textSpacingMm', e.target.value)
                  }
                  step={0.5}
                  min={0}
                />
              </div>
            </div>
          </div>

          {/* Spacing overlap warning */}
          {validationResult.errors.some((e) => e.message.includes('too close')) && (
            <p className="text-xs text-destructive">
              {validationResult.errors.find((e) => e.message.includes('too close'))?.message}
            </p>
          )}

          {/* Preview */}
          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Preview</p>
          <div className="flex justify-center overflow-x-auto py-2">
            <LabelPreview
              leftSerial={sampleSerials[0]}
              rightSerial={sampleSerials[1]}
              title={sampleTitle}
            />
          </div>
        </TabsContent>

        {/* ── Prefixes Tab ── */}
        <TabsContent value="prefixes" className="space-y-4 pt-4">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Prefix → Label Type Mappings
          </p>

          {prefixEntries.length === 0 ? (
            <p className="text-sm text-muted-foreground italic">No prefix mappings configured.</p>
          ) : (
            <div className="space-y-2">
              {prefixEntries.map((entry) => (
                <div
                  key={entry.prefix}
                  className="flex items-center gap-2 rounded-md border border-border p-2"
                >
                  <Badge variant="outline" className="font-mono shrink-0">
                    {entry.prefix}
                  </Badge>
                  <span className="text-sm flex-1 truncate">
                    {entry.title}{' '}
                    <span className="text-muted-foreground">
                      ({getLabelTypeDisplayName(entry.labelType)})
                    </span>
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="shrink-0 text-destructive hover:text-destructive"
                    onClick={() => handleRemovePrefix(entry.prefix)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}

          <Separator />
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
            Add New Mapping
          </p>
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>Prefix</Label>
                <Input
                  placeholder="e.g. 55Y"
                  value={newPrefix}
                  onChange={(e) => setNewPrefix(e.target.value.toUpperCase())}
                />
              </div>
              <div className="space-y-1">
                <Label>Label Type</Label>
                <Input
                  placeholder="e.g. dualBand"
                  value={newLabelType}
                  onChange={(e) => setNewLabelType(e.target.value)}
                  list="label-type-suggestions"
                />
                <datalist id="label-type-suggestions">
                  {getMergedLabelTypes(settings.prefixMappings).map((t) => (
                    <option key={t.id} value={t.value} />
                  ))}
                </datalist>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Title</Label>
              <Input
                placeholder="e.g. DUAL BAND ROUTER"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <Button onClick={handleAddPrefix} className="w-full">
              <Plus className="w-4 h-4 mr-1" />
              Add Mapping
            </Button>
          </div>
        </TabsContent>

        {/* ── Sound Tab ── */}
        <TabsContent value="sound" className="pt-4">
          <SoundEffectsSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}
