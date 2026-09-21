/**
 * Print validation should list every started leg so cashiers can drop them.
 *
 * Run: node --test backend/tests/ticketPrintValidation.test.js
 */
import test from "node:test";
import assert from "node:assert/strict";
import { validateOpenTicketForPrint } from "../services/ticketPrintValidation.js";

function makePrisma({ fixtures = [], oddLines = [] }) {
  const markets = [];
  const lines = [];
  for (const row of oddLines) {
    const marketId = `m-${row.fixtureId}-${row.marketName}`;
    if (!markets.some((market) => market.id === marketId)) {
      markets.push({
        id: marketId,
        name: row.marketName,
        fixture_id: row.fixtureId,
      });
    }
    lines.push({
      market_id: marketId,
      odd: row.odd,
      value: row.value,
      market: { name: row.marketName, fixture_id: row.fixtureId },
      bookmaker: row.bookmaker || null,
    });
  }

  return {
    fixture: {
      findMany: async ({ where }) => {
        const ids = where?.api_fixture_id?.in || [];
        return fixtures.filter((f) => ids.includes(f.api_fixture_id));
      },
    },
    fixtureMarket: {
      findMany: async ({ where }) => {
        const fixtureId = where?.fixture_id;
        const names = where?.name?.in || [];
        return markets.filter(
          (market) =>
            market.fixture_id === fixtureId && names.includes(market.name),
        );
      },
    },
    fixtureOddLine: {
      findMany: async ({ where }) => {
        const marketIds = where?.market_id?.in || [];
        const values = where?.value?.in || [];
        return lines
          .filter(
            (row) =>
              marketIds.includes(row.market_id) &&
              (values.length === 0 || values.includes(row.value)),
          )
          .map(({ market_id: _marketId, ...row }) => row);
      },
    },
  };
}

function snapshotLeg(apiFixtureId, odds) {
  return {
    apiFixtureId,
    marketLabel: "Match Winner",
    label: "Home",
    odds,
  };
}

test("validateOpenTicketForPrint asks to remove started legs instead of failing the ticket", async () => {
  const prisma = makePrisma({
    fixtures: [
      {
        id: "fx1",
        api_fixture_id: 11,
        status: "NS",
        start_time: new Date(Date.now() - 60_000),
      },
      {
        id: "fx2",
        api_fixture_id: 22,
        status: "NS",
        start_time: new Date(Date.now() + 60_000),
      },
      {
        id: "fx3",
        api_fixture_id: 33,
        status: "NS",
        start_time: new Date(Date.now() + 120_000),
      },
    ],
    oddLines: [
      {
        fixtureId: "fx1",
        marketName: "Match Winner",
        value: "Home",
        odd: 1.8,
        bookmaker: { api_bookmaker_id: 8 },
      },
      {
        fixtureId: "fx2",
        marketName: "Match Winner",
        value: "Home",
        odd: 1.9,
        bookmaker: { api_bookmaker_id: 8 },
      },
      {
        fixtureId: "fx3",
        marketName: "Match Winner",
        value: "Home",
        odd: 2.1,
        bookmaker: { api_bookmaker_id: 8 },
      },
    ],
  });

  const out = await validateOpenTicketForPrint({
    prismaClient: prisma,
    ticket: {
      id: "ticket-1",
      selection_snapshot: [
        snapshotLeg(11, 1.8),
        snapshotLeg(22, 1.9),
        snapshotLeg(33, 2.1),
      ],
    },
    cashierId: "cashier-1",
  });

  assert.equal(out.ok, false);
  assert.equal(out.statusCode, 409);
  assert.equal(out.body.code, "fixture_started");
  assert.equal(out.body.requiresRemoval, true);
  assert.deepEqual(
    out.body.selections.map((row) => row.index),
    [0],
  );
});
