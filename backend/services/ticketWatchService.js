/**
 * Admin and cashier ticket watch lists: unpaid wins, near-wins, and paid wins.
 *
 * @module services/ticketWatchService
 */
import { prisma } from "../Config/db.js";
import {
  TICKET_WATCH_CANDIDATE_CAP,
  buildTicketWatchWhere,
  filterWatchTickets,
  paginateWatchTickets,
  pendingSelectionCount,
  sortWatchTickets,
  sumWatchNet,
  ticketWatchOrderBy,
} from "../lib/ticketWatchQuery.js";
import { ticketWinningsTaxBreakdown } from "../lib/winningsTax.js";

const WATCH_INCLUDE = {
  selections: {
    include: {
      match: { select: { home_team: true, away_team: true, start_time: true } },
      fixture: {
        select: {
          start_time: true,
          home_team: { select: { name: true } },
          away_team: { select: { name: true } },
        },
      },
    },
  },
  cashier: {
    include: {
      user: { select: { name: true } },
    },
  },
};

function isoOrNull(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
}

function mapSelection(selection) {
  let home = "";
  let away = "";
  let kickoff = null;
  if (selection.match) {
    home = selection.match.home_team || "";
    away = selection.match.away_team || "";
    kickoff = selection.match.start_time;
  } else if (selection.fixture) {
    home = selection.fixture.home_team?.name || "";
    away = selection.fixture.away_team?.name || "";
    kickoff = selection.fixture.start_time;
  }
  const matchName = home || away ? `${home || "Home"} vs ${away || "Away"}` : "";
  return {
    id: selection.id,
    label: selection.selection || "",
    marketLabel: selection.market_code || "",
    odds: selection.odds,
    result: selection.result,
    matchName,
    kickoffAt: isoOrNull(kickoff),
  };
}

function mapWatchTicket(ticket) {
  const tax = ticketWinningsTaxBreakdown(ticket);
  const selections = (ticket.selections || []).map(mapSelection);
  return {
    id: ticket.id,
    couponNumber: ticket.coupon_number,
    receiptNumber: ticket.receipt_number ?? null,
    status: ticket.status,
    stake: Number(ticket.stake || 0),
    potentialWin: Number(ticket.potential_win || 0),
    winningsTaxAmount: tax.taxAmount,
    netPayout: tax.netPayout,
    branchName: ticket.branch_name || "",
    branchLocation: ticket.branch_location || "",
    cashierId: ticket.cashier_id ?? null,
    cashierName: ticket.cashier?.user?.name ?? null,
    source: ticket.cashier_id ? "cashier" : "player",
    channel: ticket.channel || "",
    createdAt: isoOrNull(ticket.created_at),
    settledAt: isoOrNull(ticket.settled_at),
    paidAt: isoOrNull(ticket.paid_at),
    legCount: selections.length,
    pendingCount: pendingSelectionCount(ticket.selections),
    selections,
  };
}

/**
 * @param {ReturnType<import("../lib/ticketWatchQuery.js").parseTicketWatchQuery>} filters
 */
export async function listTicketWatch(filters) {
  const fetched = await prisma.ticket.findMany({
    where: buildTicketWatchWhere(filters),
    include: WATCH_INCLUDE,
    orderBy: ticketWatchOrderBy(filters.view),
    take: TICKET_WATCH_CANDIDATE_CAP + 1,
  });
  const truncated = fetched.length > TICKET_WATCH_CANDIDATE_CAP;
  const candidates = truncated ? fetched.slice(0, TICKET_WATCH_CANDIDATE_CAP) : fetched;
  const matched = filterWatchTickets(candidates, filters);
  const sorted = sortWatchTickets(matched, filters.sort, filters.view);
  const page = paginateWatchTickets(sorted, filters.page, filters.limit);

  return {
    view: filters.view,
    from: filters.range?.fromLabel ?? null,
    to: filters.range?.toLabel ?? null,
    generatedAt: new Date().toISOString(),
    truncated,
    summary: {
      count: sorted.length,
      netPayout: sumWatchNet(sorted),
    },
    items: page.items.map(mapWatchTicket),
    page: page.page,
    limit: page.limit,
    total: page.total,
    totalPages: page.totalPages,
  };
}
