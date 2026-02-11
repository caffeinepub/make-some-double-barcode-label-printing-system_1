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
import { generateCPCL, generateTestPrintCPCL } from '../printing/cpclGenerator';
import { addLog } from '../state/logStore';

type ConnectionMethod = 'usb';

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

            addLog('info', 'USB printer connected successfully', {
              category: 'printer',
              method: 'usb',
            });
          } else {
            throw new Error('Unsupported connection method. Only USB is supported.');
          }
        } catch (error: any) {
          set({ isConnecting: false });
          addLog('error', `Printer connection failed: ${error.message}`, {
            category: 'printer',
            method,
          });
          throw error;
        }
      },

      disconnect: async () => {
        const { usbDevice, connectionMethod } = get();

        if (connectionMethod === 'usb' && usbDevice) {
          await disconnectUSBPrinter(usbDevice);
          addLog('info', 'USB printer disconnected', {
            category: 'printer',
          });
        }

        set({
          isConnected: false,
          connectionMethod: null,
          usbDevice: null,
        });
      },

      refresh: async () => {
        set({ isConnecting: true });
        await new Promise((resolve) => setTimeout(resolve, 500));
        set({ isConnecting: false });
      },

      sendCPCL: async (cpcl: string) => {
        const { isConnected, connectionMethod, usbDevice } = get();

        if (!isConnected) {
          throw new Error('Printer not connected');
        }

        if (connectionMethod === 'usb' && usbDevice) {
          await sendCPCLToUSB(usbDevice, cpcl);
          addLog('info', 'CPCL sent to USB printer successfully', {
            category: 'printer',
            cpclLength: cpcl.length,
          });
        } else {
          throw new Error('No valid printer connection');
        }
      },

      testPrint: async () => {
        const { isConnected, sendCPCL } = get();

        if (!isConnected) {
          throw new Error('Printer not connected');
        }

        addLog('info', 'Starting test print', {
          category: 'printer',
        });

        // Get current settings or use safe defaults
        const settings = getCurrentSettings();

        if (!settings || settings.prefixMappings.length === 0) {
          // Use the shared test print generator with correct BARCODE syntax
          const testCPCL = generateTestPrintCPCL();
          await sendCPCL(testCPCL);
        } else {
          // Generate a test label using current settings with real barcode generation
          const testCPCL = generateCPCL(
            settings,
            'TEST-SERIAL-001',
            'TEST-SERIAL-002',
            settings.prefixMappings[0]?.[0] || 'TEST'
          );
          await sendCPCL(testCPCL);
        }

        addLog('info', 'Test print completed successfully', {
          category: 'printer',
        });
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
