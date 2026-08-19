/**
 * Online withdraw: player requests a bank/wallet payout via an eligible cashier.
 *
 * Player is debited at request time (gross). Cashier is credited the same
 * gross on complete and is expected to send net (90% at the default 10% fee).
 *
 * @module controllers/onlineWithdrawController
 */
import crypto from "node:crypto";
import { prisma } from "../Config/db.js";
import { logAuditEvent } from "../lib/auditLog.js";
import { notifyUserSafe } from "../lib/createNotification.js";
import {
  ETHIOPIAN_BANKS,
  getBankByCode,
  normalizeBankCodes,
  resolveBanks,
} from "../lib/ethiopianBanks.js";
import {
  cashierBankCodes,
  isCashierOnlineWithdrawReady,
  refundOnlineWithdrawRequest,
  serializeOnlineWithdrawRequest,
  settleOnlineWithdrawRequest,
  validatePayoutDestination,
  normalizeAccountName,
  normalizeAccountNumber,
} from "../lib/onlineWithdraw.js";
import {
  computeOnlineWithdrawFee,
  ONLINE_WITHDRAW_DEBIT_REF_PREFIX,
  resolveOnlineWithdrawSettings,
} from "../lib/onlineWithdrawSettings.js";
import {
  onlineWithdrawCompletedNotification,
  onlineWithdrawPendingNotification,
  onlineWithdrawRejectedNotification,
  onlineWithdrawRequestNotification,
} from "../lib/notificationMessages.js";
import {
  getWithdrawAmountViolation,
  resolveBettingLimits,
} from "../lib/bettingLimits.js";
import { syncPlayerWithdrawableIfNeeded } from "../lib/syncWithdrawable.js";
import { debitWallet } from "../lib/walletBalance.js";
import { withWalletLock } from "../lib/walletLock.js";
import { toMoney } from "../lib/moneyDecimal.js";

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

function toPositiveInt(value, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
  return parsed;
}

function parsePage(query) {
  const page = toPositiveInt(query?.page, 1);
  const limit = Math.min(100, toPositiveInt(query?.limit, 20));
  return { page, limit, skip: (page - 1) * limit };
}

function isWalletBusy(err) {
  return err?.code === "wallet_busy" || err?.message === "WALLET_BUSY";
}

async function withWalletLockFallback(walletId, fn) {
  if (!walletId) return fn();
  try {
    return await withWalletLock(walletId, {}, fn);
  } catch (err) {
    if (isWalletBusy(err)) throw err;
    console.warn(
      "[onlineWithdraw] wallet lock unavailable, continuing without lock:",
      err?.message || err,
    );
    return fn();
  }
}

function mapKnownError(res, err) {
  const msg = err?.message;
  if (isWalletBusy(err)) {
    return res.status(409).json({
      message: "Wallet is busy. Try again in a moment.",
      code: "wallet_busy",
    });
  }
  if (msg === "INSUFFICIENT_BALANCE" || msg === "INSUFFICIENT_PLAYER_BALANCE") {
    return res.status(400).json({ message: "Insufficient balance" });
  }
  if (msg === "INSUFFICIENT_WITHDRAWABLE") {
    return res.status(400).json({ message: "Insufficient withdrawable balance" });
  }
  if (msg === "NOT_PENDING" || msg === "ALREADY_SETTLED" || msg === "ALREADY_REFUNDED") {
    return res.status(409).json({ message: "This request is no longer pending" });
  }
  if (msg === "FEE_EXCEEDS_AMOUNT" || msg === "INVALID_AMOUNT") {
    return res.status(400).json({ message: "Amount is too small after the withdrawal fee" });
  }
  if (msg === "CASHIER_WALLET_NOT_FOUND" || msg === "WALLET_NOT_FOUND") {
    return res.status(404).json({ message: "Wallet not found" });
  }
  return null;
}

async function loadCashierForUser(userId) {
  return prisma.cashier.findUnique({
    where: { user_id: userId },
    include: {
      user: { select: { id: true, name: true, phone: true, status: true } },
      wallet: { select: { id: true, balance: true } },
    },
  });
}

