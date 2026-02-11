/**
 * WebUSB transport layer for USB CPCL printers
 *
 * Provides device discovery, connection management, and data transmission
 * for CPCL-compatible label printers via WebUSB API.
 */

import { addLog } from '../state/logStore';

// WebUSB API type definitions
export interface USBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  configurations: USBConfiguration[];
  opened: boolean;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
  transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
}

export interface USBConfiguration {
  configurationValue: number;
  interfaces: USBInterface[];
}

export interface USBInterface {
  interfaceNumber: number;
  alternates: USBAlternateInterface[];
}

export interface USBAlternateInterface {
  alternateSetting: number;
  interfaceClass: number;
  endpoints: USBEndpoint[];
}

export interface USBEndpoint {
  endpointNumber: number;
  direction: 'in' | 'out';
  type: 'bulk' | 'interrupt' | 'isochronous';
}

export interface USBOutTransferResult {
  bytesWritten: number;
  status: 'ok' | 'stall' | 'babble';
}

export interface USBInTransferResult {
  data?: DataView;
  status: 'ok' | 'stall' | 'babble';
}

export interface USB {
  getDevices(): Promise<USBDevice[]>;
  requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
}

export interface USBDeviceRequestOptions {
  filters: USBDeviceFilter[];
}

export interface USBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
}

declare global {
  interface Navigator {
    usb?: USB;
  }
}

export interface USBPrinterDevice {
  device: USBDevice;
  endpointOut: number;
}

/**
 * Check if WebUSB is supported in the current browser
 */
export function isWebUSBSupported(): boolean {
  return 'usb' in navigator;
}

/**
 * Request user to select a USB printer device
 * Opens browser's device picker dialog
 */
export async function requestUSBPrinter(): Promise<USBPrinterDevice | null> {
  if (!isWebUSBSupported()) {
    throw new Error('WebUSB is not supported in this browser');
  }

  try {
    // Request any USB device (user will select from available devices)
    // We use a broad filter to allow any printer class device
    const device = await navigator.usb!.requestDevice({
      filters: [
        { classCode: 0x07 }, // Printer class
        { classCode: 0xff }, // Vendor-specific (many printers use this)
      ],
    });

    addLog('info', `USB device selected: ${device.productName || 'Unknown'}`, {
      category: 'printer',
      vendorId: device.vendorId,
      productId: device.productId,
    });

    // Open and configure the device
    await device.open();
    addLog('info', 'USB device opened', { category: 'printer' });

    // Select first configuration
    if (device.configurations.length > 0) {
      await device.selectConfiguration(device.configurations[0].configurationValue);
      addLog('info', 'USB configuration selected', { category: 'printer' });
    }

    // Find the first bulk OUT endpoint
    let endpointOut: number | null = null;
    let interfaceNumber: number | null = null;

    for (const config of device.configurations) {
      for (const iface of config.interfaces) {
        for (const alt of iface.alternates) {
          for (const endpoint of alt.endpoints) {
            if (endpoint.direction === 'out' && endpoint.type === 'bulk') {
              endpointOut = endpoint.endpointNumber;
              interfaceNumber = iface.interfaceNumber;
              break;
            }
          }
          if (endpointOut !== null) break;
        }
        if (endpointOut !== null) break;
      }
      if (endpointOut !== null) break;
    }

    if (endpointOut === null || interfaceNumber === null) {
      await device.close();
      throw new Error('No suitable bulk OUT endpoint found on the USB device');
    }

    // Claim the interface
    await device.claimInterface(interfaceNumber);
    addLog('info', `USB interface ${interfaceNumber} claimed, endpoint OUT: ${endpointOut}`, {
      category: 'printer',
      interfaceNumber,
      endpointOut,
    });

    return {
      device,
      endpointOut,
    };
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      // User cancelled the device picker
      addLog('info', 'USB device selection cancelled by user', { category: 'printer' });
      return null;
    }
    addLog('error', `USB device request failed: ${error.message}`, {
      category: 'printer',
      error: error.name,
    });
    throw error;
  }
}

/**
 * Send CPCL data to USB printer
 */
export async function sendCPCLToUSB(printerDevice: USBPrinterDevice, cpcl: string): Promise<void> {
  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(cpcl);

    addLog('info', `Sending ${data.length} bytes to USB printer`, {
      category: 'printer',
      dataLength: data.length,
    });

    const result = await printerDevice.device.transferOut(printerDevice.endpointOut, data);

    if (result.status !== 'ok') {
      throw new Error(`USB transfer failed with status: ${result.status}`);
    }

    if (result.bytesWritten !== data.length) {
      addLog('warn', `USB transfer incomplete: ${result.bytesWritten}/${data.length} bytes written`, {
        category: 'printer',
        bytesWritten: result.bytesWritten,
        totalBytes: data.length,
      });
    } else {
      addLog('info', 'USB transfer completed successfully', {
        category: 'printer',
        bytesWritten: result.bytesWritten,
      });
    }
  } catch (error: any) {
    addLog('error', `USB transfer error: ${error.message}`, {
      category: 'printer',
      error: error.name,
    });
    throw new Error(`Failed to send data to printer: ${error.message}`);
  }
}

/**
 * Disconnect from USB printer
 */
export async function disconnectUSBPrinter(printerDevice: USBPrinterDevice): Promise<void> {
  try {
    await printerDevice.device.close();
    addLog('info', 'USB printer disconnected', { category: 'printer' });
  } catch (error: any) {
    addLog('error', `USB disconnect error: ${error.message}`, {
      category: 'printer',
      error: error.name,
    });
    throw error;
  }
}
