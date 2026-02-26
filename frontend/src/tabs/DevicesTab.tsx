import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Printer, RefreshCw, Keyboard, CheckCircle2, Usb, TestTube2, AlertTriangle } from 'lucide-react';
import { usePrinterStore } from '../services/printerService';
import { toast } from 'sonner';
import { Label } from '@/components/ui/label';

export default function DevicesTab() {
  const { status, connectPrinter, disconnectPrinter, testPrint, deviceName, isAutoReconnecting } = usePrinterStore();
  const [isTestPrinting, setIsTestPrinting] = useState(false);

  const isConnected = status === 'connected';
  const isConnecting = status === 'connecting' || isAutoReconnecting;

  const handleConnect = async () => {
    try {
      await connectPrinter();
      if (usePrinterStore.getState().status === 'connected') {
        toast.success('Connected via USB');
      }
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Failed to connect to printer';
      toast.error(msg);
    }
  };

  const handleDisconnect = async () => {
    await disconnectPrinter();
    toast.success('Printer disconnected');
  };

  const handleTestPrint = async () => {
    setIsTestPrinting(true);
    try {
      await testPrint();
      toast.success('Test print sent successfully');
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Test print failed';
      toast.error(msg);
    } finally {
      setIsTestPrinting(false);
    }
  };

  const isWebUSBSupported = 'usb' in navigator;

  return (
    <div className="space-y-6 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Printer className="w-6 h-6" />
            CPCL Printer
          </CardTitle>
          <CardDescription>Connect to USB CPCL printer for label printing</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Bluetooth Not Supported Notice */}
          {!isConnected && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                <strong>Note:</strong> Bluetooth printing is not supported. Please use a USB connection with a
                CPCL-compatible printer.
              </AlertDescription>
            </Alert>
          )}

          {/* WebUSB Not Supported Warning */}
          {!isWebUSBSupported && !isConnected && (
            <Alert variant="destructive">
              <AlertDescription>
                USB printing is not available on this device or browser. Please use Chrome, Edge, or Opera on a desktop
                computer to enable USB printer connections.
              </AlertDescription>
            </Alert>
          )}

          {/* Connection Status */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <p className="font-medium">Connection Status</p>
              <p className="text-sm text-muted-foreground">
                {isConnected
                  ? `Connected via USB${deviceName ? ` — ${deviceName}` : ''}`
                  : isAutoReconnecting
                  ? 'Reconnecting to last printer...'
                  : 'No printer connected'}
              </p>
            </div>
            <Badge variant={isConnected ? 'default' : 'destructive'} className="text-base px-4 py-2">
              {isConnected ? 'Connected' : isAutoReconnecting ? 'Reconnecting…' : 'Disconnected'}
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-3">
            {!isConnected ? (
              <>
                <Button
                  onClick={handleConnect}
                  disabled={isConnecting || !isWebUSBSupported}
                  className="flex-1 h-14 text-lg"
                >
                  <Usb className="w-5 h-5 mr-2" />
                  {isConnecting ? 'Connecting...' : 'Connect USB Printer'}
                </Button>
                <Button onClick={() => {}} variant="outline" disabled={isConnecting} className="h-14 px-6">
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
                <Button onClick={handleDisconnect} variant="destructive" className="h-14 px-6">
                  Disconnect
                </Button>
              </>
            )}
          </div>

          {!isConnected && (
            <Alert>
              <AlertDescription>
                Click "Connect USB Printer" to select your USB CPCL printer. Make sure the printer is plugged in and
                powered on.
              </AlertDescription>
            </Alert>
          )}

          {isConnected && (
            <Alert>
              <AlertDescription>
                <strong>Test Print:</strong> Click "Test Print" to send a sample label with a barcode to verify the
                printer connection and settings.
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
          <CardDescription>Verify keyboard-wedge scanner configuration</CardDescription>
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
              <strong>Setup Instructions:</strong>
              <ol className="list-decimal list-inside mt-2 space-y-1">
                <li>Configure scanner for keyboard wedge mode</li>
                <li>Set suffix to "Enter" or "Tab" for auto-advance</li>
                <li>Test by scanning into the Scan &amp; Print tab</li>
              </ol>
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    </div>
  );
}