const REQUEST_INCLUDE = {
  user: { select: { id: true, name: true, phone: true } },
  cashier: {
    include: {
      user: { select: { id: true, name: true, phone: true } },
    },
  },
};

export function listBanks(_req, res) {
  return res.json({ items: ETHIOPIAN_BANKS });
}

/**
 * GET /api/player/online-withdraw/config
 */
export async function getPlayerConfig(_req, res) {
  try {
    const [ow, limits] = await Promise.all([
      resolveOnlineWithdrawSettings(prisma),
      resolveBettingLimits(prisma),
    ]);
    return res.json({
      feePercent: ow.feePercent,
      expiryHours: ow.expiryHours,
      minWithdraw: limits.MIN_WITHDRAW,
      maxWithdraw: limits.MAX_WITHDRAW,
    });
  } catch (error) {
    console.error("getPlayerConfig online-withdraw error:", error);
    return res.status(500).json({ message: "Failed to load withdraw settings" });
  }
}

/**
 * GET /api/player/online-withdraw/cashiers
 */
export async function listPlayerCashiers(_req, res) {
  try {
    const cashiers = await prisma.cashier.findMany({
      where: {
        status: true,
        online_withdraw_enabled: true,
        online_withdraw_available: true,
      },
      include: {
        user: { select: { id: true, name: true, status: true } },
        wallet: { select: { id: true } },
      },
    });

    const eligible = cashiers.filter(
      (c) => c.user?.status !== false && cashierBankCodes(c).length > 0,
    );
    if (eligible.length === 0) {
      return res.json({ items: [] });
    }

    const since = new Date(Date.now() - SEVEN_DAYS_MS);
    const walletIds = eligible.map((c) => c.wallet_id).filter(Boolean);
    const cashierIds = eligible.map((c) => c.id);

    const [volumeRows, completedRows, pendingRows] = await Promise.all([
      walletIds.length
        ? prisma.transaction.groupBy({
            by: ["wallet_id"],
            where: {
              wallet_id: { in: walletIds },
              created_at: { gte: since },
            },
            _sum: { amount: true },
          })
        : [],
      prisma.onlineWithdrawRequest.groupBy({
        by: ["cashier_id"],
        where: { cashier_id: { in: cashierIds }, status: "COMPLETED" },
        _count: { _all: true },
      }),
      prisma.onlineWithdrawRequest.groupBy({
        by: ["cashier_id"],
        where: { cashier_id: { in: cashierIds }, status: "PENDING" },
        _count: { _all: true },
      }),
    ]);

    const volumeByWallet = new Map(
      volumeRows.map((r) => [r.wallet_id, Number(r._sum?.amount ?? 0)]),
    );
    const completedByCashier = new Map(
      completedRows.map((r) => [r.cashier_id, r._count?._all ?? 0]),
    );
    const pendingByCashier = new Map(
      pendingRows.map((r) => [r.cashier_id, r._count?._all ?? 0]),
    );

    const items = eligible
      .map((c) => ({
        id: c.id,
        name: c.user?.name || c.branch_name,
        branchName: c.branch_name,
        branchLocation: c.branch_location,
        banks: resolveBanks(cashierBankCodes(c)),
        pendingCount: pendingByCashier.get(c.id) ?? 0,
        _volume: volumeByWallet.get(c.wallet_id) ?? 0,
        _completed: completedByCashier.get(c.id) ?? 0,
      }))
      .sort((a, b) => {
        if (b._volume !== a._volume) return b._volume - a._volume;
        return b._completed - a._completed;
      })
      .map(({ _volume, _completed, ...rest }) => rest);

    return res.json({ items });
  } catch (error) {
    console.error("listPlayerCashiers error:", error);
    return res.status(500).json({ message: "Failed to load cashiers" });
  }
}

/**
 * GET /api/player/online-withdraw
 */
