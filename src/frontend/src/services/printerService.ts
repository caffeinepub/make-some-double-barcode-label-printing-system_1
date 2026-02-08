import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
  isWebUSBSupported,
  requestUSBPrinter,
  sendCPCLToUSB,
  disconnectUSBPrinter,
  type USBPrinterDevice,
} from './usbCpclTransport';
import { getCurrentSettings } from '../state/labelSettingsStore';
import { generateCPCL } from '../printing/cpclGenerator';

type ConnectionMethod = 'bluetooth' | 'usb';

interface PrinterState {
  isConnected: boolean;
  isConnecting: boolean;
  connectionMethod: ConnectionMethod | null;
  usbDevice: USBPrinterDevice | null;
  connect: (method: ConnectionMethod) => Promise<void>;
  disconnect: () => void;
  refresh: () => Promise<void>;
  sendCPCL: (cpcl: string) => Promise<void>;
  testPrint: () => Promise<void>;
}

export const usePrinterService = create<PrinterState>()(
  persist(
    (set, get) => ({
      isConnected: false,
      isConnecting: false,
      connectionMethod: null,
      usbDevice: null,

      connect: async (method: ConnectionMethod) => {
        set({ isConnecting: true });
        
        try {
          if (method === 'usb') {
            // Check WebUSB support
            if (!isWebUSBSupported()) {
              throw new Error('WebUSB is not supported in this browser. Please use Chrome, Edge, or Opera.');
            }

            // Request USB printer
            const device = await requestUSBPrinter();
            if (!device) {
              // User cancelled
              set({ isConnecting: false });
              return;
            }

            set({
              isConnected: true,
              isConnecting: false,
              connectionMethod: 'usb',
              usbDevice: device,
            });
          } else {
            // Bluetooth connection (simulated for now)
            await new Promise(resolve => setTimeout(resolve, 1000));
            set({
              isConnected: true,
              isConnecting: false,
              connectionMethod: 'bluetooth',
            });
          }
        } catch (error: any) {
          set({ isConnecting: false });
          throw error;
        }
      },

      disconnect: async () => {
        const { usbDevice, connectionMethod } = get();
        
        if (connectionMethod === 'usb' && usbDevice) {
          await disconnectUSBPrinter(usbDevice);
        }
        
        set({
          isConnected: false,
          connectionMethod: null,
          usbDevice: null,
        });
      },

      refresh: async () => {
        const { isConnected } = get();
        set({ isConnecting: true });
        await new Promise(resolve => setTimeout(resolve, 500));
        set({ isConnecting: false });
      },

      sendCPCL: async (cpcl: string) => {
        const { isConnected, connectionMethod, usbDevice } = get();
        
        if (!isConnected) {
          throw new Error('Printer not connected');
        }

        if (connectionMethod === 'usb' && usbDevice) {
          await sendCPCLToUSB(usbDevice, cpcl);
        } else {
          // Bluetooth or simulated printing
          console.log('Sending CPCL to printer:', cpcl);
          await new Promise(resolve => setTimeout(resolve, 500));
        }
      },

      testPrint: async () => {
        const { isConnected, sendCPCL } = get();
        
        if (!isConnected) {
          throw new Error('Printer not connected');
        }

        // Get current settings or use safe defaults
        const settings = getCurrentSettings();
        
        if (!settings) {
          // Use a simple built-in test pattern
          const testCPCL = `! 0 200 200 240 1
PAGE-WIDTH 384
TEXT 4 0 20 20 TEST PRINT
TEXT 4 0 20 60 Label Printer
TEXT 4 0 20 100 Connection OK
BARCODE CODE128 0 1 60 20 140 TEST123
PRINT
`;
          await sendCPCL(testCPCL);
        } else {
          // Generate a test label using current settings
          const testCPCL = generateCPCL(
            settings,
            'TEST-SERIAL-001',
            'TEST-SERIAL-002',
            settings.prefixMappings[0]?.[0] || 'TEST'
          );
          await sendCPCL(testCPCL);
        }
      },
    }),
    {
      name: 'printer-service',
      partialize: (state) => ({
        isConnected: false, // Don't persist connection state
        connectionMethod: state.connectionMethod,
      }),
    }
  )
);
