/**
 * Shared helpers for the online-withdraw (player → cashier agent) flow.
 *
 * @module lib/onlineWithdraw
 */
import { creditWallet } from "./walletBalance.js";
import {
  ONLINE_WITHDRAW_REFUND_REF_PREFIX,
  ONLINE_WITHDRAW_SETTLE_REF_PREFIX,
} from "./onlineWithdrawSettings.js";
import { resolveBanks } from "./ethiopianBanks.js";

export function cashierBankCodes(cashier) {
  return Array.isArray(cashier?.online_withdraw_banks)
    ? cashier.online_withdraw_banks
    : [];
}

export function isCashierOnlineWithdrawReady(cashier) {
  return Boolean(
    cashier &&
      cashier.status === true &&
      cashier.online_withdraw_enabled === true &&
      cashier.online_withdraw_available === true &&
      cashierBankCodes(cashier).length > 0,
  );
}

export function maskAccountNumber(value) {
  const s = String(value ?? "").replace(/\s+/g, "");
  if (s.length <= 4) return "****";
  return `${"*".repeat(Math.max(4, s.length - 4))}${s.slice(-4)}`;
}

function toIso(d) {
  if (!d) return null;
  try {
    return new Date(d).toISOString();
  } catch {
    return null;
  }
}

/**
 * @param {object} row
 * @param {{ includeAccount?: boolean, includePlayer?: boolean, includeCashier?: boolean }} [opts]
 */
export function serializeOnlineWithdrawRequest(row, opts = {}) {
  const includeAccount = opts.includeAccount !== false;
  const cashier = row.cashier
    ? {
        id: row.cashier.id,
        branchName: row.cashier.branch_name,
        branchLocation: row.cashier.branch_location ?? null,
        banks: resolveBanks(cashierBankCodes(row.cashier)),
        user: row.cashier.user
          ? {
              id: row.cashier.user.id,
              name: row.cashier.user.name,
              phone: row.cashier.user.phone ?? null,
            }
          : undefined,
      }
    : undefined;

  const player = row.user
    ? {
        id: row.user.id,
        name: row.user.name,
        phone: row.user.phone ?? null,
      }
    : undefined;

  return {
    id: row.id,
    amount: Number(row.amount),
    feePercent: Number(row.fee_percent),
    feeAmount: Number(row.fee_amount),
    netAmount: Number(row.net_amount),
    bankCode: row.bank_code,
    bankName: row.bank_name,
    accountNumber: includeAccount
      ? row.account_number
      : maskAccountNumber(row.account_number),
    accountName: row.account_name,
    status: row.status,
    rejectReason: row.reject_reason ?? null,
    completedAt: toIso(row.completed_at),
    expiresAt: toIso(row.expires_at),
    createdAt: toIso(row.created_at),
    cashier: opts.includeCashier === false ? undefined : cashier,
    player: opts.includePlayer === false ? undefined : player,
  };
}

export function isPrismaUniqueConflict(err) {
  return err?.code === "P2002";
}

/**
 * Credit cashier wallet by the GROSS amount and mark the request COMPLETED.
 * Idempotent via unique settlement reference.
 *
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 */
export async function settleOnlineWithdrawRequest(tx, request, { cashierWalletId }) {
  if (request.status !== "PENDING") {
    throw new Error("NOT_PENDING");
  }
  const amount = Number(request.amount);
  const settleRef = `${ONLINE_WITHDRAW_SETTLE_REF_PREFIX}${request.id}`;

  const cWallet = await tx.wallet.findUnique({ where: { id: cashierWalletId } });
  if (!cWallet) throw new Error("CASHIER_WALLET_NOT_FOUND");

  const credit = await creditWallet(tx, cWallet, amount);

  let settleTx;
  try {
    settleTx = await tx.transaction.create({
      data: {
        wallet_id: cWallet.id,
        type: "DEPOSIT",
        amount,
        balance_before: credit.balanceBefore,
        balance_after: credit.balanceAfter,
        reference: settleRef,
      },
    });
  } catch (err) {
    if (isPrismaUniqueConflict(err)) {
      throw new Error("ALREADY_SETTLED");
    }
    throw err;
  }

  const updated = await tx.onlineWithdrawRequest.updateMany({
    where: { id: request.id, status: "PENDING" },
    data: {
      status: "COMPLETED",
      completed_at: new Date(),
      settlement_transaction_id: settleTx.id,
    },
  });
  if (updated.count !== 1) {
    throw new Error("NOT_PENDING");
  }

  return {
    settlementTransactionId: settleTx.id,
    cashierBalance: credit.balanceAfter,
  };
}

/**
 * Refund the GROSS amount to the player as withdrawable and set REJECTED/EXPIRED.
 * Idempotent via unique refund reference.
 *
 * @param {import("@prisma/client").Prisma.TransactionClient} tx
 * @param {"REJECTED"|"EXPIRED"} nextStatus
 */
export async function refundOnlineWithdrawRequest(
  tx,
  request,
  { nextStatus, reason },
) {
  if (request.status !== "PENDING") {
    throw new Error("NOT_PENDING");
  }
  if (nextStatus !== "REJECTED" && nextStatus !== "EXPIRED") {
    throw new Error("INVALID_STATUS");
  }

  const amount = Number(request.amount);
  const refundRef = `${ONLINE_WITHDRAW_REFUND_REF_PREFIX}${request.id}`;

  const playerWallet = await tx.wallet.findFirst({
    where: { user_id: request.user_id, wallet_type: "PLAYER" },
  });
  if (!playerWallet) throw new Error("WALLET_NOT_FOUND");

  const credit = await creditWallet(tx, playerWallet, amount, {
    withdrawable: true,
  });

  let refundTx;
  try {
    refundTx = await tx.transaction.create({
      data: {
        wallet_id: playerWallet.id,
        type: "DEPOSIT",
        amount,
        balance_before: credit.balanceBefore,
        balance_after: credit.balanceAfter,
        reference: refundRef,
      },
    });
  } catch (err) {
    if (isPrismaUniqueConflict(err)) {
      throw new Error("ALREADY_REFUNDED");
    }
    throw err;
  }

  const data = {
    status: nextStatus,
    refund_transaction_id: refundTx.id,
  };
  if (reason) data.reject_reason = String(reason).slice(0, 500);

  const updated = await tx.onlineWithdrawRequest.updateMany({
    where: { id: request.id, status: "PENDING" },
    data,
  });
  if (updated.count !== 1) {
    throw new Error("NOT_PENDING");
  }

  return {
    refundTransactionId: refundTx.id,
    playerBalance: credit.balanceAfter,
    playerWithdrawable: credit.withdrawableAfter,
  };
}

export function normalizeAccountNumber(raw) {
  return String(raw ?? "").replace(/\s+/g, "").trim();
}

export function normalizeAccountName(raw) {
  return String(raw ?? "").trim().replace(/\s+/g, " ");
}

export function validatePayoutDestination(accountNumber, accountName) {
  const number = normalizeAccountNumber(accountNumber);
  const name = normalizeAccountName(accountName);
  if (number.length < 5 || number.length > 40) {
    return "Enter a valid account or wallet number (5–40 characters).";
  }
  if (!/^[0-9A-Za-z]+$/.test(number)) {
    return "Account number may only contain letters and digits.";
  }
  if (name.length < 2 || name.length > 80) {
    return "Enter the account holder name (2–80 characters).";
  }
  return null;
}
