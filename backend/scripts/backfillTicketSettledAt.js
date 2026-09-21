/**
 * One-off: set Ticket.settled_at for tickets that already settled
 * before the field existed.
 *
 *   Prefer the latest related fixture/match settled_at (last game).
 *   Else the payout or cashback transaction time, else paid_at.
 *   Never copies ticket.created_at.
 *
 *   node backend/scripts/backfillTicketSettledAt.js
 */
import { prisma } from "../Config/db.js";

const TERMINAL_STATUSES = ["WON", "LOST", "VOID", "PAID", "REFUND", "CASHED_OUT"];
const CHUNK = 50;

function later(current, candidate) {
  if (!(candidate instanceof Date) || Number.isNaN(candidate.getTime())) {
    return current;
  }
  if (!current || candidate > current) return candidate;
  return current;
}

function refsFor(ticketId) {
  return [
    `ticket:${ticketId}`,
    `win-settlement:${ticketId}`,
    `cashback-payout:${ticketId}`,
    `bonus:cashback:${ticketId}`,
  ];
}

async function main() {
  const tickets = await prisma.ticket.findMany({
    where: {
      settled_at: null,
      status: { in: TERMINAL_STATUSES },
    },
    select: {
      id: true,
      paid_at: true,
      cashback_paid_at: true,
    },
  });

  let updated = 0;
  let skipped = 0;

  for (let offset = 0; offset < tickets.length; offset += CHUNK) {
    const chunk = tickets.slice(offset, offset + CHUNK);
    const ids = chunk.map((ticket) => ticket.id);
    const selections = await prisma.ticketSelection.findMany({
      where: { ticket_id: { in: ids } },
      select: { ticket_id: true, fixture_id: true, match_id: true },
    });
    const fixtureIds = [
      ...new Set(selections.map((row) => row.fixture_id).filter(Boolean)),
    ];
    const matchIds = [
      ...new Set(selections.map((row) => row.match_id).filter(Boolean)),
    ];
    const [fixtures, matches, txs] = await Promise.all([
      fixtureIds.length
        ? prisma.fixture.findMany({
            where: { id: { in: fixtureIds } },
            select: { id: true, settled_at: true },
          })
        : [],
      matchIds.length
        ? prisma.match.findMany({
            where: { id: { in: matchIds } },
            select: { id: true, settled_at: true },
          })
        : [],
      prisma.transaction.findMany({
        where: {
          OR: ids.flatMap((id) =>
            refsFor(id).map((reference) => ({ reference })),
          ),
        },
        select: { reference: true, created_at: true },
      }),
    ]);

    const fixtureAt = new Map(fixtures.map((row) => [row.id, row.settled_at]));
    const matchAt = new Map(matches.map((row) => [row.id, row.settled_at]));
    const txAtByTicket = new Map();
    const idSet = new Set(ids);
    for (const tx of txs) {
      const ref = String(tx.reference || "");
      const ticketId = ref.slice(ref.lastIndexOf(":") + 1);
      if (!idSet.has(ticketId)) continue;
      txAtByTicket.set(
        ticketId,
        later(txAtByTicket.get(ticketId), tx.created_at),
      );
    }
    const selectionsByTicket = new Map();
    for (const row of selections) {
      const list = selectionsByTicket.get(row.ticket_id) || [];
      list.push(row);
      selectionsByTicket.set(row.ticket_id, list);
    }

    for (const ticket of chunk) {
      let gameAt = null;
      for (const row of selectionsByTicket.get(ticket.id) || []) {
        gameAt = later(gameAt, fixtureAt.get(row.fixture_id));
        gameAt = later(gameAt, matchAt.get(row.match_id));
      }
      const chosen =
        gameAt ||
        txAtByTicket.get(ticket.id) ||
        later(ticket.paid_at, ticket.cashback_paid_at);
      if (!chosen) {
        skipped += 1;
        continue;
      }
      const { count } = await prisma.ticket.updateMany({
        where: { id: ticket.id, settled_at: null },
        data: { settled_at: chosen },
      });
      if (count > 0) updated += 1;
    }
  }

  console.log(
    JSON.stringify({
      scanned: tickets.length,
      updated,
      skipped,
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