export async function listPlayerRequests(req, res) {
  try {
    if (req.user?.role !== "PLAYER") {
      return res.status(403).json({ message: "Online withdrawal is only for player accounts." });
    }
    const { page, limit, skip } = parsePage(req.query);
    const where = { user_id: req.user.sub };
    const [items, total] = await Promise.all([
      prisma.onlineWithdrawRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.onlineWithdrawRequest.count({ where }),
    ]);
    return res.json({
      items: items.map((row) =>
        serializeOnlineWithdrawRequest(row, { includeAccount: false }),
      ),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("listPlayerRequests error:", error);
    return res.status(500).json({ message: "Failed to load withdrawal requests" });
  }
}

/**
 * POST /api/player/online-withdraw
 */
export async function createPlayerRequest(req, res) {
  try {
    if (req.user?.role !== "PLAYER") {
      return res.status(403).json({
        message:
          "Online withdrawal is only for player accounts. Sign in with your player phone, not a staff/cashier login.",
      });
    }

    const { amount, cashierId, bankCode, accountNumber, accountName } =
      req.body ?? {};
    const numericAmount = toMoney(amount);
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: "amount must be a positive number" });
    }

    const destErr = validatePayoutDestination(accountNumber, accountName);
    if (destErr) return res.status(400).json({ message: destErr });

    const bank = getBankByCode(bankCode);
    if (!bank) {
      return res.status(400).json({ message: "Choose a supported bank or wallet" });
    }

    const [limits, owSettings] = await Promise.all([
      resolveBettingLimits(prisma),
      resolveOnlineWithdrawSettings(prisma),
    ]);
    const withdrawViolation = getWithdrawAmountViolation(limits, numericAmount);
    if (withdrawViolation) {
      return res.status(400).json({ message: withdrawViolation });
    }

    let fee;
    try {
      fee = computeOnlineWithdrawFee(numericAmount, owSettings.feePercent);
    } catch (err) {
      const mapped = mapKnownError(res, err);
      if (mapped) return mapped;
      throw err;
    }

    const cashier = await prisma.cashier.findUnique({
      where: { id: String(cashierId || "").trim() },
      include: {
        user: { select: { id: true, name: true, status: true } },
        wallet: { select: { id: true } },
      },
    });
    if (!cashier || cashier.user?.status === false || !isCashierOnlineWithdrawReady(cashier)) {
      return res.status(400).json({
        message: "That cashier is not available for online withdrawal. Pick another.",
      });
    }
    if (!cashierBankCodes(cashier).includes(bank.code)) {
      return res.status(400).json({
        message: "That cashier does not support the selected bank.",
      });
    }

    const wallet = await prisma.wallet.findFirst({
      where: { user_id: req.user.sub, wallet_type: "PLAYER" },
    });
    if (!wallet) {
      return res.status(400).json({
        message:
          "No player wallet on this account. Use a player login, or contact support if your wallet is missing.",
      });
    }

    const synced = await syncPlayerWithdrawableIfNeeded(prisma, wallet);
    if (synced.balance < fee.amount) {
      return res.status(400).json({ message: "Insufficient balance" });
    }
    if (synced.withdrawable < fee.amount) {
      return res.status(400).json({
        message: `Withdrawable balance is ${synced.withdrawable} ETB. Only winnings are withdrawable; unused deposits stay locked.`,
      });
    }

    const requestId = crypto.randomUUID();
    const expiresAt = new Date(
      Date.now() + owSettings.expiryHours * 60 * 60 * 1000,
    );
    const account = normalizeAccountNumber(accountNumber);
    const holder = normalizeAccountName(accountName);

    let created;
    try {
      created = await withWalletLockFallback(wallet.id, async () =>
        prisma.$transaction(async (tx) => {
          const live = await tx.wallet.findUnique({ where: { id: wallet.id } });
          if (!live) throw new Error("WALLET_NOT_FOUND");
          const debit = await debitWallet(tx, live, fee.amount, {
            fromWithdrawable: true,
          });
          const debitTx = await tx.transaction.create({
            data: {
              wallet_id: live.id,
              type: "WITHDRAW",
              amount: fee.amount,
              balance_before: debit.balanceBefore,
              balance_after: debit.balanceAfter,
              reference: `${ONLINE_WITHDRAW_DEBIT_REF_PREFIX}${requestId}`,
            },
          });
          const request = await tx.onlineWithdrawRequest.create({
            data: {
              id: requestId,
              user_id: req.user.sub,
              cashier_id: cashier.id,
              transaction_id: debitTx.id,
              amount: fee.amount,
              fee_percent: fee.feePercent,
              fee_amount: fee.feeAmount,
              net_amount: fee.netAmount,
              bank_code: bank.code,
              bank_name: bank.name,
              account_number: account,
              account_name: holder,
              status: "PENDING",
              expires_at: expiresAt,
            },
          });
          return { request, playerBalance: debit.balanceAfter };
        }),
      );
    } catch (err) {
      const mapped = mapKnownError(res, err);
      if (mapped) return mapped;
      throw err;
    }

    const player = await prisma.user.findUnique({
      where: { id: req.user.sub },
      select: { name: true },
    });
    const pendingMsg = onlineWithdrawPendingNotification({
      amount: fee.amount,
      netAmount: fee.netAmount,
    });
    void notifyUserSafe({ userId: req.user.sub, ...pendingMsg });
    const cashierMsg = onlineWithdrawRequestNotification({
      amount: fee.amount,
      netAmount: fee.netAmount,
      playerName: player?.name,
    });
    void notifyUserSafe({
      userId: cashier.user_id,
      ...cashierMsg,
      metadata: { ...cashierMsg.metadata, requestId },
    });

    const full = await prisma.onlineWithdrawRequest.findUnique({
      where: { id: created.request.id },
      include: REQUEST_INCLUDE,
    });

    return res.status(201).json({
      ...serializeOnlineWithdrawRequest(full, { includeAccount: true }),
      playerBalance: created.playerBalance,
      message:
        "Your balance has been deducted. You will receive your money in 24–48 hours.",
    });
  } catch (error) {
    console.error("createPlayerRequest error:", error);
    return res.status(500).json({ message: "Failed to create online withdrawal" });
  }
}

