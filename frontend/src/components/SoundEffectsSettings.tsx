import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Play, Upload, Trash2 } from 'lucide-react';
import { useSoundSettings, playTestSound, getBuiltInSounds, getCustomSounds } from '../audio/soundSystem';
import { toast } from 'sonner';

type SoundType = 'success' | 'error' | 'printComplete';

interface SoundEventRowProps {
  type: SoundType;
  label: string;
  currentSound: string;
  onSoundChange: (sound: string) => void;
  onUpload: (file: File) => void;
  onRemoveCustom: (name: string) => void;
}

function SoundEventRow({ type, label, currentSound, onSoundChange, onUpload, onRemoveCustom }: SoundEventRowProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  
  const builtInSounds = getBuiltInSounds(type);
  const customSounds = getCustomSounds(type);
  
  const handleTest = async () => {
    setIsPlaying(true);
    const result = await playTestSound(type);
    if (!result.success) {
      toast.error(result.error || 'Failed to play sound');
    }
    setTimeout(() => setIsPlaying(false), 1000);
  };
  
  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };
  
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUpload(file);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };
  
  return (
    <div className="space-y-3 p-4 border rounded-lg">
      <div className="flex items-center justify-between">
        <Label className="text-base font-medium">{label}</Label>
        <Button
          variant="outline"
          size="sm"
          onClick={handleTest}
          disabled={isPlaying}
          className="gap-2"
        >
          <Play className="w-4 h-4" />
          Test
        </Button>
      </div>
      
      <div className="flex gap-2">
        <Select value={currentSound} onValueChange={onSoundChange}>
          <SelectTrigger className="flex-1">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="none">None</SelectItem>
            {builtInSounds.filter(s => s !== 'none').map((sound) => (
              <SelectItem key={sound} value={sound}>
                {sound.charAt(0).toUpperCase() + sound.slice(1)}
              </SelectItem>
            ))}
            {customSounds.length > 0 && (
              <>
                <SelectItem value="divider" disabled>
                  ─── Custom Sounds ───
                </SelectItem>
                {customSounds.map((sound) => (
                  <SelectItem key={sound.name} value={sound.name}>
                    {sound.name}
                  </SelectItem>
                ))}
              </>
            )}
          </SelectContent>
        </Select>
        
        <Button
          variant="outline"
          size="sm"
          onClick={handleUploadClick}
          className="gap-2"
        >
          <Upload className="w-4 h-4" />
          Upload
        </Button>
        
        {customSounds.some(s => s.name === currentSound) && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRemoveCustom(currentSound)}
            className="gap-2"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>
      
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        onChange={handleFileChange}
        className="hidden"
      />
    </div>
  );
}

export default function SoundEffectsSettings() {
  const { settings, updateSettings, addCustomSound, removeCustomSound } = useSoundSettings();
  
  const handleVolumeChange = (value: number[]) => {
    updateSettings({ volume: value[0] });
  };
  
  const handleSoundChange = (type: SoundType, sound: string) => {
    switch (type) {
      case 'success':
        updateSettings({ successSound: sound });
        break;
      case 'error':
        updateSettings({ errorSound: sound });
        break;
      case 'printComplete':
        updateSettings({ printCompleteSound: sound });
        break;
    }
  };
  
  const handleUpload = async (type: SoundType, file: File) => {
    // Validate file type
    if (!file.type.startsWith('audio/')) {
      toast.error('Please upload an audio file (mp3, wav, ogg, etc.)');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Audio file must be smaller than 5MB');
      return;
    }
    
    try {
      // Read file as data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        const name = file.name.replace(/\.[^/.]+$/, ''); // Remove extension
        
        // Add custom sound
        addCustomSound(type, name, dataUrl);
        
        // Set as current sound
        handleSoundChange(type, name);
        
        toast.success(`Custom sound "${name}" uploaded successfully`);
      };
      reader.onerror = () => {
        toast.error('Failed to read audio file');
      };
      reader.readAsDataURL(file);
    } catch (error: any) {
      toast.error(`Upload failed: ${error.message}`);
    }
  };
  
  const handleRemoveCustom = (type: SoundType, name: string) => {
    removeCustomSound(type, name);
    
    // Reset to default if current sound was removed
    const currentSound = type === 'success' ? settings.successSound : 
                        type === 'error' ? settings.errorSound : 
                        settings.printCompleteSound;
    
    if (currentSound === name) {
      handleSoundChange(type, 'none');
    }
    
    toast.success(`Custom sound "${name}" removed`);
  };
  
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sound Effects</CardTitle>
        <CardDescription>
          Configure sound effects for scanning and printing events
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Volume Control */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label className="text-base">Volume</Label>
            <span className="text-sm text-muted-foreground">{settings.volume}%</span>
          </div>
          <Slider
            value={[settings.volume]}
            onValueChange={handleVolumeChange}
            min={0}
            max={100}
            step={5}
            className="w-full"
          />
        </div>
        
        {/* Success Scan Sound */}
        <SoundEventRow
          type="success"
          label="Success Scan"
          currentSound={settings.successSound}
          onSoundChange={(sound) => handleSoundChange('success', sound)}
          onUpload={(file) => handleUpload('success', file)}
          onRemoveCustom={(name) => handleRemoveCustom('success', name)}
        />
        
        {/* Error Scan Sound */}
        <SoundEventRow
          type="error"
          label="Error Scan"
          currentSound={settings.errorSound}
          onSoundChange={(sound) => handleSoundChange('error', sound)}
          onUpload={(file) => handleUpload('error', file)}
          onRemoveCustom={(name) => handleRemoveCustom('error', name)}
        />
        
        {/* Print Complete Sound */}
        <SoundEventRow
          type="printComplete"
          label="Print Complete"
          currentSound={settings.printCompleteSound}
          onSoundChange={(sound) => handleSoundChange('printComplete', sound)}
          onUpload={(file) => handleUpload('printComplete', file)}
          onRemoveCustom={(name) => handleRemoveCustom('printComplete', name)}
        />
      </CardContent>
    </Card>
  );
}
