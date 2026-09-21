/**
 * Shop-level financial aggregates from cashier wallet transactions.
 * Matches cashier dashboard metrics (sold, paid, deposit, withdraw, grand net).
 *
 * @module services/shopReportStats
 */
import { prisma } from "../Config/db.js";
import {
  isJackpotTicket,
  loadSportsPayouts,
} from "./sportsPayoutStats.js";

const TICKET_PRINT_REF_PREFIX = "ticket-print:";

export { isJackpotTicket };

export function emptyShopStats() {
  return {
    totalTicketsSold: 0,
    totalSoldPrice: 0,
    totalDepositAmount: 0,
    totalWithdrawAmount: 0,
    totalPaidTickets: 0,
    totalPaidAmount: 0,
    totalCashbackTickets: 0,
    totalCashbackAmount: 0,
    totalCancelledTickets: 0,
    totalCancelledAmount: 0,
    grandNet: 0,
  };
}

/**
 * Aggregate shop stats for one or more cashier wallet IDs within a date range.
 *
 * @param {string[]} walletIds
 * @param {{ start: Date, end: Date }} range
 */
export async function aggregateShopStatsForWalletIds(walletIds, { start, end }) {
  const ids = [...new Set((walletIds || []).filter(Boolean))];
  if (ids.length === 0) {
    return emptyShopStats();
  }

  const dateWhere = { gte: start, lte: end };

  const betTxs = await prisma.transaction.findMany({
    where: {
      wallet_id: { in: ids },
      type: "BET",
      reference: { startsWith: TICKET_PRINT_REF_PREFIX },
      created_at: dateWhere,
    },
  });

  const betTicketIds = betTxs
    .map((tx) => {
      const ref = String(tx.reference || "");
      return ref.startsWith(TICKET_PRINT_REF_PREFIX)
        ? ref.slice(TICKET_PRINT_REF_PREFIX.length)
        : null;
    })
    .filter(Boolean);

  const betTickets =
    betTicketIds.length > 0
      ? await prisma.ticket.findMany({
          where: { id: { in: betTicketIds } },
          select: { id: true, selection_snapshot: true, status: true },
        })
      : [];

  const betTicketById = new Map(betTickets.map((t) => [t.id, t]));

  const jackpotSoldIds = new Set(
    betTickets.filter((t) => isJackpotTicket(t)).map((t) => t.id),
  );

  const soldBets = betTxs.filter((tx) => {
    const ref = String(tx.reference || "");
    const tid = ref.startsWith(TICKET_PRINT_REF_PREFIX)
      ? ref.slice(TICKET_PRINT_REF_PREFIX.length)
      : "";
    if (!tid || jackpotSoldIds.has(tid)) return false;
    const ticket = betTicketById.get(tid);
    return ticket?.status !== "CANCELED";
  });

  const totalTicketsSold = soldBets.length;
  const totalSoldPrice = soldBets.reduce((s, tx) => s + Number(tx.amount), 0);

  const sportsPayouts = await loadSportsPayouts({
    start,
    end,
    walletIds: ids,
    excludeJackpot: true,
  });
  const totalCashbackTickets = sportsPayouts.cashbackCount;
  const totalCashbackAmount = sportsPayouts.cashbackAmount;
  const totalPaidTickets = sportsPayouts.totalPaidCount;
  const totalPaidAmount = sportsPayouts.totalPaidAmount;

  const depositTxs = await prisma.transaction.findMany({
    where: {
      wallet_id: { in: ids },
      type: "WITHDRAW",
      created_at: dateWhere,
      reference: { startsWith: "cashier-deposit:" },
    },
  });
  const totalDepositAmount = depositTxs.reduce((s, tx) => s + Number(tx.amount), 0);

  const withdrawTxs = await prisma.transaction.findMany({
    where: {
      wallet_id: { in: ids },
      type: "DEPOSIT",
      created_at: dateWhere,
      reference: { startsWith: "cashier-withdraw-approve:" },
    },
  });
  const totalWithdrawAmount = withdrawTxs.reduce((s, tx) => s + Number(tx.amount), 0);

  const cancelRefundTxs = await prisma.transaction.findMany({
    where: {
      wallet_id: { in: ids },
      type: "DEPOSIT",
      reference: { startsWith: "cancel-refund-cashier:" },
      created_at: dateWhere,
    },
  });

  const totalCancelledTickets = cancelRefundTxs.length;
  const totalCancelledAmount = cancelRefundTxs.reduce(
    (s, tx) => s + Number(tx.amount),
    0,
  );

  const grandNet =
    totalSoldPrice - totalPaidAmount - totalDepositAmount + totalWithdrawAmount;

  return {
    totalTicketsSold,
    totalSoldPrice,
    totalDepositAmount,
    totalWithdrawAmount,
    totalPaidTickets,
    totalPaidAmount,
    totalCashbackTickets,
    totalCashbackAmount,
    totalCancelledTickets,
    totalCancelledAmount,
    grandNet,
  };
}
