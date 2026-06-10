/**
 * Branch location line for thermal receipts (HTML + ESC/POS).
 */
export function formatCashierReceiptLine(ticket) {
  const branchLocation = String(ticket?.branchLocation ?? "").trim();
  return branchLocation || "—";
}
