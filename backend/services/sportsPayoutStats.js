/**
 * Sportsbook payouts recognized on ticket.settled_at (last leg that
 * made the ticket WON, LOST, or VOID). Stakes stay on the booking
 * transaction. Cashier cash hand-over does not move the payout date.
 *
 * @module services/sportsPayoutStats
 */
import { prisma } from "../Config/db.js";
import { ticketWinningsTaxBreakdown } from "../lib/winningsTax.js";

const SPORTS_WIN_PAYOUT_PREFIXES = ["ticket:", "win-settlement:"];

/** @param {{ selection_snapshot?: unknown }} ticket */
export function isJackpotTicket(ticket) {
  const snap = ticket.selection_snapshot;
  if (snap == null) return false;
  if (typeof snap === "object" && !Array.isArray(snap)) {
    if (snap.isJackpot === true) return true;
    if (snap.gameMode === "jackpot" || snap.type === "jackpot") return true;
    if (snap.product === "jackpot") return true;
  }
  return false;
}

/** Cashier `ticket:` and online `win-settlement:` ledger rows. */
export function isSportsbookWinPayoutRef(reference) {
  const ref = String(reference || "");
  return SPORTS_WIN_PAYOUT_PREFIXES.some((prefix) => ref.startsWith(prefix));
}

function emptySummary() {
  return {
    winAmount: 0,
    winCount: 0,
    wonCount: 0,
    paidCount: 0,
    cashbackAmount: 0,
    cashbackCount: 0,
    onlineCashbackAmount: 0,
    onlineCashbackCount: 0,
    shopCashbackAmount: 0,
    shopCashbackCount: 0,
    totalPaidAmount: 0,
    totalPaidCount: 0,
    lines: [],
  };
}

function isCashbackTicket(ticket) {
  return Number(ticket.cashback_amount) > 0;
}

function isWinTicket(ticket) {
  if (isCashbackTicket(ticket)) return false;
  const status = String(ticket.status || "").toUpperCase();
  return status === "WON" || status === "PAID";
}

/**
 * @param {string[]} walletIds
 * @returns {Promise<string[]>}
 */
export async function cashierIdsForWalletIds(walletIds) {
  const ids = [...new Set((walletIds || []).filter(Boolean))];
  if (ids.length === 0) return [];
  const rows = await prisma.cashier.findMany({
    where: { wallet_id: { in: ids } },
    select: { id: true },
  });
  return rows.map((row) => row.id).filter(Boolean);
}

/**
 * Sum sports win and cashback payouts whose ticket settled in range.
 *
 * `cashierIds` undefined includes every ticket (admin platform).
 * An empty array returns zeros. `walletIds` scopes to those cashiers.
 * Shop reports pass `excludeJackpot: true`.
 *
 * @param {{
 *   start: Date,
 *   end: Date,
 *   cashierIds?: string[] | null,
 *   walletIds?: string[] | null,
 *   excludeJackpot?: boolean,
 * }} opts
 */
export async function loadSportsPayouts({
  start,
  end,
  cashierIds = undefined,
  walletIds = undefined,
  excludeJackpot = false,
}) {
  let scopedCashierIds = Array.isArray(cashierIds) ? [...cashierIds] : undefined;
  if (Array.isArray(walletIds)) {
    const fromWallets = await cashierIdsForWalletIds(walletIds);
    scopedCashierIds = scopedCashierIds
      ? scopedCashierIds.filter((id) => fromWallets.includes(id))
      : fromWallets;
  }
  if (Array.isArray(scopedCashierIds) && scopedCashierIds.length === 0) {
    return emptySummary();
  }

  const where = {
    settled_at: { gte: start, lte: end },
  };
  if (Array.isArray(scopedCashierIds)) {
    where.cashier_id = { in: scopedCashierIds };
  }

  const tickets = await prisma.ticket.findMany({
    where,
    select: {
      id: true,
      status: true,
      cashier_id: true,
      branch_name: true,
      potential_win: true,
      apply_winnings_tax: true,
      winnings_tax_rate: true,
      cashback_amount: true,
      selection_snapshot: true,
      settled_at: true,
    },
  });

  const summary = emptySummary();
  for (const ticket of tickets) {
    if (excludeJackpot && isJackpotTicket(ticket)) continue;
    const status = String(ticket.status || "").toUpperCase();
    const settledAt = ticket.settled_at;
    if (!settledAt) continue;
    const online = !ticket.cashier_id;

    if (isCashbackTicket(ticket)) {
      const amount = Number(ticket.cashback_amount) || 0;
      if (amount <= 0) continue;
      summary.cashbackAmount += amount;
      summary.cashbackCount += 1;
      if (online) {
        summary.onlineCashbackAmount += amount;
        summary.onlineCashbackCount += 1;
      } else {
        summary.shopCashbackAmount += amount;
        summary.shopCashbackCount += 1;
      }
      if (status === "PAID") summary.paidCount += 1;
      summary.lines.push({
        kind: "cashback",
        amount,
        status,
        cashierId: ticket.cashier_id || null,
        branchName: ticket.branch_name || "",
        settledAt,
        online,
      });
      continue;
    }

    if (!isWinTicket(ticket)) continue;
    const amount = ticketWinningsTaxBreakdown(ticket).netPayout;
    if (!Number.isFinite(amount) || amount <= 0) continue;
    summary.winAmount += amount;
    summary.winCount += 1;
    if (status === "WON") summary.wonCount += 1;
    if (status === "PAID") summary.paidCount += 1;
    summary.lines.push({
      kind: "win",
      amount,
      status,
      cashierId: ticket.cashier_id || null,
      branchName: ticket.branch_name || "",
      settledAt,
      online,
    });
  }

  summary.totalPaidAmount = summary.winAmount + summary.cashbackAmount;
  summary.totalPaidCount = summary.winCount + summary.cashbackCount;
  return summary;
}
