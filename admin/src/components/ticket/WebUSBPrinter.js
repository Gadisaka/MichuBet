/**
 * WebUSB interface for thermal POS printers.
 *
 * WebUSB lets browsers communicate directly with USB devices, bypassing the
 * OS print spooler and dialog entirely. The user grants permission once per
 * device, then subsequent prints are silent.
 *
 * Requirements:
 *   - HTTPS (or localhost)
 *   - Chrome/Edge 61+ (Firefox doesn't support WebUSB)
 *   - Thermal printer connected via USB (not network or Bluetooth)
 *
 * Common thermal printer USB Vendor IDs:
 *   - Epson: 0x04b8
 *   - Star Micronics: 0x0519
 *   - SNBC/Sewoo: 0x0dd4
 *   - Bixolon: 0x1504
 *   - Citizen: 0x1d90
 *   - Custom: 0x0dd4
 *   - Generic POS: 0x0fe6, 0x0483, 0x1fc9
 */

const KNOWN_VENDOR_IDS = [
  0x04b8, // Epson
  0x0519, // Star Micronics
  0x0dd4, // SNBC / Sewoo
  0x1504, // Bixolon
  0x1d90, // Citizen
  0x0fe6, // Generic POS
  0x0483, // STMicroelectronics (some POS printers)
  0x1fc9, // NXP (some POS printers)
  0x0416, // Winbond (some POS printers)
  0x0456, // Analog Devices (some POS printers)
  0x067b, // Prolific (USB-to-serial adapters used by some printers)
];

let cachedDevice = null;

/**
 * Check if WebUSB is available in this browser.
 */
export function isWebUSBSupported() {
  return typeof navigator !== "undefined" && "usb" in navigator;
}

/**
 * Request the user to select a USB printer (shows browser picker).
 * This must be called from a user gesture (click handler).
 *
 * @returns {Promise<USBDevice|null>}
 */
export async function requestPrinter() {
  if (!isWebUSBSupported()) {
    throw new Error("WebUSB is not supported in this browser");
  }

  const filters = KNOWN_VENDOR_IDS.map((vendorId) => ({ vendorId }));

  try {
    const device = await navigator.usb.requestDevice({ filters });
    cachedDevice = device;
    return device;
  } catch (error) {
    if (error.name === "NotFoundError") {
      return null;
    }
    throw error;
  }
}

/**
 * Get a previously paired printer without prompting.
 * Returns null if no printer was previously paired.
 *
 * @returns {Promise<USBDevice|null>}
 */
export async function getPairedPrinter() {
  if (!isWebUSBSupported()) return null;

  if (cachedDevice) return cachedDevice;

  const devices = await navigator.usb.getDevices();
  if (devices.length > 0) {
    cachedDevice = devices[0];
    return cachedDevice;
  }

  return null;
}

/**
 * Find the bulk OUT endpoint for sending data to the printer.
 */
function findBulkOutEndpoint(device) {
  for (const iface of device.configuration?.interfaces || []) {
    for (const alt of iface.alternates) {
      for (const endpoint of alt.endpoints) {
        if (endpoint.direction === "out" && endpoint.type === "bulk") {
          return { interfaceNumber: iface.interfaceNumber, endpointNumber: endpoint.endpointNumber };
        }
      }
    }
  }
  return null;
}

/**
 * Send raw ESC/POS data to a USB printer.
 *
 * @param {USBDevice} device - The USB device to print to
 * @param {Uint8Array} data - ESC/POS command bytes
 * @returns {Promise<void>}
 */
export async function sendToPrinter(device, data) {
  if (!device) {
    throw new Error("No printer device provided");
  }

  try {
    await device.open();

    if (device.configuration === null) {
      await device.selectConfiguration(1);
    }

    const endpoint = findBulkOutEndpoint(device);
    if (!endpoint) {
      throw new Error("Could not find bulk OUT endpoint on printer");
    }

    await device.claimInterface(endpoint.interfaceNumber);

    const CHUNK_SIZE = 64;
    for (let offset = 0; offset < data.length; offset += CHUNK_SIZE) {
      const chunk = data.slice(offset, offset + CHUNK_SIZE);
      await device.transferOut(endpoint.endpointNumber, chunk);
    }

    await device.releaseInterface(endpoint.interfaceNumber);
    await device.close();
  } catch (error) {
    try {
      await device.close();
    } catch {
      // Ignore close errors
    }
    throw error;
  }
}

/**
 * High-level print function: get paired printer or prompt, then send data.
 *
 * @param {Uint8Array} data - ESC/POS command bytes
 * @param {Object} opts
 * @param {boolean} [opts.allowPrompt=true] - If true, prompts user to select
 *   printer if none is paired. Set to false for silent-only printing.
 * @returns {Promise<{success: boolean, prompted: boolean, error?: Error}>}
 */
export async function printViaWebUSB(data, { allowPrompt = true } = {}) {
  if (!isWebUSBSupported()) {
    return { success: false, prompted: false, error: new Error("WebUSB not supported") };
  }

  let device = await getPairedPrinter();
  let prompted = false;

  if (!device && allowPrompt) {
    try {
      device = await requestPrinter();
      prompted = true;
    } catch (error) {
      return { success: false, prompted: true, error };
    }
  }

  if (!device) {
    return {
      success: false,
      prompted,
      error: new Error("No printer selected"),
    };
  }

  try {
    await sendToPrinter(device, data);
    return { success: true, prompted, error: undefined };
  } catch (error) {
    return { success: false, prompted, error };
  }
}

/**
 * Forget the cached/paired printer (useful for switching printers).
 */
export async function forgetPrinter() {
  if (cachedDevice) {
    try {
      await cachedDevice.forget?.();
    } catch {
      // forget() may not be available in all browsers
    }
    cachedDevice = null;
  }
}

/**
 * Get info about the currently paired printer.
 */
export async function getPrinterInfo() {
  const device = await getPairedPrinter();
  if (!device) return null;

  return {
    vendorId: device.vendorId,
    productId: device.productId,
    productName: device.productName || "Unknown Printer",
    manufacturerName: device.manufacturerName || "Unknown",
    serialNumber: device.serialNumber || "",
  };
}
