/**
 * Pure filters for admin and cashier ticket watch lists.
 * Date bounds use the local calendar, matching the cashier dashboard.
 *
 * @module lib/ticketWatchQuery
 */
import { add } from "./moneyDecimal.js";
import { applyReportableTicketFilter } from "./ticketExpiry.js";
import { ticketWinningsTaxBreakdown, toMoney } from "./winningsTax.js";

export const TICKET_WATCH_CANDIDATE_CAP = 2000;
export const TICKET_WATCH_MAX_LIMIT = 50;
export const ADMIN_TICKET_WATCH_VIEWS = ["payable", "high-potential", "paid"];
export const CASHIER_TICKET_WATCH_VIEWS = ["payable", "high-potential"];

export class TicketWatchQueryError extends Error {
  /**
   * @param {string} message
   * @param {number} [statusCode]
   */
  constructor(message, statusCode = 400) {
    super(message);
    this.name = "TicketWatchQueryError";
    this.statusCode = statusCode;
  }
}

/**
 * @param {Date} date
 */
export function formatLocalYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * @param {unknown} value
 * @returns {{ y: number, mo: number, d: number } | null}
 */
function parseYmd(value) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const y = Number(match[1]);
  const mo = Number(match[2]);
  const d = Number(match[3]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
  const probe = new Date(y, mo - 1, d);
  if (
    probe.getFullYear() !== y ||
    probe.getMonth() !== mo - 1 ||
    probe.getDate() !== d
  ) {
    return null;
  }
  return { y, mo, d };
}

/**
 * @param {unknown} value
 * @returns {Date | null}
 */
export function parseLocalDateStart(value) {
  const parts = parseYmd(value);
  if (!parts) return null;
  return new Date(parts.y, parts.mo - 1, parts.d, 0, 0, 0, 0);
}

/**
 * @param {unknown} value
 * @returns {Date | null}
 */
export function parseLocalDateEnd(value) {
  const parts = parseYmd(value);
  if (!parts) return null;
  return new Date(parts.y, parts.mo - 1, parts.d, 23, 59, 59, 999);
}

/**
 * Today and yesterday, local calendar.
 * @param {Date} [now]
 */
export function defaultLastTwoLocalDays(now = new Date()) {
  const end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
  return {
    start,
    end,
    fromLabel: formatLocalYmd(start),
    toLabel: formatLocalYmd(end),
  };
}

/**
 * @param {{ from?: unknown, to?: unknown, required?: boolean, now?: Date }} args
 * @returns {{ start: Date, end: Date, fromLabel: string, toLabel: string } | null}
 */
export function resolveWatchDateRange({ from, to, required = false, now = new Date() }) {
  const fromText = String(from ?? "").trim();
  const toText = String(to ?? "").trim();
  if (!fromText && !toText) {
    return required ? defaultLastTwoLocalDays(now) : null;
  }
  const today = formatLocalYmd(now);
  const start = parseLocalDateStart(fromText || today);
  const end = parseLocalDateEnd(toText || today);
  if (!start || !end) {
    throw new TicketWatchQueryError("Valid from and to dates (YYYY-MM-DD) are required");
  }
  if (start > end) {
    throw new TicketWatchQueryError("From date must be on or before to date");
  }
  return {
    start,
    end,
    fromLabel: fromText || today,
    toLabel: toText || today,
  };
}

/**
 * @param {Array<{ result?: string }> | null | undefined} selections
 */
export function pendingSelectionCount(selections) {
  return (selections || []).reduce((count, selection) => {
    return String(selection?.result || "").toUpperCase() === "PENDING" ? count + 1 : count;
  }, 0);
}

/**
 * @param {Array<{ result?: string }> | null | undefined} selections
 * @param {"1" | "2" | "both"} [remaining]
 */
export function isHighWinPotential(selections, remaining = "both") {
  const legs = selections || [];
  if (legs.some((selection) => String(selection?.result || "").toUpperCase() === "LOST")) {
    return false;
  }
  const pending = pendingSelectionCount(legs);
  if (remaining === "1") return pending === 1;
  if (remaining === "2") return pending === 2;
  return pending === 1 || pending === 2;
}

/**
 * @param {{ potential_win?: number, apply_winnings_tax?: boolean, winnings_tax_rate?: number | null }} ticket
 */
export function netPayoutOf(ticket) {
  return ticketWinningsTaxBreakdown(ticket).netPayout;
}

/**
 * @param {number} amount
 * @param {number | null} minAmount
 * @param {number | null} maxAmount
 */
export function amountMatches(amount, minAmount, maxAmount) {
  if (minAmount != null && amount < minAmount) return false;
  if (maxAmount != null && amount > maxAmount) return false;
  return true;
}

/**
 * @param {{ settled_at?: Date | string | null, paid_at?: Date | string | null, created_at?: Date | string | null }} ticket
 * @param {string} view
 */
export function watchTimeValue(ticket, view) {
  const raw =
    view === "paid" ? ticket.paid_at : view === "payable" ? ticket.settled_at : ticket.created_at;
  if (!raw) return 0;
  const time = new Date(raw).getTime();
  return Number.isNaN(time) ? 0 : time;
}

