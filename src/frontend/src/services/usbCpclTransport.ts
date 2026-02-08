/**
 * USB CPCL Transport using WebUSB API
 * Handles connection and communication with USB CPCL printers
 */

// WebUSB type definitions (for browsers that support it)
declare global {
  interface Navigator {
    usb?: USB;
  }

  interface USB {
    requestDevice(options: USBDeviceRequestOptions): Promise<USBDevice>;
    getDevices(): Promise<USBDevice[]>;
  }

  interface USBDeviceRequestOptions {
    filters: USBDeviceFilter[];
  }

  interface USBDeviceFilter {
    vendorId?: number;
    productId?: number;
    classCode?: number;
    subclassCode?: number;
    protocolCode?: number;
    serialNumber?: string;
  }

  interface USBDevice {
    opened: boolean;
    vendorId: number;
    productId: number;
    deviceClass: number;
    deviceSubclass: number;
    deviceProtocol: number;
    productName?: string;
    manufacturerName?: string;
    serialNumber?: string;
    configuration: USBConfiguration | null;
    configurations: USBConfiguration[];
    
    open(): Promise<void>;
    close(): Promise<void>;
    selectConfiguration(configurationValue: number): Promise<void>;
    claimInterface(interfaceNumber: number): Promise<void>;
    releaseInterface(interfaceNumber: number): Promise<void>;
    transferOut(endpointNumber: number, data: BufferSource): Promise<USBOutTransferResult>;
    transferIn(endpointNumber: number, length: number): Promise<USBInTransferResult>;
  }

  interface USBConfiguration {
    configurationValue: number;
    configurationName?: string;
    interfaces: USBInterface[];
  }

  interface USBInterface {
    interfaceNumber: number;
    alternate: USBAlternateInterface;
    alternates: USBAlternateInterface[];
  }

  interface USBAlternateInterface {
    alternateSetting: number;
    interfaceClass: number;
    interfaceSubclass: number;
    interfaceProtocol: number;
    interfaceName?: string;
    endpoints: USBEndpoint[];
  }

  interface USBEndpoint {
    endpointNumber: number;
    direction: 'in' | 'out';
    type: 'bulk' | 'interrupt' | 'isochronous';
    packetSize: number;
  }

  interface USBOutTransferResult {
    bytesWritten: number;
    status: 'ok' | 'stall' | 'babble';
  }

  interface USBInTransferResult {
    data?: DataView;
    status: 'ok' | 'stall' | 'babble';
  }
}

export interface USBPrinterDevice {
  device: USBDevice;
  interface: number;
  endpoint: number;
}

/**
 * Check if WebUSB is supported in the current browser
 */
export function isWebUSBSupported(): boolean {
  return 'usb' in navigator && navigator.usb !== undefined;
}

/**
 * Request and connect to a USB printer
 * @returns Connected USB printer device or null if cancelled/failed
 */
export async function requestUSBPrinter(): Promise<USBPrinterDevice | null> {
  if (!isWebUSBSupported()) {
    throw new Error('WebUSB is not supported in this browser');
  }

  try {
    // Request device with printer class filter
    const device = await navigator.usb!.requestDevice({
      filters: [
        { classCode: 0x07 }, // Printer class
      ],
    });

    // Open the device
    await device.open();

    // Select configuration (usually the first one)
    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    // Find the printer interface and endpoint
    let printerInterface: number | null = null;
    let printerEndpoint: number | null = null;

    for (const iface of device.configuration!.interfaces) {
      // Look for printer interface (class 7)
      if (iface.alternate.interfaceClass === 0x07) {
        printerInterface = iface.interfaceNumber;
        
        // Find OUT endpoint
        for (const endpoint of iface.alternate.endpoints) {
          if (endpoint.direction === 'out') {
            printerEndpoint = endpoint.endpointNumber;
            break;
          }
        }
        
        if (printerEndpoint !== null) break;
      }
    }

    if (printerInterface === null || printerEndpoint === null) {
      await device.close();
      throw new Error('Could not find printer interface or endpoint');
    }

    // Claim the interface
    await device.claimInterface(printerInterface);

    return {
      device,
      interface: printerInterface,
      endpoint: printerEndpoint,
    };
  } catch (error: any) {
    if (error.name === 'NotFoundError') {
      // User cancelled the picker
      return null;
    }
    throw error;
  }
}

/**
 * Send CPCL data to the USB printer
 * @param printer - Connected USB printer device
 * @param cpcl - CPCL command string
 */
export async function sendCPCLToUSB(
  printer: USBPrinterDevice,
  cpcl: string
): Promise<void> {
  // Convert CPCL string to bytes
  const encoder = new TextEncoder();
  const data = encoder.encode(cpcl);

  // Send data to printer
  await printer.device.transferOut(printer.endpoint, data);
}

/**
 * Disconnect from USB printer
 * @param printer - Connected USB printer device
 */
export async function disconnectUSBPrinter(
  printer: USBPrinterDevice
): Promise<void> {
  try {
    await printer.device.releaseInterface(printer.interface);
    await printer.device.close();
  } catch (error) {
    console.error('Error disconnecting USB printer:', error);
  }
}
