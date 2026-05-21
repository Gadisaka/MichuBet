import { useCallback, useEffect, useRef, useState } from "react";
import { buildTicketPdfFilename, downloadTicketPdf } from "./pdfGenerator";
import { encodeTicketAsync } from "./escpos";
import {
  getBarcodePayload,
  renderBarcodeToDataURL,
} from "./ticketBarcode";
import {
  isWebUSBSupported,
  printViaWebUSB,
  requestPrinter,
  getPrinterInfo,
  forgetPrinter,
} from "./WebUSBPrinter";

/**
 * Orchestrates the cashier print flow:
 *
 *   1. Generates a Code 128 barcode data URL (receipt or coupon) for
 *      <TicketTemplate> under the logo.
 *   2. Returns a `ticketRef` to attach to the off-screen <TicketTemplate>.
 *   3. Exposes `print()` which:
 *        a. tries WebUSB direct printing (silent, no dialog),
 *        b. returns reason codes for UI handling when it cannot print.
 *   4. Exposes `downloadPdf()` for manual backup export.
 *   5. Exposes `pairPrinter()` to let cashiers select their USB printer once.
 *
 * Print priority: WebUSB only (silent).
 */
export function useTicketPrint(
  ticket,
  { width = "80mm", preferWebUSB = true, platformWinningsTax = null } = {},
) {
  const ticketRef = useRef(null);
  const [barcodeDataUrl, setBarcodeDataUrl] = useState("");
  const [pdfBusy, setPdfBusy] = useState(false);
  const [lastError, setLastError] = useState("");
  const [printerInfo, setPrinterInfo] = useState(null);
  const [webUSBSupported] = useState(() => isWebUSBSupported());

  const barcodePayload = getBarcodePayload(ticket);

  useEffect(() => {
    let alive = true;
    if (!barcodePayload) {
      setBarcodeDataUrl("");
      return () => {
        alive = false;
      };
    }
    const url = renderBarcodeToDataURL(barcodePayload);
    if (alive) setBarcodeDataUrl(url);
    return () => {
      alive = false;
    };
  }, [barcodePayload]);

  useEffect(() => {
    if (webUSBSupported) {
      getPrinterInfo().then(setPrinterInfo).catch(() => setPrinterInfo(null));
    }
  }, [webUSBSupported]);

  const downloadPdf = useCallback(async () => {
    if (!ticketRef.current) {
      setLastError("Ticket not ready");
      return false;
    }
    setPdfBusy(true);
    setLastError("");
    try {
      await downloadTicketPdf({
        node: ticketRef.current,
        filename: buildTicketPdfFilename(ticket),
        width,
      });
      return true;
    } catch (error) {
      setLastError(error?.message || "Failed to generate PDF");
      return false;
    } finally {
      setPdfBusy(false);
    }
  }, [ticket, width]);

  const print = useCallback(async () => {
    if (!ticket) return { printed: false, method: "none", fellBackToPdf: false };
    setLastError("");

    if (preferWebUSB && webUSBSupported) {
      try {
        const escposData = await encodeTicketAsync(ticket, {
          width,
          platformWinningsTax,
        });
        const result = await printViaWebUSB(escposData, { allowPrompt: false });

        if (result.success) {
          return { printed: true, method: "webusb", reason: "success" };
        }

        if (result.error?.message === "No printer selected") {
          setLastError("No USB printer paired. Click \"Pair USB Printer\" first.");
          return { printed: false, method: "webusb", reason: "no_printer_selected" };
        }

        const errorMessage = String(result.error?.message || "");
        if (/access denied/i.test(errorMessage)) {
          setLastError(errorMessage);
          return { printed: false, method: "webusb", reason: "access_denied" };
        }

        setLastError(errorMessage || "USB printing failed");
        return { printed: false, method: "webusb", reason: "other_error" };
      } catch (error) {
        setLastError(error?.message || "Failed to prepare USB print data");
        return { printed: false, method: "webusb", reason: "other_error" };
      }
    }

    setLastError("WebUSB is not supported in this browser. Use Chrome or Edge.");
    return { printed: false, method: "none", reason: "webusb_unsupported" };
  }, [ticket, width, preferWebUSB, webUSBSupported, platformWinningsTax]);

  const retryPrint = useCallback(async () => {
    return print();
  }, [print]);

  const pairPrinter = useCallback(async () => {
    if (!webUSBSupported) {
      setLastError("WebUSB is not supported in this browser. Use Chrome or Edge.");
      return false;
    }
    try {
      const device = await requestPrinter();
      if (device) {
        const info = await getPrinterInfo();
        setPrinterInfo(info);
        setLastError("");
        return true;
      }
      return false;
    } catch (error) {
      setLastError(error?.message || "Failed to pair printer");
      return false;
    }
  }, [webUSBSupported]);

  const unpairPrinter = useCallback(async () => {
    await forgetPrinter();
    setPrinterInfo(null);
  }, []);

  const testPrint = useCallback(async () => {
    if (!webUSBSupported) {
      setLastError("WebUSB is not supported");
      return false;
    }

    const testData = await encodeTicketAsync(
      {
        couponNumber: "ab000000",
        receiptNumber: "99999-88888",
        cashierId: "TEST",
        cashierName: "Test Cashier",
        branchName: "Test Branch",
        branchLocation: "HQ",
        status: "TEST",
        createdAt: new Date().toISOString(),
        stake: 100,
        totalOdds: 2.5,
        potentialWin: 250,
        selections: [
          {
            match: { homeTeam: "Team A", awayTeam: "Team B", startTime: new Date().toISOString() },
            selection: "Team A Win",
            marketLabel: "1X2",
            odds: 2.5,
          },
        ],
      },
      { width, platformWinningsTax: null },
    );

    const result = await printViaWebUSB(testData, { allowPrompt: true });
    if (!result.success) {
      setLastError(result.error?.message || "Test print failed");
      return false;
    }
    return true;
  }, [webUSBSupported, width]);

  return {
    ticketRef,
    barcodeDataUrl,
    print,
    retryPrint,
    downloadPdf,
    pdfBusy,
    lastError,
    webUSBSupported,
    printerInfo,
    pairPrinter,
    unpairPrinter,
    testPrint,
  };
}
