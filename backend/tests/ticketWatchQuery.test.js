import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ADMIN_TICKET_WATCH_VIEWS,
  TicketWatchQueryError,
  buildTicketWatchWhere,
  compareWatchTickets,
  defaultLastTwoLocalDays,
  filterWatchTickets,
  isHighWinPotential,
  parseTicketWatchQuery,
  resolveWatchDateRange,
  sortWatchTickets,
  sumWatchNet,
  ticketWatchOrderBy,
} from "../lib/ticketWatchQuery.js";

const NOW = new Date(2026, 2, 1, 15, 30, 0, 0);

test("default last two local days crosses the month boundary", () => {
  const range = defaultLastTwoLocalDays(NOW);
  assert.equal(range.fromLabel, "2026-02-28");
  assert.equal(range.toLabel, "2026-03-01");
  assert.equal(range.start.getDate(), 28);
  assert.equal(range.end.getDate(), 1);
  assert.ok(range.start < range.end);
});

test("payable with no dates uses the last two local days", () => {
  const range = resolveWatchDateRange({ required: true, now: NOW });
  assert.equal(range.fromLabel, "2026-02-28");
  assert.equal(range.toLabel, "2026-03-01");
});

test("high-potential with no dates has no date window", () => {
  assert.equal(resolveWatchDateRange({ required: false, now: NOW }), null);
});

test("inverted and impossible dates are rejected", () => {
  assert.throws(
    () => resolveWatchDateRange({ from: "2026-03-02", to: "2026-03-01", now: NOW }),
    (error) => error instanceof TicketWatchQueryError && /on or before/.test(error.message),
  );
  assert.throws(
    () => resolveWatchDateRange({ from: "2026-02-31", to: "2026-03-01", now: NOW }),
    (error) => error instanceof TicketWatchQueryError,
  );
});

test("high win potential keeps 1 or 2 pending legs and drops a lost leg", () => {
  const oneLeft = [{ result: "WON" }, { result: "PENDING" }, { result: "VOID" }];
  const twoLeft = [{ result: "WON" }, { result: "PENDING" }, { result: "PENDING" }];
  const threeLeft = [
    { result: "PENDING" },
    { result: "PENDING" },
    { result: "PENDING" },
  ];
  const lost = [{ result: "WON" }, { result: "LOST" }, { result: "PENDING" }];

  assert.equal(isHighWinPotential(oneLeft, "both"), true);
  assert.equal(isHighWinPotential(oneLeft, "1"), true);
  assert.equal(isHighWinPotential(oneLeft, "2"), false);
  assert.equal(isHighWinPotential(twoLeft, "2"), true);
  assert.equal(isHighWinPotential(threeLeft, "both"), false);
  assert.equal(isHighWinPotential(lost, "both"), false);
});

test("amount sort uses net payout after tax, not gross", () => {
  const higherNet = {
    id: "a",
    stake: 10,
    potential_win: 100,
    apply_winnings_tax: false,
    settled_at: new Date("2026-03-01T10:00:00"),
  };
  const higherGross = {
    id: "b",
    stake: 50,
    potential_win: 200,
    apply_winnings_tax: true,
    winnings_tax_rate: 0.6,
    settled_at: new Date("2026-03-01T12:00:00"),
  };
  const sorted = sortWatchTickets([higherGross, higherNet], "amount", "payable");
  assert.deepEqual(
    sorted.map((ticket) => ticket.id),
    ["a", "b"],
  );
  assert.equal(compareWatchTickets(higherGross, higherNet, "stake", "payable") < 0, true);
});

test("in-memory filters apply remaining count, legs, and net amount", () => {
  const tickets = [
    {
      id: "near",
      potential_win: 80,
      apply_winnings_tax: false,
      selections: [{ result: "WON" }, { result: "PENDING" }],
    },
    {
      id: "too-many",
      potential_win: 500,
      apply_winnings_tax: false,
      selections: [{ result: "PENDING" }, { result: "PENDING" }, { result: "PENDING" }],
    },
    {
      id: "small",
      potential_win: 10,
      apply_winnings_tax: false,
      selections: [{ result: "PENDING" }],
    },
  ];
  const matched = filterWatchTickets(tickets, {
    view: "high-potential",
    remaining: "1",
    minAmount: 50,
    maxAmount: 100,
    minLegs: 2,
    maxLegs: 4,
  });
  assert.deepEqual(
    matched.map((ticket) => ticket.id),
    ["near"],
  );
  assert.equal(sumWatchNet(matched), 80);
});

test("parseTicketWatchQuery locks a cashier and rejects a paid view for cashiers", () => {
  const parsed = parseTicketWatchQuery(
    { view: "payable", cashierId: "other", source: "player", page: "2", limit: "500" },
    {
      allowedViews: ["payable", "high-potential"],
      now: NOW,
      forceCashierId: "cashier-1",
    },
  );
  assert.equal(parsed.cashierId, "cashier-1");
  assert.equal(parsed.source, "");
  assert.equal(parsed.forceCashier, true);
  assert.equal(parsed.page, 2);
  assert.equal(parsed.limit, 50);
  assert.equal(parsed.range.fromLabel, "2026-02-28");

  assert.throws(
    () =>
      parseTicketWatchQuery(
        { view: "paid" },
        { allowedViews: ["payable", "high-potential"], now: NOW },
      ),
    (error) => error instanceof TicketWatchQueryError && error.message === "Invalid view",
  );
  assert.deepEqual(ADMIN_TICKET_WATCH_VIEWS.includes("paid"), true);
});

test("where clauses match payable, paid, and near-win rules", () => {
  const payable = parseTicketWatchQuery(
    { view: "payable", couponNumber: "AB", minStake: "10", maxStake: "50", channel: "live" },
    { allowedViews: ADMIN_TICKET_WATCH_VIEWS, now: NOW },
  );
  const payableWhere = buildTicketWatchWhere(payable);
  assert.equal(payableWhere.status, "WON");
  assert.equal(payableWhere.settled_at.gte.getDate(), 28);
  assert.equal(payableWhere.coupon_number.contains, "AB");
  assert.equal(payableWhere.channel, "LIVE");
  assert.deepEqual(payableWhere.stake, { gte: 10, lte: 50 });
  assert.equal(ticketWatchOrderBy("payable").settled_at, "desc");

  const paid = parseTicketWatchQuery(
    { view: "paid", from: "2026-03-01", to: "2026-03-01", source: "player" },
    { allowedViews: ADMIN_TICKET_WATCH_VIEWS, now: NOW },
  );
  const paidWhere = buildTicketWatchWhere(paid);
  assert.equal(paidWhere.status, "PAID");
  assert.deepEqual(paidWhere.potential_win, { gt: 0 });
  assert.ok(paidWhere.paid_at);
  assert.equal(paidWhere.cashier_id, undefined);
  assert.equal(paidWhere.AND.length, 1);
  assert.equal(ticketWatchOrderBy("paid").paid_at, "desc");

  const near = parseTicketWatchQuery(
    { view: "high-potential", cashierId: "c-1" },
    { allowedViews: ADMIN_TICKET_WATCH_VIEWS, now: NOW },
  );
  const nearWhere = buildTicketWatchWhere(near);
  assert.deepEqual(nearWhere.status, { in: ["OPEN", "PRINTED", "HELD"] });
  assert.equal(nearWhere.created_at, undefined);
  assert.equal(nearWhere.cashier_id, "c-1");
  assert.deepEqual(nearWhere.selections.some, { result: "PENDING" });
  assert.deepEqual(nearWhere.selections.none, { result: "LOST" });
  assert.ok(nearWhere.NOT);
});
