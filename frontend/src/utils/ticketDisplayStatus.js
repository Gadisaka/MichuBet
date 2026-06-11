/**
 * UI status buckets for public check-ticket receipt display.
 */

/**
 * @param {string|undefined|null} rawStatus
 * @returns {{ key: 'won'|'lost'|'pending'|'cancelled', label: string }}
 */
export function mapTicketUiStatus(rawStatus) {
  const key = String(rawStatus || "").toUpperCase();
  if (key === "WON" || key === "PAID") {
    return { key: "won", label: "WON" };
  }
  if (key === "LOST") {
    return { key: "lost", label: "LOST" };
  }
  if (key === "VOID" || key === "CANCELED" || key === "CASHED_OUT") {
    return { key: "cancelled", label: "CANCELLED" };
  }
  return { key: "pending", label: "PENDING" };
}

/**
 * @param {{ result?: string, status?: string|null, kickoffAt?: string|null }} sel
 * @returns {{ key: 'won'|'lost'|'pending', label: string }}
 */
export function mapLegUiStatus(sel) {
  const result = String(sel?.result || "PENDING").toUpperCase();
  if (result === "WON") return { key: "won", label: "WON" };
  if (result === "LOST") return { key: "lost", label: "LOST" };
  return { key: "pending", label: "PENDING" };
}
