/**
 * Cashier → player deposit.
 *
 * Run: node --test backend/tests/cashierDeposit.test.js
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
const { resetStore, getStore, prisma } = stubModule;

const { cashierDeposit } = await import(
  "../controllers/cashierWalletController.js"
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

function seedHappyPath({
  cashierBalance = 1000,
  playerBalance = 0,
  firstDepositAt = null,
} = {}) {
  resetStore();
  const store = getStore();
  const playerWallet = {
    id: PLAYER_WALLET_ID,
    user_id: PLAYER_ID,
    wallet_type: "PLAYER",
    balance: playerBalance,
    withdrawable: 0,
  };
  store.user.set(PLAYER_ID, {
    id: PLAYER_ID,
    name: "Test Player",
    phone: PLAYER_PHONE,
    first_deposit_at: firstDepositAt,
    role: { name: "PLAYER" },
    wallets: [playerWallet],
  });
  store.wallet.set(PLAYER_WALLET_ID, { ...playerWallet });
  store.wallet.set(CASHIER_WALLET_ID, {
    id: CASHIER_WALLET_ID,
    user_id: CASHIER_ID,
    wallet_type: "CASHIER",
    balance: cashierBalance,
    withdrawable: 0,
  });
}

async function deposit(amount, phone = "0912345678") {
  const req = {
    body: { phone, amount },
    user: { sub: CASHIER_ID, role: "CASHIER" },
    headers: {},
  };
  const res = mockRes();
  await cashierDeposit(req, res);
  return res;
}

test("cashier deposit credits the player and debits the cashier", async () => {
  seedHappyPath();
  const res = await deposit(100);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, "Deposit successful");
  assert.equal(res.body.playerBalance, 100);
  assert.equal(res.body.cashierBalance, 900);

  const store = getStore();
  const playerTxs = [...store.transaction.values()].filter(
    (tx) => tx.type === "DEPOSIT",
  );
  assert.equal(playerTxs.length, 1);
  assert.match(playerTxs[0].reference, /^cashier-deposit:/);
});

test("a second deposit to the same player succeeds (unique ledger refs)", async () => {
  seedHappyPath({ cashierBalance: 500, playerBalance: 100, firstDepositAt: new Date() });
  const first = await deposit(50);
  assert.equal(first.statusCode, 200);
  const second = await deposit(25);
  assert.equal(second.statusCode, 200);
  assert.equal(second.body.playerBalance, 175);
  assert.equal(second.body.cashierBalance, 425);

  const refs = [...getStore().transaction.values()].map((tx) => tx.reference);
  assert.equal(new Set(refs).size, refs.length);
  assert.equal(refs.length, 4);
});

test("rejects when cashier float is too low", async () => {
  seedHappyPath({ cashierBalance: 10 });
  const res = await deposit(50);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Insufficient cashier balance");
});

test("maps INVALID_AMOUNT from creditWallet to 400", async () => {
  seedHappyPath();
  const res = await deposit(0.001);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.message, "Invalid deposit amount");
});

test("returns 404 when the in-tx player wallet is missing", async () => {
  seedHappyPath();
  getStore().wallet.delete(PLAYER_WALLET_ID);
  const res = await deposit(20);
  assert.equal(res.statusCode, 404);
  assert.equal(res.body.message, "Player wallet not found");
});

test("bonus engine errors do not roll back the deposit", async () => {
  seedHappyPath();
  const original = prisma.bonus.findFirst;
  prisma.bonus.findFirst = async () => {
    throw new Error("BONUS_LOOKUP_FAILED");
  };
  try {
    const res = await deposit(80);
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.message, "Deposit successful");
    assert.equal(res.body.playerBalance, 80);
    assert.equal(res.body.cashierBalance, 920);
  } finally {
    prisma.bonus.findFirst = original;
  }
});
