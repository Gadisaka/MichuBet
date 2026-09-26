/**
 * Shop withdrawal holds funds at code creation and refunds them on expiry.
 *
 * Run: node --test backend/tests/shopWithdrawHold.test.js
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

const { createShopWithdraw } = await import("../controllers/playerController.js");
const { redeemShopWithdraw } = await import(
  "../controllers/cashierWalletController.js"
);
const { runExpireShopWithdrawals } = await import(
  "../jobs/expireShopWithdrawals.js"
);

const PLAYER_ID = "player-1";
const CASHIER_ID = "cashier-1";
const PLAYER_WALLET_ID = "pw-1";
const CASHIER_WALLET_ID = "cw-1";
const PLAYER_PHONE = "251912345678";

function mockRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function seed({
  playerBalance = 200,
  playerWithdrawable = 200,
  cashierBalance = 0,
} = {}) {
  resetStore();
  const store = getStore();
  store.user.set(PLAYER_ID, {
    id: PLAYER_ID,
    name: "Test Player",
    phone: PLAYER_PHONE,
    role: { name: "PLAYER" },
  });
  store.wallet.set(PLAYER_WALLET_ID, {
    id: PLAYER_WALLET_ID,
    user_id: PLAYER_ID,
    wallet_type: "PLAYER",
    balance: playerBalance,
    withdrawable: playerWithdrawable,
  });
  store.wallet.set(CASHIER_WALLET_ID, {
    id: CASHIER_WALLET_ID,
    user_id: CASHIER_ID,
    wallet_type: "CASHIER",
    balance: cashierBalance,
    withdrawable: 0,
  });
}

async function requestCode(amount) {
  const req = {
    body: { amount },
    user: { sub: PLAYER_ID, role: "PLAYER" },
    headers: {},
  };
  const res = mockRes();
  await createShopWithdraw(req, res);
  return res;
}

async function redeem(phone, code) {
  const req = {
    body: { phone, code },
    user: { sub: CASHIER_ID, role: "CASHIER" },
    headers: {},
  };
  const res = mockRes();
  await redeemShopWithdraw(req, res);
  return res;
}

function playerWallet() {
  return getStore().wallet.get(PLAYER_WALLET_ID);
}

function cashierWallet() {
  return getStore().wallet.get(CASHIER_WALLET_ID);
}

test("creating a shop code holds balance and withdrawable", async () => {
  seed();
  const res = await requestCode(80);
  assert.equal(res.statusCode, 201);
  assert.match(res.body.code, /^\d{6}$/);

  const wallet = playerWallet();
  assert.equal(wallet.balance, 120);
  assert.equal(wallet.withdrawable, 120);

  const pending = [...getStore().transaction.values()].find(
    (tx) => tx.wallet_id === PLAYER_WALLET_ID && tx.type === "WITHDRAW",
  );
  assert.equal(pending.balance_before, 200);
  assert.equal(pending.balance_after, 120);
  assert.match(pending.reference, /^pending:shop-withdraw:/);
});

test("a second code for the same funds is rejected", async () => {
  seed({ playerBalance: 100, playerWithdrawable: 100 });
  const first = await requestCode(100);
  assert.equal(first.statusCode, 201);

  const second = await requestCode(100);
  assert.equal(second.statusCode, 400);
  assert.match(second.body.message, /Insufficient|Withdrawable/);
  assert.equal(playerWallet().balance, 0);
  assert.equal(playerWallet().withdrawable, 0);
});

test("redeem credits the cashier without debiting the player again", async () => {
  seed({ cashierBalance: 50 });
  const created = await requestCode(80);
  assert.equal(created.statusCode, 201);
  assert.equal(playerWallet().balance, 120);

  const res = await redeem("0912345678", created.body.code);
  assert.equal(res.statusCode, 200, res.body?.message);
  assert.equal(res.body.playerBalance, 120);
  assert.equal(res.body.cashierBalance, 130);
  assert.equal(playerWallet().balance, 120);
  assert.equal(playerWallet().withdrawable, 120);
  assert.equal(cashierWallet().balance, 130);

  const pending = [...getStore().transaction.values()].find((tx) =>
    String(tx.reference).includes("shop-withdraw:"),
  );
  assert.match(pending.reference, /^approved:/);
});

test("a second withdrawal for the same cashier and player settles with its own reference", async () => {
  seed({ playerBalance: 200, playerWithdrawable: 200, cashierBalance: 0 });

  const first = await requestCode(40);
  assert.equal(first.statusCode, 201);
  const firstRedeem = await redeem("0912345678", first.body.code);
  assert.equal(firstRedeem.statusCode, 200, firstRedeem.body?.message);

  const second = await requestCode(60);
  assert.equal(second.statusCode, 201);
  const secondRedeem = await redeem("0912345678", second.body.code);
  assert.equal(secondRedeem.statusCode, 200, secondRedeem.body?.message);
  assert.equal(secondRedeem.body.playerBalance, 100);
  assert.equal(secondRedeem.body.cashierBalance, 100);
  assert.equal(playerWallet().balance, 100);
  assert.equal(cashierWallet().balance, 100);

  const credits = [...getStore().transaction.values()].filter((tx) =>
    String(tx.reference).startsWith("cashier-withdraw-approve:"),
  );
  assert.equal(credits.length, 2);
  assert.notEqual(credits[0].reference, credits[1].reference);
  for (const credit of credits) {
    assert.match(credit.reference, /:tx:/);
  }
});

test("an expired unused code returns funds and a second sweep is a no-op", async () => {
  seed();
  const created = await requestCode(80);
  assert.equal(created.statusCode, 201);
  assert.equal(playerWallet().balance, 120);

  const intent = [...getStore().shopWithdrawIntent.values()][0];
  intent.expires_at = new Date(Date.now() - 60_000);

  const first = await runExpireShopWithdrawals();
  assert.equal(first.expired, 1);
  assert.equal(playerWallet().balance, 200);
  assert.equal(playerWallet().withdrawable, 200);

  const refunds = [...getStore().transaction.values()].filter((tx) =>
    String(tx.reference).startsWith("shop-withdraw-refund:"),
  );
  assert.equal(refunds.length, 1);
  assert.equal(getStore().shopWithdrawIntent.get(intent.id).consumed_at != null, true);

  const notices = [...getStore().notification.values()].filter(
    (row) => row.kind === "WITHDRAW_REJECTED",
  );
  assert.equal(notices.length, 1);
  assert.match(notices[0].body, /returned/);

  const second = await runExpireShopWithdrawals();
  assert.equal(second.scanned, 0);
  assert.equal(second.expired, 0);
  assert.equal(playerWallet().balance, 200);
  assert.equal(
    [...getStore().transaction.values()].filter((tx) =>
      String(tx.reference).startsWith("shop-withdraw-refund:"),
    ).length,
    1,
  );
});
