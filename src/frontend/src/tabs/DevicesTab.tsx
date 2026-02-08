import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Printer, Wifi, RefreshCw, Keyboard, CheckCircle2, Usb, TestTube2 } from 'lucide-react';
import { usePrinterService } from '../services/printerService';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';

export default function DevicesTab() {
  const { isConnected, connect, disconnect, refresh, isConnecting, connectionMethod, testPrint } = usePrinterService();
  const [selectedMethod, setSelectedMethod] = useState<'bluetooth' | 'usb'>('bluetooth');
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  const handleConnect = async () => {
    try {
      await connect(selectedMethod);
      if (isConnected) {
        toast.success(`Connected via ${selectedMethod === 'usb' ? 'USB' : 'Bluetooth'}`);
      }
    } catch (error: any) {
      toast.error(error.message || 'Failed to connect to printer');
      console.error('Connection error:', error);
    }
  };

  const handleDisconnect = () => {
    disconnect();
    toast.success('Printer disconnected');
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    try {
      await testPrint();
      toast.success('Test print sent successfully');
    } catch (error: any) {
      toast.error(error.message || 'Test print failed');
      console.error('Test print error:', error);
    } finally {
      setIsTestPrinting(false);
    }
  };

  // Check if WebUSB is supported
  const isWebUSBSupported = 'usb' in navigator;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-6 h-6" />
            CPCL Printer
          </CardTitle>
          <CardDescription>
            Connect to Bluetooth or USB CPCL printer for label printing
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Connection Method Selector */}
          {!isConnected && (
            <div className="space-y-2">
              <Label htmlFor="connection-method">Connection Method</Label>
              <Select
                value={selectedMethod}
                onValueChange={(value) => setSelectedMethod(value as 'bluetooth' | 'usb')}
                disabled={isConnecting}
              >
                <SelectTrigger id="connection-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bluetooth">
                    <div className="flex items-center gap-2">
                      <Wifi className="w-4 h-4" />
                      Bluetooth
                    </div>
                  </SelectItem>
                  <SelectItem value="usb">
                    <div className="flex items-center gap-2">
                      <Usb className="w-4 h-4" />
                      USB (CPCL)
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}

          {/* WebUSB Not Supported Warning */}
          {selectedMethod === 'usb' && !isWebUSBSupported && !isConnected && (
            <Alert variant="destructive">
              <AlertDescription>
                USB printing is not available on this device or browser. Please use Chrome, Edge, or Opera on a desktop computer to enable USB printer connections.
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">Connection Status</p>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? `Connected via ${connectionMethod === 'usb' ? 'USB' : 'Bluetooth'}`
                  : 'No printer connected'}
              </p>
            </div>
            <Badge variant={isConnected ? 'default' : 'destructive'} className="text-base px-4 py-2">
              {isConnected ? 'Connected' : 'Disconnected'}
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isConnected ? (
              <>
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting || (selectedMethod === 'usb' && !isWebUSBSupported)}
                  className="flex-1 h-14 text-lg"
                >
                  {selectedMethod === 'usb' ? (
                    <Usb className="w-5 h-5 mr-2" />
                  ) : (
                    <Wifi className="w-5 h-5 mr-2" />
                  )}
                  {isConnecting ? 'Connecting...' : 'Connect Printer'}
                </Button>
                <Button
                  onClick={refresh}
                  variant="outline"
                  disabled={isConnecting}
                  className="h-14 px-6"
                >
                  <RefreshCw className="w-5 h-5" />
                </Button>
              </>
            ) : (
              <>
                <Button
                  onClick={handleTestPrint}
                  disabled={isTestPrinting}
                  variant="default"
                  className="flex-1 h-14 text-lg"
                >
                  <TestTube2 className="w-5 h-5 mr-2" />
                  {isTestPrinting ? 'Printing...' : 'Test Print'}
                </Button>
                <Button
                  onClick={handleDisconnect}
                  variant="destructive"
                  className="h-14 px-6"
                >
                  Disconnect
                </Button>
              </>
            )}
          </div>

          {!isConnected && (
            <Alert>
              <AlertDescription>
                {selectedMethod === 'usb'
                  ? 'Click "Connect Printer" to select your USB CPCL printer. Make sure the printer is plugged in and powered on.'
                  : 'Click "Connect Printer" to search for available CPCL printers via Bluetooth.'}
              </AlertDescription>
            </Alert>
          )}

          {isConnected && (
            <Alert>
              <AlertDescription>
                <strong>Test Print:</strong> Click "Test Print" to send a sample label to verify the printer connection and settings.
              </AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Keyboard className="w-6 h-6" />
            Barcode Scanner
          </CardTitle>
          <CardDescription>
            Verify keyboard-wedge scanner configuration
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="p-4 border rounded-lg space-y-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <span className="font-medium">Scanner Mode: Keyboard Wedge</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Scanner is configured to input directly into focused fields without triggering the on-screen keyboard.
            </p>
          </div>

          <Alert>
            <AlertDescription>
              <strong>Scanner Setup:</strong> Ensure your barcode scanner is configured in keyboard-wedge mode.
              Scanned barcodes should appear instantly in the input fields on the Scan & Print tab.
            </AlertDescription>
          </Alert>

          <div className="space-y-2">
            <p className="text-sm font-medium">Scanner Requirements:</p>
            <ul className="text-sm text-muted-foreground space-y-1 list-disc list-inside">
              <li>Keyboard-wedge mode enabled</li>
              <li>Auto-enter or tab suffix configured (optional)</li>
              <li>Compatible with tablet USB or Bluetooth connection</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
