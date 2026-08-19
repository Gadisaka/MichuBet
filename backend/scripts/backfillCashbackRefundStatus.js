/**
 * One-off: promote cashback slips off LOST.
 *
 *   unpaid  (cashback_amount > 0, no cashback_paid_at) → REFUND
 *           potential_win = cashback_amount
 *   already paid (cashback_paid_at set)                → PAID
 *           potential_win = cashback_amount when still 0
 *
 *   node backend/scripts/backfillCashbackRefundStatus.js
 */
import { prisma } from "../Config/db.js";

function cashbackAmountOf(row) {
  const n = Number(row.cashback_amount);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function main() {
  const candidates = await prisma.ticket.findMany({
    where: { cashback_amount: { gt: 0 } },
    select: {
      id: true,
      status: true,
      cashback_amount: true,
      cashback_paid_at: true,
      potential_win: true,
    },
  });

  let unpaidToRefund = 0;
  let paidLostToPaid = 0;
  let potentialWinUpdated = 0;

  for (const row of candidates) {
    const amount = cashbackAmountOf(row);
    if (!amount) continue;
    const paid = Boolean(row.cashback_paid_at);
    const status = String(row.status || "").toUpperCase();
    const data = {};

    if (!paid && status === "LOST") {
      data.status = "REFUND";
      unpaidToRefund += 1;
    } else if (paid && status === "LOST") {
      data.status = "PAID";
      paidLostToPaid += 1;
    }

    if (Number(row.potential_win) !== amount) {
      data.potential_win = amount;
      potentialWinUpdated += 1;
    }

    if (Object.keys(data).length === 0) continue;
    await prisma.ticket.update({
      where: { id: row.id },
      data,
    });
  }

  console.log(
    JSON.stringify({
      scanned: candidates.length,
      unpaidToRefund,
      paidLostToPaid,
      potentialWinUpdated,
    }),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
