/**
 * WebUSB transport layer for USB CPCL printers
 */

import { addLog } from '../state/logStore';

// Extend Navigator to include WebUSB
declare global {
  interface Navigator {
    usb?: {
      getDevices(): Promise<WebUSBDevice[]>;
      requestDevice(options: { filters: WebUSBDeviceFilter[] }): Promise<WebUSBDevice>;
    };
  }
}

interface WebUSBDeviceFilter {
  vendorId?: number;
  productId?: number;
  classCode?: number;
  subclassCode?: number;
  protocolCode?: number;
  serialNumber?: string;
}

interface WebUSBDevice {
  vendorId: number;
  productId: number;
  productName?: string;
  manufacturerName?: string;
  serialNumber?: string;
  configuration: { configurationValue: number } | null;
  configurations: Array<{
    configurationValue: number;
    interfaces: Array<{
      interfaceNumber: number;
      alternates: Array<{
        alternateSetting: number;
        interfaceClass: number;
        endpoints: Array<{
          endpointNumber: number;
          direction: 'in' | 'out';
          type: 'bulk' | 'interrupt' | 'isochronous';
        }>;
      }>;
    }>;
  }>;
  open(): Promise<void>;
  close(): Promise<void>;
  selectConfiguration(configurationValue: number): Promise<void>;
  claimInterface(interfaceNumber: number): Promise<void>;
  releaseInterface(interfaceNumber: number): Promise<void>;
  transferOut(endpointNumber: number, data: BufferSource): Promise<{ bytesWritten: number; status: string }>;
}

export interface UsbDevice {
  device: WebUSBDevice;
  vendorId: number;
  productId: number;
  serialNumber?: string;
  interfaceNumber: number;
  endpointNumber: number;
}

export interface PrinterIdentifier {
  vendorId: number;
  productId: number;
  serialNumber?: string;
}

const LAST_PRINTER_KEY = 'lastConnectedPrinter';

export function saveLastPrinterIdentifier(id: PrinterIdentifier): void {
  try {
    localStorage.setItem(LAST_PRINTER_KEY, JSON.stringify(id));
  } catch {
    // ignore
  }
}

export function loadLastPrinterIdentifier(): PrinterIdentifier | null {
  try {
    const raw = localStorage.getItem(LAST_PRINTER_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PrinterIdentifier;
  } catch {
    return null;
  }
}

export function clearLastPrinterIdentifier(): void {
  try {
    localStorage.removeItem(LAST_PRINTER_KEY);
  } catch {
    // ignore
  }
}

function findEndpoint(device: WebUSBDevice): { interfaceNumber: number; endpointNumber: number } | null {
  for (const config of device.configurations) {
    for (const iface of config.interfaces) {
      for (const alt of iface.alternates) {
        for (const endpoint of alt.endpoints) {
          if (endpoint.direction === 'out' && endpoint.type === 'bulk') {
            return { interfaceNumber: iface.interfaceNumber, endpointNumber: endpoint.endpointNumber };
          }
        }
      }
    }
  }
  return null;
}

export async function requestDevice(): Promise<UsbDevice | null> {
  if (!navigator.usb) {
    throw new Error('WebUSB is not supported in this browser.');
  }

  let device: WebUSBDevice;
  try {
    device = await navigator.usb.requestDevice({ filters: [] });
  } catch (err: unknown) {
    if (err instanceof Error && err.name === 'NotFoundError') {
      return null;
    }
    throw err;
  }

  return openDevice(device);
}

export async function reconnectToDevice(id: PrinterIdentifier): Promise<UsbDevice | null> {
  if (!navigator.usb) return null;

  try {
    const devices = await navigator.usb.getDevices();
    const match = devices.find(
      (d) =>
        d.vendorId === id.vendorId &&
        d.productId === id.productId &&
        (id.serialNumber == null || d.serialNumber === id.serialNumber)
    );

    if (!match) return null;

    return openDevice(match);
  } catch {
    return null;
  }
}

async function openDevice(device: WebUSBDevice): Promise<UsbDevice | null> {
  try {
    await device.open();

    if (device.configuration == null) {
      await device.selectConfiguration(1);
    }

    const ep = findEndpoint(device);
    if (!ep) {
      await device.close();
      throw new Error('No bulk OUT endpoint found on this USB device.');
    }

    try {
      await device.claimInterface(ep.interfaceNumber);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'InvalidStateError') {
        await device.close();
        throw err;
      }
    }

    addLog('info', `USB device opened: ${device.productName || 'Unknown'}`, {
      category: 'printer',
      vendorId: device.vendorId,
      productId: device.productId,
    });

    return {
      device,
      vendorId: device.vendorId,
      productId: device.productId,
      serialNumber: device.serialNumber ?? undefined,
      interfaceNumber: ep.interfaceNumber,
      endpointNumber: ep.endpointNumber,
    };
  } catch (err) {
    try { await device.close(); } catch { /* ignore */ }
    throw err;
  }
}

export async function disconnectDevice(usbDevice: UsbDevice): Promise<void> {
  try {
    await usbDevice.device.releaseInterface(usbDevice.interfaceNumber);
  } catch {
    // ignore
  }
  try {
    await usbDevice.device.close();
  } catch {
    // ignore
  }
}

export async function sendData(usbDevice: UsbDevice, data: Uint8Array): Promise<void> {
  const CHUNK_SIZE = 16384;
  let offset = 0;

  while (offset < data.length) {
    const chunk = data.slice(offset, offset + CHUNK_SIZE);
    const result = await usbDevice.device.transferOut(usbDevice.endpointNumber, chunk);

    if (result.status !== 'ok') {
      throw new Error(`USB transfer failed with status: ${result.status}`);
    }

    offset += chunk.byteLength;
  }
}
