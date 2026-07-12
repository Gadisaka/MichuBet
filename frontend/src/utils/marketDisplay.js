import { normalizeMarketName } from "../data/footballMarketsByCategory.js";
import { resolveCompactMarketToken } from "./compactMarketToken.js";

/** Hero market order (API names → priority index). Lower = earlier. */
const MARKET_PRIORITY = [
  "match winner",
  "both teams score",
  "both teams to score",
  "double chance",
  "goals over/under",
];

/** Display headers keyed by normalized API name. */
const DISPLAY_NAMES = {
  "match winner": "1X2",
  "fulltime result": "1X2",
  "full time result": "1X2",
  "1x2": "1X2",
  "match result": "1X2",
  "both teams score": "BOTH TEAMS TO SCORE",
  "both teams to score": "BOTH TEAMS TO SCORE",
  "double chance": "DOUBLE CHANCE",
  "goals over/under": "TOTAL",
  "goals over/under first half": "TOTAL 1ST HALF",
  "goals over/under - second half": "TOTAL 2ND HALF",
};

/**
 * @param {string} apiName
 * @returns {string}
 */
export function getMarketDisplayName(apiName) {
  const key = normalizeMarketName(apiName);
  if (DISPLAY_NAMES[key]) return DISPLAY_NAMES[key];
  return String(apiName || "").trim() || "Market";
}

/**
 * @param {string} marketName
 * @returns {boolean}
 */
function isMatchWinnerMarket(marketName) {
  const key = normalizeMarketName(marketName);
  return (
    key === "match winner" ||
    key === "fulltime result" ||
    key === "full time result" ||
    key === "1x2" ||
    key === "match result"
  );
}

/**
 * @param {string} marketName
 * @returns {boolean}
 */
function isDoubleChanceMarket(marketName) {
  return normalizeMarketName(marketName) === "double chance";
}

/**
 * @param {string} marketName
 * @returns {boolean}
 */
function isBttsMarket(marketName) {
  const key = normalizeMarketName(marketName);
  return key === "both teams score" || key === "both teams to score";
}

/**
 * @param {string} marketName
 * @returns {boolean}
 */
function isGoalsOverUnderMarket(marketName) {
  return normalizeMarketName(marketName) === "goals over/under";
}

/**
 * Team-aware display label for OddsCell / bet slip. Placement still uses the
 * canonical selection token via resolveExpansionSelectionMeta.
 *
 * @param {{
 *   marketName: string,
 *   selectionId: string,
 *   home?: string,
 *   away?: string,
 * }} args
 * @returns {string}
 */
export function formatSelectionDisplayLabel({
  marketName,
  selectionId,
  home = "Home",
  away = "Away",
}) {
  const id = String(selectionId || "")
    .trim()
    .toLowerCase();
  const homeName = String(home || "Home").trim() || "Home";
  const awayName = String(away || "Away").trim() || "Away";

  if (isMatchWinnerMarket(marketName)) {
    if (id === "1") return homeName;
    if (id === "x") return "Draw";
    if (id === "2") return awayName;
  }

  if (isDoubleChanceMarket(marketName)) {
    if (id === "1x") return `${homeName} or Draw`;
    if (id === "12") return `${homeName} or ${awayName}`;
    if (id === "x2") return `Draw or ${awayName}`;
  }

  return String(selectionId || "").trim();
}

/**
 * Stable priority sort: hero markets first, then original relative order.
 *
 * @param {Array<{ category: string, odds?: unknown }>} categories
 * @returns {typeof categories}
 */
export function sortMarketsByPriority(categories) {
  if (!Array.isArray(categories) || categories.length < 2) {
    return Array.isArray(categories) ? [...categories] : [];
  }

  const priorityIndex = new Map(
    MARKET_PRIORITY.map((name, i) => [name, i]),
  );

  return categories
    .map((cat, index) => ({ cat, index }))
    .sort((a, b) => {
      const aKey = normalizeMarketName(a.cat.category);
      const bKey = normalizeMarketName(b.cat.category);
      const aPri = priorityIndex.has(aKey)
        ? priorityIndex.get(aKey)
        : Number.POSITIVE_INFINITY;
      const bPri = priorityIndex.has(bKey)
        ? priorityIndex.get(bKey)
        : Number.POSITIVE_INFINITY;
      if (aPri !== bPri) return aPri - bPri;
      return a.index - b.index;
    })
    .map(({ cat }) => cat);
}

/**
 * Extract Over/Under line threshold from a selection id like "Over 2.5".
 * @param {string} selectionId
 * @returns {number|null}
 */
function parseOuThreshold(selectionId) {
  const m = String(selectionId || "").match(/(\d+(?:\.\d+)?)/);
  if (!m) return null;
  const n = Number.parseFloat(m[1]);
  return Number.isFinite(n) ? n : null;
}

/**
 * @param {string} marketName
 * @param {Array<{ id: string, value: string }>} odds
 * @returns {typeof odds}
 */
export function sortOddsWithinMarket(marketName, odds) {
  if (!Array.isArray(odds) || odds.length < 2) {
    return Array.isArray(odds) ? [...odds] : [];
  }
  if (!isGoalsOverUnderMarket(marketName)) return [...odds];

  return [...odds].sort((a, b) => {
    const aLine = parseOuThreshold(a.id);
    const bLine = parseOuThreshold(b.id);
    if (aLine != null && bLine != null && aLine !== bLine) {
      return bLine - aLine; // higher threshold first (zoran-style)
    }
    if (aLine != null && bLine == null) return -1;
    if (aLine == null && bLine != null) return 1;
    // Same line: Over before Under
    const aOver = /^over/i.test(String(a.id));
    const bOver = /^over/i.test(String(b.id));
    if (aOver !== bOver) return aOver ? -1 : 1;
    return 0;
  });
}

/**
 * Tailwind grid column class for a market's odds grid.
 * @param {string} marketName
 * @returns {string}
 */
export function gridColsForMarket(marketName) {
  if (isMatchWinnerMarket(marketName) || isDoubleChanceMarket(marketName)) {
    return "grid-cols-3";
  }
  if (isBttsMarket(marketName) || isGoalsOverUnderMarket(marketName)) {
    return "grid-cols-2";
  }
  return "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4";
}

/**
 * Placement metadata for an expansion pick. Prefer compact-token resolution for
 * Match Winner / Double Chance so labels stay canonical (1/X/2/1X/12/X2).
 *
 * @param {string} marketName API market.name
 * @param {string} selectionId normalized selection id (e.g. "1x", "over 2.5")
 * @returns {{
 *   marketLabel: string,
 *   label: string,
 *   displayLabel?: string,
 *   marketCode?: string,
 *   marketParams?: object,
 * }}
 */
export function resolveExpansionSelectionMeta(marketName, selectionId, teams = {}) {
  const home = teams.home || "Home";
  const away = teams.away || "Away";
  const displayLabel = formatSelectionDisplayLabel({
    marketName,
    selectionId,
    home,
    away,
  });

  const token = resolveCompactMarketToken(selectionId);
  if (
    token &&
    ((isMatchWinnerMarket(marketName) && token.marketCode === "MATCH_WINNER") ||
      (isDoubleChanceMarket(marketName) &&
        token.marketCode === "DOUBLE_CHANCE"))
  ) {
    return {
      marketLabel: marketName,
      label: token.label,
      displayLabel,
      marketCode: token.marketCode,
      marketParams: token.marketParams,
    };
  }

  return {
    marketLabel: marketName,
    label: String(selectionId || "").trim().toUpperCase(),
    displayLabel,
  };
}
