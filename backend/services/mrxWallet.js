/**
 * MRX Instant Games wallet bridge operations.
 *
 * Idempotent via `Transaction.reference @unique`. Plain balance updates
 * (MichuBet has no withdrawable field) — same concurrency pattern as
 * `services/inoutWallet.js`:
 *   GAME_FEE     -> debit + BET ledger
 *   GAME_WINNING -> credit + PAYOUT ledger
 *
 * References:
 *   fee -> mrx:fee:{id}
 *   win -> mrx:win:{id}
 *
 * @module services/mrxWallet
 */
import { prisma } from "../Config/db.js";
import { feeRef, winRef } from "../lib/mrxWalletRefs.js";
import { toMoney, d } from "../lib/moneyDecimal.js";
import { normalizeEthiopiaPhone } from "../lib/phone.js";

export { feeRef, winRef };

function isUniqueConstraintError(err) {
  return err?.code === "P2002";
}

/**
 * @typedef {Object} MrxWalletResult
 * @property {"ok"|"insufficient_funds"|"user_not_found"|"no_wallet"|"duplicate"|"invalid_amount"} status
 * @property {number} [balance]
 */

/**
 * Resolve PLAYER user + wallet by any accepted Ethiopian phone format.
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {string} phone
 */
async function findPlayerByPhone(tx, phone) {
  const canonical = normalizeEthiopiaPhone(phone);
  if (!canonical) return null;

  const user = await tx.user.findFirst({
    where: {
      phone: canonical,
      status: true,
      role: { name: "PLAYER" },
    },
    select: {
      id: true,
      wallets: {
        where: { wallet_type: "PLAYER" },
        take: 1,
      },
    },
  });
  if (!user) return null;
  return { userId: user.id, wallet: user.wallets[0] ?? null };
}

/**
 * Debit a game stake (GAME_FEE).
 *
 * @param {string} phone
 * @param {number} amount
 * @param {string} referenceId Idempotency key (caller-provided or generated)
 * @returns {Promise<MrxWalletResult>}
 */
export async function debitGameFee(phone, amount, referenceId) {
  const reference = feeRef(referenceId);
  const stake = toMoney(amount);
  if (!Number.isFinite(stake) || stake <= 0) {
    return { status: "invalid_amount" };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: { reference },
      select: { balance_after: true },
    });
    if (existing) {
      return { status: "duplicate", balance: Number(existing.balance_after) };
    }

    const found = await findPlayerByPhone(tx, phone);
    if (!found) return { status: "user_not_found" };
    if (!found.wallet) return { status: "no_wallet" };

    const wallet = found.wallet;
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
 * Credit a game win (GAME_WINNING).
 *
 * @param {string} phone
 * @param {number} amount
 * @param {string} referenceId
 * @returns {Promise<MrxWalletResult>}
 */
export async function creditGameWinning(phone, amount, referenceId) {
  const reference = winRef(referenceId);
  const credit = toMoney(amount);
  if (!Number.isFinite(credit) || credit <= 0) {
    return { status: "invalid_amount" };
  }

  return prisma.$transaction(async (tx) => {
    const existing = await tx.transaction.findFirst({
      where: { reference },
      select: { balance_after: true },
    });
    if (existing) {
      return { status: "duplicate", balance: Number(existing.balance_after) };
    }

    const found = await findPlayerByPhone(tx, phone);
    if (!found) return { status: "user_not_found" };
    if (!found.wallet) return { status: "no_wallet" };

    const wallet = found.wallet;
    const before = Number(wallet.balance) || 0;
    const after = toMoney(d(before).add(credit));

    await tx.wallet.update({
      where: { id: wallet.id },
      data: { balance: after },
    });

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
