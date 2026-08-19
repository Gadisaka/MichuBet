/**
 * Online-withdraw fee and expiry, persisted in `settings`.
 *
 * Fee percent is snapshotted onto each request so later setting changes
 * do not rewrite history.
 *
 * @module lib/onlineWithdrawSettings
 */
import { toMoney, d } from "./moneyDecimal.js";

export const ONLINE_WITHDRAW_FEE_PERCENT_KEY = "ONLINE_WITHDRAW_FEE_PERCENT";
export const ONLINE_WITHDRAW_EXPIRY_HOURS_KEY = "ONLINE_WITHDRAW_EXPIRY_HOURS";

export const DEFAULT_ONLINE_WITHDRAW_FEE_PERCENT = 10;
export const MIN_ONLINE_WITHDRAW_FEE_PERCENT = 0;
export const MAX_ONLINE_WITHDRAW_FEE_PERCENT = 50;

export const DEFAULT_ONLINE_WITHDRAW_EXPIRY_HOURS = 48;
export const MIN_ONLINE_WITHDRAW_EXPIRY_HOURS = 1;
export const MAX_ONLINE_WITHDRAW_EXPIRY_HOURS = 168;

export const ONLINE_WITHDRAW_DEBIT_REF_PREFIX = "online-withdraw:";
export const ONLINE_WITHDRAW_SETTLE_REF_PREFIX = "online-withdraw-settle:";
export const ONLINE_WITHDRAW_REFUND_REF_PREFIX = "online-withdraw-refund:";

/**
 * @param {number} amount gross
 * @param {number} feePercent e.g. 10 for 10%
 */
export function computeOnlineWithdrawFee(amount, feePercent) {
  const gross = toMoney(amount);
  const percent = Number(feePercent);
  if (!Number.isFinite(gross) || gross <= 0) {
    throw new Error("INVALID_AMOUNT");
  }
  if (!Number.isFinite(percent) || percent < 0) {
    throw new Error("INVALID_FEE");
  }
  const feeAmount = toMoney(d(gross).mul(percent).div(100));
  const netAmount = toMoney(d(gross).sub(feeAmount));
  if (netAmount <= 0) {
    throw new Error("FEE_EXCEEDS_AMOUNT");
  }
  return {
    amount: gross,
    feePercent: percent,
    feeAmount,
    netAmount,
  };
}

function parsePercent(raw) {
  if (raw == null || raw === "") return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  if (n < MIN_ONLINE_WITHDRAW_FEE_PERCENT || n > MAX_ONLINE_WITHDRAW_FEE_PERCENT) {
    return null;
  }
  return n;
}

function parseHours(raw) {
  if (raw == null || raw === "") return null;
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n)) return null;
  if (n < MIN_ONLINE_WITHDRAW_EXPIRY_HOURS || n > MAX_ONLINE_WITHDRAW_EXPIRY_HOURS) {
    return null;
  }
  return n;
}

/**
 * @param {import("@prisma/client").PrismaClient} prismaClient
 */
export async function resolveOnlineWithdrawSettings(prismaClient) {
  const [feeRow, expiryRow] = await Promise.all([
    prismaClient.setting.findUnique({
      where: { key: ONLINE_WITHDRAW_FEE_PERCENT_KEY },
    }),
    prismaClient.setting.findUnique({
      where: { key: ONLINE_WITHDRAW_EXPIRY_HOURS_KEY },
    }),
  ]);

  const feePercent =
    parsePercent(feeRow?.value) ?? DEFAULT_ONLINE_WITHDRAW_FEE_PERCENT;
  const expiryHours =
    parseHours(expiryRow?.value) ?? DEFAULT_ONLINE_WITHDRAW_EXPIRY_HOURS;

  return {
    feePercent,
    expiryHours,
    configuredInDatabase: Boolean(feeRow || expiryRow),
  };
}