/**
 * GET /api/cashier/online-withdraw/profile
 */
export async function getCashierProfile(req, res) {
  try {
    const cashier = await loadCashierForUser(req.user.sub);
    if (!cashier) {
      return res.status(404).json({ message: "Cashier profile not found" });
    }
    return res.json({
      id: cashier.id,
      branchName: cashier.branch_name,
      branchLocation: cashier.branch_location,
      enabled: Boolean(cashier.online_withdraw_enabled),
      available: Boolean(cashier.online_withdraw_available),
      banks: resolveBanks(cashierBankCodes(cashier)),
      allBanks: ETHIOPIAN_BANKS,
      ready: isCashierOnlineWithdrawReady(cashier),
    });
  } catch (error) {
    console.error("getCashierProfile error:", error);
    return res.status(500).json({ message: "Failed to load profile" });
  }
}

/**
 * PATCH /api/cashier/online-withdraw/profile
 */
export async function patchCashierProfile(req, res) {
  try {
    const cashier = await loadCashierForUser(req.user.sub);
    if (!cashier) {
      return res.status(404).json({ message: "Cashier profile not found" });
    }

    const data = {};
    if (req.body?.banks !== undefined) {
      if (!Array.isArray(req.body.banks)) {
        return res.status(400).json({ message: "banks must be an array of codes" });
      }
      data.online_withdraw_banks = normalizeBankCodes(req.body.banks);
    }
    if (req.body?.available !== undefined) {
      data.online_withdraw_available = Boolean(req.body.available);
    }

    const nextBanks =
      data.online_withdraw_banks ?? cashierBankCodes(cashier);
    const nextAvailable =
      data.online_withdraw_available ?? Boolean(cashier.online_withdraw_available);
    if (nextAvailable && nextBanks.length === 0) {
      return res.status(400).json({
        message: "Add at least one supported bank before marking yourself available.",
      });
    }

    const updated = await prisma.cashier.update({
      where: { id: cashier.id },
      data,
    });

    return res.json({
      id: updated.id,
      enabled: Boolean(updated.online_withdraw_enabled),
      available: Boolean(updated.online_withdraw_available),
      banks: resolveBanks(cashierBankCodes(updated)),
      ready: isCashierOnlineWithdrawReady(updated),
    });
  } catch (error) {
    console.error("patchCashierProfile error:", error);
    return res.status(500).json({ message: "Failed to update profile" });
  }
}

/**
 * GET /api/cashier/online-withdraw
 */
