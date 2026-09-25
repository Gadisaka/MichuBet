/**
 * Expire unused shop-withdraw codes and return the held funds to the player.
 *
 * @module jobs/expireShopWithdrawals
 */
import { prisma } from "../Config/db.js";
import { notifyUserSafe } from "../lib/createNotification.js";
import { shopWithdrawExpiredNotification } from "../lib/notificationMessages.js";
import {
  SHOP_WITHDRAW_REF_PREFIX,
  SHOP_WITHDRAW_REFUND_REF_PREFIX,
  shopWithdrawExpiredReference,
} from "../lib/shopWithdraw.js";
import { creditWallet } from "../lib/walletBalance.js";

const DEFAULT_BATCH = Number(process.env.SHOP_WITHDRAW_EXPIRE_BATCH || 50);

export async function runExpireShopWithdrawals({
  db = prisma,
  now = Date.now(),
} = {}) {
  const stale = await db.shopWithdrawIntent.findMany({
    where: {
      consumed_at: null,
      expires_at: { lte: new Date(now) },
    },
    orderBy: { expires_at: "asc" },
    take: DEFAULT_BATCH,
  });

  let expired = 0;
  let skipped = 0;

  for (const intent of stale) {
    try {
      await db.$transaction(async (tx) => {
        const live = await tx.shopWithdrawIntent.findUnique({
          where: { id: intent.id },
        });
        if (!live || live.consumed_at) {
          throw new Error("NOT_PENDING");
        }

        const pendingTx = await tx.transaction.findUnique({
          where: { id: live.transaction_id },
        });
        if (!pendingTx?.reference?.startsWith(SHOP_WITHDRAW_REF_PREFIX)) {
          throw new Error("NOT_PENDING");
        }

        const playerWallet = await tx.wallet.findFirst({
          where: { user_id: live.user_id, wallet_type: "PLAYER" },
        });
        if (!playerWallet) throw new Error("WALLET_NOT_FOUND");

        const amount = Number(live.amount);
        const credit = await creditWallet(tx, playerWallet, amount, {
          withdrawable: true,
        });

        try {
          await tx.transaction.create({
            data: {
              wallet_id: playerWallet.id,
              type: "DEPOSIT",
              amount,
              balance_before: credit.balanceBefore,
              balance_after: credit.balanceAfter,
              reference: `${SHOP_WITHDRAW_REFUND_REF_PREFIX}${live.id}`,
            },
          });
        } catch (err) {
          if (err?.code === "P2002") throw new Error("ALREADY_REFUNDED");
          throw err;
        }

        await tx.transaction.update({
          where: { id: pendingTx.id },
          data: { reference: shopWithdrawExpiredReference(live.id) },
        });

        await tx.shopWithdrawIntent.update({
          where: { id: live.id },
          data: { consumed_at: new Date(now) },
        });
      });

      expired += 1;
      const msg = shopWithdrawExpiredNotification({ amount: intent.amount });
      await notifyUserSafe({ userId: intent.user_id, ...msg });
    } catch (err) {
      skipped += 1;
      if (err?.message !== "NOT_PENDING" && err?.message !== "ALREADY_REFUNDED") {
        console.error(
          `[expireShopWithdrawals] failed id=${intent.id}:`,
          err?.message || err,
        );
      }
    }
  }

  if (stale.length > 0) {
    console.log(
      `[expireShopWithdrawals] scanned=${stale.length} expired=${expired} skipped=${skipped}`,
    );
  }
  return { scanned: stale.length, expired, skipped };
}

export default runExpireShopWithdrawals;
