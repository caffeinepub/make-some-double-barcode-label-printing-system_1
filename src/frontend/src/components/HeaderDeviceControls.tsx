import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Printer, Sun } from 'lucide-react';
import { usePrinterService } from '../services/printerService';
import { useWakeLock } from '../hooks/useWakeLock';

export default function HeaderDeviceControls() {
  const { isConnected } = usePrinterService();
  const { isActive, isSupported, toggle } = useWakeLock();

  return (
    <div className="flex items-center gap-6">
      {/* Printer Status */}
      <div className="flex items-center gap-2">
        <Printer className="w-5 h-5 text-muted-foreground" />
        <Badge 
          variant={isConnected ? 'default' : 'destructive'} 
          className="text-sm px-2 py-1"
        >
          {isConnected ? 'Connected' : 'Not Connected'}
        </Badge>
      </div>

      {/* Keep Awake Toggle */}
      {isSupported && (
        <div className="flex items-center gap-2">
          <Sun className="w-5 h-5 text-muted-foreground" />
          <Label htmlFor="header-wake-lock" className="sr-only">
            Keep screen awake
          </Label>
          <Switch
            id="header-wake-lock"
            checked={isActive}
            onCheckedChange={toggle}
          />
        </div>
      )}
    </div>
  );
}
