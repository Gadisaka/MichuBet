/**
 * Processor for the `expire-shop-withdrawals` queue.
 *
 * @module queues/processors/expireShopWithdrawals
 */
import { runExpireShopWithdrawals } from "../../jobs/expireShopWithdrawals.js";

export async function processExpireShopWithdrawals(job) {
  const result = await runExpireShopWithdrawals();
  return { job: job.name, ...result };
}