function desc(left, right) {
  if (left === right) return 0;
  return left > right ? -1 : 1;
}

/**
 * @param {object} a
 * @param {object} b
 * @param {"amount" | "stake" | "time"} sort
 * @param {string} view
 */
export function compareWatchTickets(a, b, sort, view) {
  if (sort === "stake") {
    const byStake = desc(Number(a.stake || 0), Number(b.stake || 0));
    if (byStake) return byStake;
  } else if (sort === "time") {
    const byTime = desc(watchTimeValue(a, view), watchTimeValue(b, view));
    if (byTime) return byTime;
  } else {
    const byAmount = desc(netPayoutOf(a), netPayoutOf(b));
    if (byAmount) return byAmount;
  }
  const byTime = desc(watchTimeValue(a, view), watchTimeValue(b, view));
  if (byTime) return byTime;
  return String(a.id || "").localeCompare(String(b.id || ""));
}

/**
 * @param {Array<object>} tickets
 * @param {{ view: string, remaining?: string, minAmount?: number | null, maxAmount?: number | null, minLegs?: number | null, maxLegs?: number | null }} filters
 */
export function filterWatchTickets(tickets, filters) {
  const minAmount = filters.minAmount ?? null;
  const maxAmount = filters.maxAmount ?? null;
  const minLegs = filters.minLegs ?? null;
  const maxLegs = filters.maxLegs ?? null;
  return tickets.filter((ticket) => {
    const selections = ticket.selections || [];
    if (
      filters.view === "high-potential" &&
      !isHighWinPotential(selections, filters.remaining || "both")
    ) {
      return false;
    }
    if (minLegs != null && selections.length < minLegs) return false;
    if (maxLegs != null && selections.length > maxLegs) return false;
    return amountMatches(netPayoutOf(ticket), minAmount, maxAmount);
  });
}

/**
 * @param {Array<object>} tickets
 * @param {"amount" | "stake" | "time"} sort
 * @param {string} view
 */
export function sortWatchTickets(tickets, sort, view) {
  return [...tickets].sort((a, b) => compareWatchTickets(a, b, sort, view));
}

/**
 * @param {Array<object>} tickets
 * @param {number} page
 * @param {number} limit
 */
export function paginateWatchTickets(tickets, page, limit) {
  const total = tickets.length;
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * limit;
  return {
    items: tickets.slice(start, start + limit),
    page: safePage,
    limit,
    total,
    totalPages,
  };
}

/**
 * @param {Array<object>} tickets
 */
export function sumWatchNet(tickets) {
  if (!tickets.length) return 0;
  return toMoney(add(...tickets.map((ticket) => netPayoutOf(ticket))));
}

function optionalNonNegative(raw, label) {
  const text = raw == null ? "" : String(raw).trim();
  if (!text) return null;
  const value = Number(text);
  if (!Number.isFinite(value) || value < 0) {
    throw new TicketWatchQueryError(`${label} must be a non-negative number`);
  }
  return value;
}

function optionalPositiveInt(raw, label) {
  const text = raw == null ? "" : String(raw).trim();
  if (!text) return null;
  const value = Number.parseInt(text, 10);
  if (!Number.isFinite(value) || value < 1 || String(value) !== text) {
    throw new TicketWatchQueryError(`${label} must be a positive integer`);
  }
  return value;
}

/**
 * @param {Record<string, unknown>} query
 * @param {{ allowedViews: string[], now?: Date, forceCashierId?: string }} options
 */
