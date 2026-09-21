/**
 * Shop report stats — payouts follow ticket.settled_at, stakes follow the print.
 *
 * Run: node --test backend/tests/shopReportStats.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { register } from "node:module";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const loaderUrl = pathToFileURL(
  path.join(__dirname, "fixtures", "prismaLoader.mjs"),
).href;
register(loaderUrl, import.meta.url);

const stubModule = await import(
  pathToFileURL(path.join(__dirname, "fixtures", "prismaInMemoryStub.js")).href
);
const { resetStore, getStore } = stubModule;

const { aggregateShopStatsForWalletIds, emptyShopStats } = await import(
  "../services/shopReportStats.js"
);
const { cashbackPayoutRef, SHOP_CASHBACK_REF_PREFIX } = await import(
  "../lib/bonusEngine.js"
);

const WALLET_ID = "cw-1";
const CASHIER_ID = "cashier-1";
const START = new Date("2026-06-01T00:00:00.000Z");
const END = new Date("2026-06-30T23:59:59.999Z");
const IN_RANGE = new Date("2026-06-15T12:00:00.000Z");
const OUT_RANGE = new Date("2026-07-02T00:00:00.000Z");

function seedCashier() {
  getStore().cashier.set(CASHIER_ID, {
    id: CASHIER_ID,
    wallet_id: WALLET_ID,
    user_id: "cashier-user",
    branch_name: "Shop",
    branch_location: "Addis",
  });
}

function seedTicket(id, extra = {}) {
  const store = getStore();
  store.ticket.set(id, {
    id,
    status: "PAID",
    cashier_id: CASHIER_ID,
    selection_snapshot: [],
    cashback_amount: 0,
    potential_win: 0,
    ...extra,
  });
}

function seedTx(id, { type, amount, reference, created_at = IN_RANGE, wallet_id = WALLET_ID }) {
  const store = getStore();
  store.transaction.set(id, {
    id,
    wallet_id,
    type,
    amount,
    reference,
    created_at,
  });
}

test("empty wallet ids return empty shop stats including cashback fields", async () => {
  resetStore();
  const stats = await aggregateShopStatsForWalletIds([], { start: START, end: END });
  assert.deepEqual(stats, emptyShopStats());
  assert.equal(stats.totalCashbackTickets, 0);
  assert.equal(stats.totalCashbackAmount, 0);
});

test("shop cashback folds into paid totals and reduces grandNet", async () => {
  resetStore();
  seedCashier();
  seedTicket("sold-1", { status: "PRINTED" });
  seedTicket("paid-1", { potential_win: 50, settled_at: IN_RANGE });
  seedTicket("cb-1", { cashback_amount: 20, settled_at: IN_RANGE });
  seedTicket("cb-out", { cashback_amount: 80, settled_at: OUT_RANGE });

  seedTx("bet-1", {
    type: "BET",
    amount: 100,
    reference: "ticket-print:sold-1",
  });
  seedTx("pay-1", {
    type: "PAYOUT",
    amount: 50,
    reference: "ticket:paid-1",
  });
  seedTx("cb-tx", {
    type: "BONUS",
    amount: 20,
    reference: cashbackPayoutRef("cb-1"),
  });
  seedTx("welcome", {
    type: "BONUS",
    amount: 999,
    reference: "bonus:welcome:player-1",
  });
  seedTx("cb-out", {
    type: "BONUS",
    amount: 80,
    reference: cashbackPayoutRef("cb-out"),
    created_at: OUT_RANGE,
  });

  const stats = await aggregateShopStatsForWalletIds([WALLET_ID], {
    start: START,
    end: END,
  });

  assert.equal(stats.totalTicketsSold, 1);
  assert.equal(stats.totalSoldPrice, 100);
  assert.equal(stats.totalCashbackTickets, 1);
  assert.equal(stats.totalCashbackAmount, 20);
  assert.equal(stats.totalPaidTickets, 2);
  assert.equal(stats.totalPaidAmount, 70);
  assert.equal(stats.grandNet, 30);
  assert.ok(cashbackPayoutRef("cb-1").startsWith(SHOP_CASHBACK_REF_PREFIX));
});

test("jackpot cashback is excluded from paid and cashback totals", async () => {
  resetStore();
  seedCashier();
  seedTicket("sold-1", { status: "PRINTED" });
  seedTicket("cb-1", { cashback_amount: 20, settled_at: IN_RANGE });
  seedTicket("jk-1", {
    cashback_amount: 500,
    settled_at: IN_RANGE,
    selection_snapshot: { isJackpot: true },
  });

  seedTx("bet-1", {
    type: "BET",
    amount: 100,
    reference: "ticket-print:sold-1",
  });
  seedTx("cb-tx", {
    type: "BONUS",
    amount: 20,
    reference: cashbackPayoutRef("cb-1"),
  });
  seedTx("jk-tx", {
    type: "BONUS",
    amount: 500,
    reference: cashbackPayoutRef("jk-1"),
  });

  const stats = await aggregateShopStatsForWalletIds([WALLET_ID], {
    start: START,
    end: END,
  });

  assert.equal(stats.totalCashbackTickets, 1);
  assert.equal(stats.totalCashbackAmount, 20);
  assert.equal(stats.totalPaidTickets, 1);
  assert.equal(stats.totalPaidAmount, 20);
  assert.equal(stats.grandNet, 80);
});

test("win payout follows settled_at and stake follows the print date", async () => {
  resetStore();
  seedCashier();
  seedTicket("old-sale", { status: "PRINTED" });
  seedTx("bet-old", {
    type: "BET",
    amount: 40,
    reference: "ticket-print:old-sale",
    created_at: OUT_RANGE,
  });
  seedTicket("new-sale", { status: "PRINTED" });
  seedTx("bet-new", {
    type: "BET",
    amount: 100,
    reference: "ticket-print:new-sale",
  });
  seedTicket("win-now", {
    status: "WON",
    potential_win: 75,
    settled_at: IN_RANGE,
  });
  seedTx("pay-outside", {
    type: "PAYOUT",
    amount: 75,
    reference: "ticket:win-now",
    created_at: OUT_RANGE,
  });
  seedTicket("win-earlier", {
    status: "PAID",
    potential_win: 30,
    settled_at: OUT_RANGE,
  });
  seedTx("pay-inside", {
    type: "PAYOUT",
    amount: 30,
    reference: "ticket:win-earlier",
  });

  const stats = await aggregateShopStatsForWalletIds([WALLET_ID], {
    start: START,
    end: END,
  });

  assert.equal(stats.totalTicketsSold, 1);
  assert.equal(stats.totalSoldPrice, 100);
  assert.equal(stats.totalPaidTickets, 1);
  assert.equal(stats.totalPaidAmount, 75);
  assert.equal(stats.grandNet, 25);
});