export async function listCashierRequests(req, res) {
  try {
    const cashier = await loadCashierForUser(req.user.sub);
    if (!cashier) {
      return res.status(404).json({ message: "Cashier profile not found" });
    }
    const { page, limit, skip } = parsePage(req.query);
    const status = String(req.query.status || "").toUpperCase();
    const where = { cashier_id: cashier.id };
    if (["PENDING", "COMPLETED", "REJECTED", "EXPIRED"].includes(status)) {
      where.status = status;
    }

    const [pending, rest, total] = await Promise.all([
      where.status && where.status !== "PENDING"
        ? Promise.resolve([])
        : prisma.onlineWithdrawRequest.findMany({
            where: { ...where, status: "PENDING" },
            include: REQUEST_INCLUDE,
            orderBy: { created_at: "desc" },
          }),
      where.status === "PENDING"
        ? Promise.resolve([])
        : prisma.onlineWithdrawRequest.findMany({
            where: { ...where, ...(where.status ? {} : { status: { not: "PENDING" } }) },
            include: REQUEST_INCLUDE,
            orderBy: { created_at: "desc" },
          }),
      prisma.onlineWithdrawRequest.count({ where }),
    ]);

    const merged = [...pending, ...rest];
    const pageItems = merged.slice(skip, skip + limit);

    return res.json({
      items: pageItems.map((row) =>
        serializeOnlineWithdrawRequest(row, { includeAccount: true }),
      ),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
      profile: {
        enabled: Boolean(cashier.online_withdraw_enabled),
        available: Boolean(cashier.online_withdraw_available),
        banks: resolveBanks(cashierBankCodes(cashier)),
        ready: isCashierOnlineWithdrawReady(cashier),
      },
    });
  } catch (error) {
    console.error("listCashierRequests error:", error);
    return res.status(500).json({ message: "Failed to load requests" });
  }
}

async function loadOwnedPending(req, res) {
  const cashier = await loadCashierForUser(req.user.sub);
  if (!cashier) {
    res.status(404).json({ message: "Cashier profile not found" });
    return null;
  }
  const id = String(req.params.id || "").trim();
  const request = await prisma.onlineWithdrawRequest.findUnique({
    where: { id },
    include: REQUEST_INCLUDE,
  });
  if (!request || request.cashier_id !== cashier.id) {
    res.status(404).json({ message: "Request not found" });
    return null;
  }
  if (request.status !== "PENDING") {
    res.status(409).json({ message: "This request is no longer pending" });
    return null;
  }
  return { cashier, request };
}

/**
 * POST /api/cashier/online-withdraw/:id/complete
 */
export async function completeCashierRequest(req, res) {
  try {
    const loaded = await loadOwnedPending(req, res);
    if (!loaded) return;
    const { cashier, request } = loaded;

    let result;
    try {
      result = await withWalletLockFallback(cashier.wallet_id, async () =>
        prisma.$transaction(async (tx) => {
          const live = await tx.onlineWithdrawRequest.findUnique({
            where: { id: request.id },
          });
          if (!live || live.status !== "PENDING") throw new Error("NOT_PENDING");
          return settleOnlineWithdrawRequest(tx, live, {
            cashierWalletId: cashier.wallet_id,
          });
        }),
      );
    } catch (err) {
      const mapped = mapKnownError(res, err);
      if (mapped) return mapped;
      throw err;
    }

    const doneMsg = onlineWithdrawCompletedNotification({
      amount: request.amount,
      netAmount: request.net_amount,
    });
    void notifyUserSafe({ userId: request.user_id, ...doneMsg });

    const full = await prisma.onlineWithdrawRequest.findUnique({
      where: { id: request.id },
      include: REQUEST_INCLUDE,
    });
    return res.json({
      ...serializeOnlineWithdrawRequest(full, { includeAccount: true }),
      cashierBalance: result.cashierBalance,
    });
  } catch (error) {
    console.error("completeCashierRequest error:", error);
    return res.status(500).json({ message: "Failed to complete withdrawal" });
  }
}

/**
 * POST /api/cashier/online-withdraw/:id/reject
 */
