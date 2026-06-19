/**
 * UI status buckets for public check-ticket receipt display.
 */

import { classifyLegStatus } from "./legResultStatus";

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
  if (key === "VOID" || key === "CANCELED" || key === "CASHED_OUT" || key === "EXPIRED") {
    return { key: "cancelled", label: key === "EXPIRED" ? "EXPIRED" : "CANCELLED" };
  }
  return { key: "pending", label: "PENDING" };
}

const LEG_UI_LABELS = {
  won: "WON",
  lost: "LOST",
  postponed: "PENDING",
  notplayed: "PENDING",
};

/**
 * @param {{ result?: string, status?: string|null, kickoffAt?: string|null }} sel
 * @param {number} [now]
 * @returns {{ key: 'won'|'lost'|'postponed'|'notplayed', label: string }}
 */
export function mapLegUiStatus(sel, now = Date.now()) {
  const key = classifyLegStatus(sel, now);
  if (key === "postponed") {
    const status = String(sel?.status || "")
      .trim()
      .toUpperCase();
    if (status === "PST" || status === "POSTPONED") {
      return { key, label: "POSTPONED" };
    }
  }
  return { key, label: LEG_UI_LABELS[key] ?? "PENDING" };
}
