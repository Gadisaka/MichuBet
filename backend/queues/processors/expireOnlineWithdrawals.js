/**
 * Processor for the `expire-online-withdrawals` queue.
 *
 * @module queues/processors/expireOnlineWithdrawals
 */
import { runExpireOnlineWithdrawals } from "../../jobs/expireOnlineWithdrawals.js";

export async function processExpireOnlineWithdrawals(job) {
  const result = await runExpireOnlineWithdrawals();
  return { job: job.name, ...result };
}