export async function rejectCashierRequest(req, res) {
  try {
    const reason = String(req.body?.reason ?? "").trim();
    if (reason.length < 3) {
      return res.status(400).json({ message: "A rejection reason is required" });
    }

    const loaded = await loadOwnedPending(req, res);
    if (!loaded) return;
    const { request } = loaded;

    const playerWallet = await prisma.wallet.findFirst({
      where: { user_id: request.user_id, wallet_type: "PLAYER" },
    });

    try {
      await withWalletLockFallback(playerWallet?.id, async () =>
        prisma.$transaction(async (tx) => {
          const live = await tx.onlineWithdrawRequest.findUnique({
            where: { id: request.id },
          });
          if (!live || live.status !== "PENDING") throw new Error("NOT_PENDING");
          return refundOnlineWithdrawRequest(tx, live, {
            nextStatus: "REJECTED",
            reason,
          });
        }),
      );
    } catch (err) {
      const mapped = mapKnownError(res, err);
      if (mapped) return mapped;
      throw err;
    }

    const msg = onlineWithdrawRejectedNotification({
      amount: request.amount,
      reason,
    });
    void notifyUserSafe({ userId: request.user_id, ...msg });

    const full = await prisma.onlineWithdrawRequest.findUnique({
      where: { id: request.id },
      include: REQUEST_INCLUDE,
    });
    return res.json(serializeOnlineWithdrawRequest(full, { includeAccount: true }));
  } catch (error) {
    console.error("rejectCashierRequest error:", error);
    return res.status(500).json({ message: "Failed to reject withdrawal" });
  }
}

/**
 * GET /api/admin/online-withdraw/summary
 */
export async function getAdminSummary(_req, res) {
  try {
    const [all, pendingAgg, completedAgg, rejectedCount, expiredCount, eligibleCashiers] =
      await Promise.all([
        prisma.onlineWithdrawRequest.aggregate({
          _sum: { amount: true },
          _count: { _all: true },
        }),
        prisma.onlineWithdrawRequest.aggregate({
          where: { status: "PENDING" },
          _sum: { amount: true, net_amount: true },
          _count: { _all: true },
        }),
        prisma.onlineWithdrawRequest.aggregate({
          where: { status: "COMPLETED" },
          _sum: { amount: true, fee_amount: true, net_amount: true },
          _count: { _all: true },
        }),
        prisma.onlineWithdrawRequest.count({ where: { status: "REJECTED" } }),
        prisma.onlineWithdrawRequest.count({ where: { status: "EXPIRED" } }),
        prisma.cashier.count({
          where: { status: true, online_withdraw_enabled: true },
        }),
      ]);

    return res.json({
      totalRequested: Number(all._sum?.amount ?? 0),
      totalCount: all._count?._all ?? 0,
      totalPaidOut: Number(completedAgg._sum?.net_amount ?? 0),
      totalFees: Number(completedAgg._sum?.fee_amount ?? 0),
      totalGrossSettled: Number(completedAgg._sum?.amount ?? 0),
      completedCount: completedAgg._count?._all ?? 0,
      pendingCount: pendingAgg._count?._all ?? 0,
      pendingAmount: Number(pendingAgg._sum?.amount ?? 0),
      rejectedCount,
      expiredCount,
      eligibleCashiers,
    });
  } catch (error) {
    console.error("getAdminSummary error:", error);
    return res.status(500).json({ message: "Failed to load summary" });
  }
}

/**
 * GET /api/admin/online-withdraw/requests
 */
