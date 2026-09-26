/**
 * Shared settlement: pending player WITHDRAW → credit cashier, update pending row, ledger cashier DEPOSIT.
 * Debits the player unless `alreadyDebited` and the pending row already shows the hold.
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 */
import { debitWallet } from "./walletBalance.js";

export async function completePendingPlayerWithdrawal(tx, {
  pendingTransactionId,
  cashierWalletId,
  approverUserId,
  alreadyDebited = false,
}) {
  const transaction = await tx.transaction.findUnique({ where: { id: pendingTransactionId } });
  if (!transaction) throw new Error("TX_NOT_FOUND");
  if (!transaction.reference?.startsWith("pending:")) throw new Error("NOT_PENDING");
  if (transaction.type !== "WITHDRAW") throw new Error("NOT_WITHDRAW");

  const amount = Number(transaction.amount);

  const pWallet = await tx.wallet.findUnique({ where: { id: transaction.wallet_id } });
  if (!pWallet) throw new Error("WALLET_NOT_FOUND");

  // Shop codes debit at request time, so the pending row already shows the hold.
  // Legacy rows (balance unchanged) still debit here even if the caller opts in.
  const heldAlready =
    alreadyDebited &&
    Number(transaction.balance_before) !== Number(transaction.balance_after);

  let balanceBefore = Number(transaction.balance_before);
  let balanceAfter = Number(transaction.balance_after);
  let playerBalance = Number(pWallet.balance);

  if (!heldAlready) {
    let playerDebit;
    try {
      playerDebit = await debitWallet(tx, pWallet, amount, {
        fromWithdrawable: true,
      });
    } catch (err) {
      if (err?.message === "INSUFFICIENT_BALANCE") {
        throw new Error("INSUFFICIENT_PLAYER_BALANCE");
      }
      if (err?.message === "INSUFFICIENT_WITHDRAWABLE") {
        throw new Error("INSUFFICIENT_WITHDRAWABLE");
      }
      throw err;
    }
    balanceBefore = playerDebit.balanceBefore;
    balanceAfter = playerDebit.balanceAfter;
    playerBalance = playerDebit.balanceAfter;
  }

  const cWallet = await tx.wallet.findUnique({ where: { id: cashierWalletId } });
  if (!cWallet) throw new Error("CASHIER_WALLET_NOT_FOUND");

  const cashierBefore = Number(cWallet.balance);
  const cashierAfter = cashierBefore + amount;

  await tx.wallet.update({
    where: { id: cWallet.id },
    data: { balance: cashierAfter },
  });

  const updatedTx = await tx.transaction.update({
    where: { id: pendingTransactionId },
    data: {
      reference: transaction.reference.replace("pending:", `approved:${approverUserId}:`),
      balance_before: balanceBefore,
      balance_after: balanceAfter,
    },
  });

  // `Transaction.reference` is unique across all wallets. Include the pending
  // transaction id so the same cashier can pay the same player more than once.
  await tx.transaction.create({
    data: {
      wallet_id: cWallet.id,
      type: "DEPOSIT",
      amount,
      balance_before: cashierBefore,
      balance_after: cashierAfter,
      reference: `cashier-withdraw-approve:${approverUserId}:from:${pWallet.user_id}:tx:${pendingTransactionId}`,
    },
  });

  return {
    transaction: updatedTx,
    cashierBalance: cashierAfter,
    playerBalance,
  };
}
