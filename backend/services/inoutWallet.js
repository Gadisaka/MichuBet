/**
 * InOut Games wallet operations.
 *
 * Seamless-wallet money movements for casino play. Each function is idempotent
 * through the DB-level `Transaction.reference @unique` constraint (see the note
 * on the model in schema.prisma) and mirrors the concurrency-safe pattern used
 * by `services/ticketSettlementService.js` (re-read wallet, unique-ref insert,
 * P2002 -> idempotent return, restoring the balance bump on a losing race).
 *
 * Ledger references:
 *   bet      -> inout:bet:{transactionId}      (type BET,    debit)
 *   withdraw -> inout:withdraw:{transactionId} (type PAYOUT, credit)
 *   rollback -> inout:rollback:{transactionId} (type PAYOUT, credit/refund)
 *
 * Amounts are treated as fiat (ETB) and rounded to 2 decimals.
 *
 * @module services/inoutWallet
 */
import { prisma } from "../Config/db.js";
import { toMoney, d } from "../lib/moneyDecimal.js";

export function betRef(transactionId) {
  return `inout:bet:${transactionId}`;
}
export function withdrawRef(transactionId) {
  return `inout:withdraw:${transactionId}`;
}
export function rollbackRef(transactionId) {
  return `inout:rollback:${transactionId}`;
}

function isUniqueConstraintError(err) {
  return err?.code === "P2002";
}

/**
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {string} userId
 */
async function findPlayerWallet(tx, userId) {
  return tx.wallet.findFirst({
    where: { user_id: userId, wallet_type: "PLAYER" },
  });
}

/**
 * Result shape shared by all operations.
 * @typedef {Object} WalletOpResult
 * @property {"ok"|"insufficient_funds"|"no_wallet"|"duplicate"} status
 * @property {number} [balance] Wallet balance after the operation.
 */

/**
 * Debit a bet stake from the player wallet.
 *
 * @param {string} userId
 * @param {number} amount Positive stake amount.
 * @param {string} transactionId InOut transaction id (idempotency key).
 * @returns {Promise<WalletOpResult>}
 */
export async function debitForBet(userId, amount, transactionId) {
  const reference = betRef(transactionId);
  const stake = toMoney(amount);
  if (!Number.isFinite(stake) || stake <= 0) {
    return { status: "insufficient_funds" };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: { reference },
      select: { balance_after: true },
    });
    if (existing) {
      return { status: "duplicate", balance: Number(existing.balance_after) };
    }

    const wallet = await findPlayerWallet(tx, userId);
    if (!wallet) return { status: "no_wallet" };

    const before = Number(wallet.balance) || 0;
    if (d(before).lessThan(stake)) {
      return { status: "insufficient_funds", balance: before };
    }
    const after = toMoney(d(before).sub(stake));

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: after },
    });

    try {
      await tx.transaction.create({
        data: {
          wallet_id: wallet.id,
          type: "BET",
          amount: stake,
          balance_before: before,
          balance_after: after,
          reference,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        await tx.wallet.update({
          where: { id: wallet.id },
          data: { balance: before },
        });
        const dup = await tx.transaction.findFirst({
          where: { reference },
          select: { balance_after: true },
        });
        return {
          status: "duplicate",
          balance: Number(dup?.balance_after ?? before),
        };
      }
      throw err;
    }

    return { status: "ok", balance: after };
  });
}

/**
 * Credit a payout to the player wallet.
 *
 * Shared by `withdraw` (win/loss result, stake already included) and
 * `rollback` (stake refund). The caller supplies the reference + amount.
 *
 * @param {string} userId
 * @param {number} amount Positive credit amount.
 * @param {string} reference Unique idempotency reference.
 * @returns {Promise<WalletOpResult>}
 */
async function creditPayout(userId, amount, reference) {
  const credit = toMoney(amount);

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: { reference },
      select: { balance_after: true },
    });
    if (existing) {
      return { status: "duplicate", balance: Number(existing.balance_after) };
    }

    const wallet = await findPlayerWallet(tx, userId);
    if (!wallet) return { status: "no_wallet" };

    const before = Number(wallet.balance) || 0;
    // A zero-value result (e.g. a losing round) is a valid, successful
    // settlement: record it for idempotency without changing the balance.
    const after = credit > 0 ? toMoney(d(before).add(credit)) : before;

    if (credit > 0) {
      await tx.wallet.update({
        where: { id: wallet.id },
        data: { balance: after },
      });
    }

    try {
      await tx.transaction.create({
        data: {
          wallet_id: wallet.id,
          type: "PAYOUT",
          amount: credit,
          balance_before: before,
          balance_after: after,
          reference,
        },
      });
    } catch (err) {
      if (isUniqueConstraintError(err)) {
        if (credit > 0) {
          await tx.wallet.update({
            where: { id: wallet.id },
            data: { balance: before },
          });
        }
        const dup = await tx.transaction.findFirst({
          where: { reference },
          select: { balance_after: true },
        });
        return {
          status: "duplicate",
          balance: Number(dup?.balance_after ?? before),
        };
      }
      throw err;
    }

    return { status: "ok", balance: after };
  });
}

/**
 * Credit the result of a finished game (withdraw webhook).
 * @param {string} userId
 * @param {number} result Total to credit (stake already included).
 * @param {string} transactionId InOut transaction id (idempotency key).
 * @returns {Promise<WalletOpResult>}
 */
export async function creditForWithdraw(userId, result, transactionId) {
  return creditPayout(userId, result, withdrawRef(transactionId));
}

/**
 * Refund a bet stake (rollback webhook).
 * @param {string} userId
 * @param {number} amount Stake to refund.
 * @param {string} transactionId InOut transaction id (idempotency key).
 * @returns {Promise<WalletOpResult>}
 */
export async function refundForRollback(userId, amount, transactionId) {
  return creditPayout(userId, amount, rollbackRef(transactionId));
}
