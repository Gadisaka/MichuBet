/**
 * Settlement retry job.
 *
 * Scans for Fixtures that are terminal AND have been settled at least
 * once BUT still carry pending legs (`grading_completed_at IS NULL`),
 * and re-runs `settleFixture` on each. This is the safety net that
 * prevents stuck tickets when:
 *
 *   - upstream data for events/stats was missing on the first pass,
 *   - the V2 engine returned `VOID / missing_required_data` for some
 *     legs because enrichment hadn't caught up yet,
 *   - a module threw and was swallowed as `VOID / module_error:*`
 *     (a follow-up module fix + a retry clears the affected legs).
 *
 * Runs on the `settlement-retry` repeatable queue at a cadence set by
 * `SETTLEMENT_RETRY_INTERVAL_MS` (default 5 minutes).
 *
 * Bounded to `SETTLEMENT_RETRY_BATCH` fixtures per tick to keep the
 * worker healthy and Mongo happy.
 *
 * @module jobs/settlementRetry
 */
import prisma from "../Config/db.js";
import { settleFixture } from "../services/ticketSettlementService.js";
import { enrichFixtureResult } from "./enrichFixtureResult.js";
import { logAuditEvent } from "../lib/auditLog.js";
import { recordUnresolvableFixture } from "../lib/settlementMetrics.js";

const DEFAULT_BATCH = Number(process.env.SETTLEMENT_RETRY_BATCH || 50);
// Only retry fixtures whose start_time is within the last N days so we
// don't thrash the DB scanning ancient rows that will never resolve.
const MAX_AGE_DAYS = Number(process.env.SETTLEMENT_RETRY_MAX_AGE_DAYS || 14);
// A terminal fixture still carrying pending legs this many hours after kickoff
// is treated as effectively unresolvable under the active engine (V1 cannot
// grade the market). Surface it as a CRITICAL alert + metric instead of
// retrying it silently forever. Age-based so it survives process restarts —
// no per-fixture attempt counter / schema change needed.
const STUCK_CRITICAL_HOURS = Number(
  process.env.SETTLEMENT_STUCK_CRITICAL_HOURS || 6,
);

/**
 * @returns {Promise<{ scanned: number, retried: number, completed: number, stillPending: number, unresolvable: number }>}
 */
export async function runSettlementRetry() {
  const now = Date.now();
  const minStart = new Date(now - MAX_AGE_DAYS * 24 * 60 * 60 * 1000);
  const criticalAgeMs = STUCK_CRITICAL_HOURS * 60 * 60 * 1000;

  const stuck = await prisma.fixture.findMany({
    where: {
      start_time: { gte: minStart },
      status: {
        in: ["FT", "AET", "PEN", "AWD", "WO", "CANC", "ABD", "PST"],
      },
      OR: [
        // Partial settlement: settled once but legs still pending.
        { settled_at: { not: null }, grading_completed_at: null },
        // Never settled: first attempt crashed before settled_at was written.
        { settled_at: null },
      ],
    },
    select: { id: true, api_fixture_id: true, status: true, start_time: true },
    take: DEFAULT_BATCH,
    orderBy: { start_time: "asc" },
  });

  let retried = 0;
  let completed = 0;
  let stillPending = 0;
  let unresolvable = 0;
  for (const fx of stuck) {
    try {
      // Try to enrich first — if the only reason the leg was pending
      // was missing events/stats, this unblocks the next settleFixture
      // call. Enrichment is a no-op when the env flag is off or the
      // fixture is already enriched.
      await enrichFixtureResult(fx.id).catch(() => {});
      const result = await settleFixture(fx.id, { force: true });
      retried++;
      if (result?.gradingCompleted) {
        completed++;
        continue;
      }
      stillPending++;

      // Retry-loop / unresolvable detection: a terminal fixture that is STILL
      // pending well past kickoff will keep failing every 5 minutes under the
      // active engine. Raise it once per tick as CRITICAL so it can't hide in
      // the retry loop.
      const ageMs = fx.start_time
        ? now - new Date(fx.start_time).getTime()
        : Infinity;
      if (ageMs >= criticalAgeMs) {
        unresolvable++;
        recordUnresolvableFixture();
        console.error(
          `[settlementRetry] SETTLEMENT_STUCK_CRITICAL fixture=${fx.id} ` +
            `api_fixture_id=${fx.api_fixture_id} status=${fx.status} ` +
            `ageHours=${(ageMs / 3_600_000).toFixed(1)} pending=${result?.pendingLegsRemaining ?? "?"} ` +
            `— terminal fixture still has pending legs; likely unresolvable under the active engine`,
        );
        logAuditEvent({
          action: "SETTLEMENT_STUCK_CRITICAL",
          module: "SETTLEMENT",
          entityType: "FIXTURE",
          entityId: fx.id,
          before: null,
          after: {
            apiFixtureId: fx.api_fixture_id,
            status: fx.status,
            ageHours: Number((ageMs / 3_600_000).toFixed(1)),
            pendingLegsRemaining: result?.pendingLegsRemaining ?? null,
            engine: result?.engine ?? null,
          },
        }).catch(() => {});
      }
    } catch (err) {
      stillPending++;
      console.error(
        `[settlementRetry] failed fixture=${fx.id} api_fixture_id=${fx.api_fixture_id}:`,
        err?.message || err,
      );
    }
  }

  console.log(
    `[settlementRetry] scanned=${stuck.length} retried=${retried} completed=${completed} stillPending=${stillPending} unresolvable=${unresolvable}`,
  );
  return {
    scanned: stuck.length,
    retried,
    completed,
    stillPending,
    unresolvable,
  };
}

export default runSettlementRetry;
