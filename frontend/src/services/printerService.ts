import { create } from 'zustand';
import { addLog } from '../state/logStore';
import {
  requestDevice,
  reconnectToDevice,
  disconnectDevice,
  sendData,
  saveLastPrinterIdentifier,
  loadLastPrinterIdentifier,
  type UsbDevice,
} from './usbCpclTransport';
import { getCurrentSettings } from '../state/labelSettingsStore';
import { generateTestPrintCPCL, generateCPCL } from '../printing/cpclGenerator';

export type PrinterStatus = 'disconnected' | 'connecting' | 'connected' | 'error';

interface PrinterState {
  status: PrinterStatus;
  errorMessage: string | null;
  usbDevice: UsbDevice | null;
  deviceName: string | null;
  isAutoReconnecting: boolean;

  connectPrinter: () => Promise<void>;
  disconnectPrinter: () => Promise<void>;
  autoReconnectPrinter: () => Promise<void>;
  printCPCL: (cpcl: string) => Promise<void>;
  testPrint: () => Promise<void>;
}

export const usePrinterStore = create<PrinterState>((set, get) => ({
  status: 'disconnected',
  errorMessage: null,
  usbDevice: null,
  deviceName: null,
  isAutoReconnecting: false,

  connectPrinter: async () => {
    set({ status: 'connecting', errorMessage: null });
    try {
      const usbDevice = await requestDevice();
      if (!usbDevice) {
        set({ status: 'disconnected', errorMessage: null });
        return;
      }

      const deviceName =
        usbDevice.device.productName ||
        `USB Device (${usbDevice.vendorId.toString(16)}:${usbDevice.productId.toString(16)})`;

      // Save printer identifier for auto-reconnect
      saveLastPrinterIdentifier({
        vendorId: usbDevice.vendorId,
        productId: usbDevice.productId,
        serialNumber: usbDevice.serialNumber,
      });

      set({ status: 'connected', usbDevice, deviceName, errorMessage: null });
      addLog('info', `Printer connected: ${deviceName}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      set({ status: 'error', errorMessage: msg });
      addLog('error', `Printer connection failed: ${msg}`);
    }
  },

  disconnectPrinter: async () => {
    const { usbDevice } = get();
    if (usbDevice) {
      await disconnectDevice(usbDevice);
    }
    set({ status: 'disconnected', usbDevice: null, deviceName: null, errorMessage: null });
    addLog('info', 'Printer disconnected');
  },

  autoReconnectPrinter: async () => {
    const { status } = get();
    if (status === 'connected' || status === 'connecting') return;

    const savedId = loadLastPrinterIdentifier();
    if (!savedId) return;

    set({ isAutoReconnecting: true });
    addLog('info', 'Attempting auto-reconnect to last printer...');

    try {
      const usbDevice = await reconnectToDevice(savedId);
      if (!usbDevice) {
        addLog('info', 'Auto-reconnect: printer not found or not authorized yet.');
        set({ isAutoReconnecting: false });
        return;
      }

      const deviceName =
        usbDevice.device.productName ||
        `USB Device (${usbDevice.vendorId.toString(16)}:${usbDevice.productId.toString(16)})`;

      set({ status: 'connected', usbDevice, deviceName, errorMessage: null, isAutoReconnecting: false });
      addLog('info', `Auto-reconnected to printer: ${deviceName}`);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog('warn', `Auto-reconnect failed: ${msg}`);
      set({ isAutoReconnecting: false });
    }
  },

  printCPCL: async (cpcl: string) => {
    const { usbDevice } = get();
    if (!usbDevice) {
      throw new Error('No printer connected');
    }

    const encoder = new TextEncoder();
    const data = encoder.encode(cpcl);

    try {
      await sendData(usbDevice, data);
      addLog('info', 'Print job sent successfully');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      addLog('error', `Print failed: ${msg}`);
      set({ status: 'error', errorMessage: msg });
      throw err;
    }
  },

  testPrint: async () => {
    const { printCPCL } = get();
    const settings = getCurrentSettings();

    const prefixes = Object.keys(settings.prefixMappings);
    if (prefixes.length > 0) {
      const firstPrefix = prefixes[0];
      const testSerial1 = `${firstPrefix}000001`;
      const testSerial2 = `${firstPrefix}000002`;
      const cpcl = generateCPCL(settings, testSerial1, testSerial2, firstPrefix);
      await printCPCL(cpcl);
    } else {
      const cpcl = generateTestPrintCPCL();
      await printCPCL(cpcl);
    }

    addLog('info', 'Test print sent');
  },
}));

// Legacy alias so existing code that imports usePrinterService still compiles
export const usePrinterService = usePrinterStore;