export function parseTicketWatchQuery(query = {}, options) {
  const allowedViews = options?.allowedViews || [];
  const now = options?.now || new Date();
  const forceCashierId = String(options?.forceCashierId || "").trim();

  const view = String(query.view || "").trim();
  if (!allowedViews.includes(view)) {
    throw new TicketWatchQueryError("Invalid view");
  }

  const sourceRaw = String(query.source || "").trim().toLowerCase();
  if (sourceRaw && sourceRaw !== "player" && sourceRaw !== "cashier") {
    throw new TicketWatchQueryError("Invalid source filter");
  }

  const channelRaw = String(query.channel || "").trim().toUpperCase();
  if (channelRaw && channelRaw !== "LIVE" && channelRaw !== "PREMATCH") {
    throw new TicketWatchQueryError("Invalid channel filter");
  }

  let remaining = "both";
  if (view === "high-potential") {
    const rem = String(query.remaining || "both").trim();
    if (rem !== "1" && rem !== "2" && rem !== "both") {
      throw new TicketWatchQueryError("Invalid remaining filter");
    }
    remaining = rem;
  }

  const sortRaw = String(query.sort || "amount").trim();
  if (sortRaw !== "amount" && sortRaw !== "stake" && sortRaw !== "time") {
    throw new TicketWatchQueryError("Invalid sort");
  }

  const page = Math.max(1, Number.parseInt(String(query.page ?? ""), 10) || 1);
  const limitRaw = Number.parseInt(String(query.limit ?? ""), 10);
  const limit = Math.min(
    TICKET_WATCH_MAX_LIMIT,
    Number.isFinite(limitRaw) && limitRaw > 0 ? limitRaw : 20,
  );

  const minStake = optionalNonNegative(query.minStake, "Minimum stake");
  const maxStake = optionalNonNegative(query.maxStake, "Maximum stake");
  const minAmount = optionalNonNegative(query.minAmount, "Minimum amount");
  const maxAmount = optionalNonNegative(query.maxAmount, "Maximum amount");
  const minLegs = optionalPositiveInt(query.minLegs, "Minimum selections");
  const maxLegs = optionalPositiveInt(query.maxLegs, "Maximum selections");

  if (minStake != null && maxStake != null && minStake > maxStake) {
    throw new TicketWatchQueryError("Minimum stake cannot exceed maximum stake");
  }
  if (minAmount != null && maxAmount != null && minAmount > maxAmount) {
    throw new TicketWatchQueryError("Minimum amount cannot exceed maximum amount");
  }
  if (minLegs != null && maxLegs != null && minLegs > maxLegs) {
    throw new TicketWatchQueryError("Minimum selections cannot exceed maximum selections");
  }

  const range = resolveWatchDateRange({
    from: query.from,
    to: query.to,
    required: view !== "high-potential",
    now,
  });

  return {
    view,
    range,
    couponNumber: String(query.couponNumber || "").trim(),
    receiptNumber: String(query.receiptNumber || "")
      .trim()
      .replace(/\s+/g, ""),
    branchName: String(query.branchName || "").trim(),
    branchLocation: String(query.branchLocation || "").trim(),
    cashierId: forceCashierId || String(query.cashierId || "").trim(),
    forceCashier: Boolean(forceCashierId),
    source: forceCashierId ? "" : sourceRaw,
    channel: channelRaw,
    minStake,
    maxStake,
    minAmount,
    maxAmount,
    minLegs,
    maxLegs,
    remaining,
    sort: sortRaw,
    page,
    limit,
  };
}

/** No cashier assigned: online/player slips. */
const PLAYER_TICKET_SOURCE_FILTER = {
  OR: [{ cashier_id: null }, { cashier_id: { isSet: false } }],
};

/** Shop slips: cashier_id is present and not null. */
const CASHIER_TICKET_SOURCE_FILTER = {
  AND: [{ cashier_id: { isSet: true } }, { NOT: { cashier_id: null } }],
};

/**
 * Prisma where for a parsed ticket-watch query.
 * @param {ReturnType<typeof parseTicketWatchQuery>} filters
 */
export function buildTicketWatchWhere(filters) {
  const where = {};
  const and = [];

  if (filters.view === "payable") {
    where.status = "WON";
    if (filters.range) {
      where.settled_at = { gte: filters.range.start, lte: filters.range.end };
    }
  } else if (filters.view === "paid") {
    where.status = "PAID";
    where.potential_win = { gt: 0 };
    if (filters.range) {
      where.paid_at = { gte: filters.range.start, lte: filters.range.end };
    }
  } else {
    where.status = { in: ["OPEN", "PRINTED", "HELD"] };
    where.selections = {
      some: { result: "PENDING" },
      none: { result: "LOST" },
    };
    if (filters.range) {
      where.created_at = { gte: filters.range.start, lte: filters.range.end };
    }
  }

  if (filters.couponNumber) {
    where.coupon_number = { contains: filters.couponNumber, mode: "insensitive" };
  }
  if (filters.receiptNumber) {
    where.receipt_number = { contains: filters.receiptNumber, mode: "insensitive" };
  }
  if (filters.branchName) {
    where.branch_name = { contains: filters.branchName, mode: "insensitive" };
  }
  if (filters.branchLocation) {
    where.branch_location = { contains: filters.branchLocation, mode: "insensitive" };
  }
  if (filters.channel) {
    where.channel = filters.channel;
  }
  if (filters.minStake != null || filters.maxStake != null) {
    where.stake = {};
    if (filters.minStake != null) where.stake.gte = filters.minStake;
    if (filters.maxStake != null) where.stake.lte = filters.maxStake;
  }

  const lockCashier = filters.forceCashier || (filters.cashierId && filters.source !== "player");
  if (lockCashier && filters.cashierId) {
    where.cashier_id = filters.cashierId;
  } else if (filters.source === "player") {
    and.push(PLAYER_TICKET_SOURCE_FILTER);
  } else if (filters.source === "cashier") {
    and.push(CASHIER_TICKET_SOURCE_FILTER);
  }

  const statusFilter =
    filters.view === "payable" ? "WON" : filters.view === "paid" ? "PAID" : "";
  applyReportableTicketFilter(where, statusFilter);
  if (and.length) {
    where.AND = [...(Array.isArray(where.AND) ? where.AND : []), ...and];
  }
  return where;
}

/**
 * @param {string} view
 */
export function ticketWatchOrderBy(view) {
  if (view === "paid") return { paid_at: "desc" };
  if (view === "payable") return { settled_at: "desc" };
  return { created_at: "desc" };
}