export async function listAdminRequests(req, res) {
  try {
    const { page, limit, skip } = parsePage(req.query);
    const status = String(req.query.status || "").toUpperCase();
    const cashierId = String(req.query.cashierId || "").trim();
    const search = String(req.query.search || "").trim();
    const from = req.query.from ? new Date(String(req.query.from)) : null;
    const to = req.query.to ? new Date(String(req.query.to)) : null;

    const where = {};
    if (["PENDING", "COMPLETED", "REJECTED", "EXPIRED"].includes(status)) {
      where.status = status;
    }
    if (cashierId) where.cashier_id = cashierId;
    if (
      (from && !Number.isNaN(from.getTime())) ||
      (to && !Number.isNaN(to.getTime()))
    ) {
      where.created_at = {};
      if (from && !Number.isNaN(from.getTime())) where.created_at.gte = from;
      if (to && !Number.isNaN(to.getTime())) where.created_at.lte = to;
    }

    if (search) {
      const users = await prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: search, mode: "insensitive" } },
            { phone: { contains: search } },
          ],
        },
        select: { id: true },
        take: 50,
      });
      const or = [
        { account_name: { contains: search, mode: "insensitive" } },
        { account_number: { contains: search } },
      ];
      if (users.length > 0) {
        or.unshift({ user_id: { in: users.map((u) => u.id) } });
      }
      where.OR = or;
    }

    const [items, total] = await Promise.all([
      prisma.onlineWithdrawRequest.findMany({
        where,
        include: REQUEST_INCLUDE,
        orderBy: { created_at: "desc" },
        skip,
        take: limit,
      }),
      prisma.onlineWithdrawRequest.count({ where }),
    ]);

    return res.json({
      items: items.map((row) =>
        serializeOnlineWithdrawRequest(row, { includeAccount: true }),
      ),
      page,
      limit,
      total,
      totalPages: Math.max(1, Math.ceil(total / limit)),
    });
  } catch (error) {
    console.error("listAdminRequests error:", error);
    return res.status(500).json({ message: "Failed to load requests" });
  }
}

/**
 * GET /api/admin/online-withdraw/cashiers
 */
export async function listAdminCashiers(_req, res) {
  try {
    const cashiers = await prisma.cashier.findMany({
      include: {
        user: { select: { id: true, name: true, phone: true, status: true } },
        wallet: { select: { id: true, balance: true } },
      },
      orderBy: { created_at: "desc" },
    });
    if (cashiers.length === 0) return res.json({ items: [] });

    const since = new Date(Date.now() - SEVEN_DAYS_MS);
    const walletIds = cashiers.map((c) => c.wallet_id);
    const cashierIds = cashiers.map((c) => c.id);

    const [volumeRows, requests] = await Promise.all([
      prisma.transaction.groupBy({
        by: ["wallet_id"],
        where: {
          wallet_id: { in: walletIds },
          created_at: { gte: since },
        },
        _sum: { amount: true },
      }),
      prisma.onlineWithdrawRequest.findMany({
        where: { cashier_id: { in: cashierIds } },
        select: {
          cashier_id: true,
          status: true,
          created_at: true,
          completed_at: true,
        },
      }),
    ]);

    const volumeByWallet = new Map(
      volumeRows.map((r) => [r.wallet_id, Number(r._sum?.amount ?? 0)]),
    );

    const stats = new Map();
    for (const id of cashierIds) {
      stats.set(id, {
        pending: 0,
        completed: 0,
        rejected: 0,
        expired: 0,
        completionMs: [],
      });
    }
    for (const r of requests) {
      const s = stats.get(r.cashier_id);
      if (!s) continue;
      if (r.status === "PENDING") s.pending += 1;
      else if (r.status === "COMPLETED") {
        s.completed += 1;
        if (r.completed_at && r.created_at) {
          s.completionMs.push(
            new Date(r.completed_at).getTime() - new Date(r.created_at).getTime(),
          );
        }
      } else if (r.status === "REJECTED") s.rejected += 1;
      else if (r.status === "EXPIRED") s.expired += 1;
    }

    const items = cashiers.map((c) => {
      const s = stats.get(c.id) ?? {
        pending: 0,
        completed: 0,
        rejected: 0,
        expired: 0,
        completionMs: [],
      };
      const avgCompletionMs =
        s.completionMs.length > 0
          ? Math.round(
              s.completionMs.reduce((a, b) => a + b, 0) / s.completionMs.length,
            )
          : null;
      return {
        id: c.id,
        userId: c.user_id,
        name: c.user?.name || c.branch_name,
        phone: c.user?.phone ?? null,
        branchName: c.branch_name,
        branchLocation: c.branch_location,
        userStatus: c.user?.status !== false,
        cashierStatus: c.status,
        enabled: Boolean(c.online_withdraw_enabled),
        available: Boolean(c.online_withdraw_available),
        banks: resolveBanks(cashierBankCodes(c)),
        ready: isCashierOnlineWithdrawReady(c),
        walletBalance: Number(c.wallet?.balance ?? 0),
        volume7d: volumeByWallet.get(c.wallet_id) ?? 0,
        pendingCount: s.pending,
        completedCount: s.completed,
        rejectedCount: s.rejected,
        expiredCount: s.expired,
        avgCompletionMs,
      };
    });

    items.sort((a, b) => b.volume7d - a.volume7d || b.completedCount - a.completedCount);
    return res.json({ items });
  } catch (error) {
    console.error("listAdminCashiers error:", error);
    return res.status(500).json({ message: "Failed to load cashiers" });
  }
}

