import prisma from "../Config/db.js";

/** Matches list summary + frontend `MAIN_MARKET_NAMES` (non–“extra” markets). */
export const EXTRA_MARKETS_SUMMARY_NAMES = ["Match Winner", "Double Chance"];

function normalizeSelectionLabel(value) {
  const raw = String(value || "")
    .trim()
    .toLowerCase();
  if (["home", "1"].includes(raw)) return "1";
  if (["draw", "x"].includes(raw)) return "x";
  if (["away", "2"].includes(raw)) return "2";
  if (["1x", "home/draw", "home or draw"].includes(raw)) return "1x";
  if (["12", "home/away", "home or away"].includes(raw)) return "12";
  if (["x2", "draw/away", "draw or away"].includes(raw)) return "x2";
  return String(value || "").trim();
}

function countOddCellsInMarket(oddLines = []) {
  const seen = new Set();
  let count = 0;
  for (const line of oddLines) {
    const id = normalizeSelectionLabel(line?.value);
    const odd = Number.parseFloat(line?.odd);
    if (!id || !Number.isFinite(odd)) continue;
    const key = id.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    count += 1;
  }
  return count;
}

async function countAvailableOddCellsForFixture(fixtureId) {
  const markets = await prisma.fixtureMarket.findMany({
    where: {
      fixture_id: fixtureId,
      odd_lines: { some: {} },
    },
    include: { odd_lines: true },
  });

  return markets.reduce(
    (sum, market) => sum + countOddCellsInMarket(market.odd_lines),
    0,
  );
}

/**
 * Count of fixture markets other than MW/DC that have at least one odd line
 * (any bookmaker). Updated whenever odds rows change for that fixture.
 */
export async function recomputeExtraMarketsCountForFixture(fixtureId) {
  const [extraMarkets, oddCells] = await Promise.all([
    prisma.fixtureMarket.count({
      where: {
        fixture_id: fixtureId,
        name: { notIn: EXTRA_MARKETS_SUMMARY_NAMES },
        odd_lines: { some: {} },
      },
    }),
    countAvailableOddCellsForFixture(fixtureId),
  ]);

  await prisma.fixture.update({
    where: { id: fixtureId },
    data: {
      extra_markets_count: extraMarkets,
      available_odd_cells_count: oddCells,
    },
  });
  return extraMarkets;
}
