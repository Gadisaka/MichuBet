/**
 * Branch location line for thermal receipts (HTML + ESC/POS).
 */
export function formatCashierReceiptLine(ticket) {
  const branchLocation = String(ticket?.branchLocation ?? "").trim();
  return branchLocation || "—";
}

/** Branch name + selling cashier for payment receipts. */
export function formatBranchAgentLine(ticket) {
  const branch = String(ticket?.branchName ?? "").trim();
  const agent = String(ticket?.cashierName ?? "").trim();
  if (branch && agent) return `${branch} : ${agent}`;
  return branch || agent || "—";
}

/** Human-readable selection result for UI and receipts. */
export function formatSelectionResult(result) {
  const value = String(result || "PENDING").toUpperCase();
  switch (value) {
    case "WON":
      return "Won";
    case "LOST":
      return "Lost";
    case "VOID":
      return "Refunded";
    case "PENDING":
      return "Pending";
    default:
      return value;
  }
}

/** Display handle for CMS contact entries on thermal receipts. */
export function formatContactHandle(entry) {
  const name = String(entry?.name ?? "").trim();
  const link = String(entry?.link ?? "").trim();
  if (!link) return name || "—";
  try {
    const u = new URL(link);
    const path = u.pathname.replace(/^\//, "");
    if (path.startsWith("@")) return path;
    const segment = path.split("/").filter(Boolean).pop();
    if (u.hostname.includes("t.me") && segment) {
      return segment.startsWith("@") ? segment : `@${segment}`;
    }
    if (segment) {
      return segment.startsWith("@") ? segment : `@${segment}`;
    }
  } catch {
    return link;
  }
  return name || link;
}