/**
 * PATCH /api/admin/online-withdraw/cashiers/:id/eligibility
 */
export async function patchCashierEligibility(req, res) {
  try {
    const id = String(req.params.id || "").trim();
    if (typeof req.body?.enabled !== "boolean") {
      return res.status(400).json({ message: "enabled (boolean) is required" });
    }
    const cashier = await prisma.cashier.findUnique({
      where: { id },
      include: { user: { select: { name: true, phone: true } } },
    });
    if (!cashier) {
      return res.status(404).json({ message: "Cashier not found" });
    }

    const before = Boolean(cashier.online_withdraw_enabled);
    const updated = await prisma.cashier.update({
      where: { id },
      data: { online_withdraw_enabled: req.body.enabled },
    });

    await logAuditEvent({
      req,
      action: "ONLINE_WITHDRAW_ELIGIBILITY_UPDATED",
      module: "ONLINE_WITHDRAW",
      entityType: "CASHIER",
      entityId: cashier.id,
      before: { enabled: before },
      after: { enabled: Boolean(updated.online_withdraw_enabled) },
    });

    return res.json({
      id: updated.id,
      enabled: Boolean(updated.online_withdraw_enabled),
      name: cashier.user?.name || cashier.branch_name,
    });
  } catch (error) {
    console.error("patchCashierEligibility error:", error);
    return res.status(500).json({ message: "Failed to update eligibility" });
  }
}

/**
 * POST /api/admin/online-withdraw/requests/:id/force-reject
 */
export async function forceRejectRequest(req, res) {
  try {
    const reason = String(req.body?.reason ?? "").trim() || "Cancelled by admin";
    const id = String(req.params.id || "").trim();
    const request = await prisma.onlineWithdrawRequest.findUnique({
      where: { id },
    });
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }
    if (request.status !== "PENDING") {
      return res.status(409).json({ message: "This request is no longer pending" });
    }

    const playerWallet = await prisma.wallet.findFirst({
      where: { user_id: request.user_id, wallet_type: "PLAYER" },
    });

    try {
      await withWalletLockFallback(playerWallet?.id, async () =>
        prisma.$transaction(async (tx) => {
          const live = await tx.onlineWithdrawRequest.findUnique({
            where: { id: request.id },
          });
          if (!live || live.status !== "PENDING") throw new Error("NOT_PENDING");
          return refundOnlineWithdrawRequest(tx, live, {
            nextStatus: "REJECTED",
            reason,
          });
        }),
      );
    } catch (err) {
      const mapped = mapKnownError(res, err);
      if (mapped) return mapped;
      throw err;
    }

    await logAuditEvent({
      req,
      action: "ONLINE_WITHDRAW_FORCE_REJECT",
      module: "ONLINE_WITHDRAW",
      entityType: "ONLINE_WITHDRAW_REQUEST",
      entityId: request.id,
      after: { reason, status: "REJECTED" },
    });

    const msg = onlineWithdrawRejectedNotification({
      amount: request.amount,
      reason,
    });
    void notifyUserSafe({ userId: request.user_id, ...msg });

    const full = await prisma.onlineWithdrawRequest.findUnique({
      where: { id: request.id },
      include: REQUEST_INCLUDE,
    });
    return res.json(serializeOnlineWithdrawRequest(full, { includeAccount: true }));
  } catch (error) {
    console.error("forceRejectRequest error:", error);
    return res.status(500).json({ message: "Failed to reject request" });
  }
}
