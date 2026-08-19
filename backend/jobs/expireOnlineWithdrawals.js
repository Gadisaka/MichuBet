/**
 * Expire stale PENDING online-withdraw requests and refund the player.
 *
 * @module jobs/expireOnlineWithdrawals
 */
import { prisma } from "../Config/db.js";
import { notifyUserSafe } from "../lib/createNotification.js";
import { refundOnlineWithdrawRequest } from "../lib/onlineWithdraw.js";
import { onlineWithdrawRejectedNotification } from "../lib/notificationMessages.js";

const DEFAULT_BATCH = Number(process.env.ONLINE_WITHDRAW_EXPIRE_BATCH || 50);

export async function runExpireOnlineWithdrawals({
  db = prisma,
  now = Date.now(),
} = {}) {
  const stale = await db.onlineWithdrawRequest.findMany({
    where: {
      status: "PENDING",
      expires_at: { lte: new Date(now) },
    },
    orderBy: { expires_at: "asc" },
    take: DEFAULT_BATCH,
  });

  let expired = 0;
  let skipped = 0;

  for (const request of stale) {
    try {
      await db.$transaction(async (tx) => {
        const live = await tx.onlineWithdrawRequest.findUnique({
          where: { id: request.id },
        });
        if (!live || live.status !== "PENDING") {
          throw new Error("NOT_PENDING");
        }
        await refundOnlineWithdrawRequest(tx, live, {
          nextStatus: "EXPIRED",
          reason: "Request expired",
        });
      });
      expired += 1;
      const msg = onlineWithdrawRejectedNotification({
        amount: request.amount,
        reason: "Request expired after the payout window. Funds returned to your wallet.",
      });
      void notifyUserSafe({ userId: request.user_id, ...msg });
    } catch (err) {
      skipped += 1;
      if (err?.message !== "NOT_PENDING" && err?.message !== "ALREADY_REFUNDED") {
        console.error(
          `[expireOnlineWithdrawals] failed id=${request.id}:`,
          err?.message || err,
        );
      }
    }
  }

  if (stale.length > 0) {
    console.log(
      `[expireOnlineWithdrawals] scanned=${stale.length} expired=${expired} skipped=${skipped}`,
    );
  }
  return { scanned: stale.length, expired, skipped };
}

export default runExpireOnlineWithdrawals;
