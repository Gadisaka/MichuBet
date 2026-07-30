import { describe, expect, it } from "vitest";
import {
  formatSelectionDisplayLabel,
  getMarketDisplayName,
  gridColsForMarket,
  resolveExpansionSelectionMeta,
  sortMarketsByPriority,
  sortOddsWithinMarket,
} from "./marketDisplay.js";

describe("getMarketDisplayName", () => {
  it("maps Match Winner aliases to 1X2", () => {
    expect(getMarketDisplayName("Match Winner")).toBe("1X2");
    expect(getMarketDisplayName("Fulltime Result")).toBe("1X2");
    expect(getMarketDisplayName("1X2")).toBe("1X2");
  });

  it("maps BTTS and totals", () => {
    expect(getMarketDisplayName("Both Teams Score")).toBe(
      "BOTH TEAMS TO SCORE",
    );
    expect(getMarketDisplayName("Both Teams to Score")).toBe(
      "BOTH TEAMS TO SCORE",
    );
    expect(getMarketDisplayName("Goals Over/Under")).toBe("TOTAL");
    expect(getMarketDisplayName("Goals Over/Under First Half")).toBe(
      "TOTAL 1ST HALF",
    );
  });

  it("maps Double Chance, HT/FT, Odd/Even and falls back for unknowns", () => {
    expect(getMarketDisplayName("Double Chance")).toBe("DOUBLE CHANCE");
    expect(getMarketDisplayName("HT/FT Double")).toBe("HALFTIME/FULLTIME");
    expect(getMarketDisplayName("Odd/Even")).toBe("ODD/EVEN");
    expect(getMarketDisplayName("Odd/Even - First Half")).toBe(
      "ODD/EVEN 1ST HALF",
    );
    expect(getMarketDisplayName("Corners Over Under")).toBe(
      "Corners Over Under",
    );
  });
});

describe("formatSelectionDisplayLabel", () => {
  const teams = { home: "Arsenal", away: "Chelsea" };

  it("uses team names for 1X2", () => {
    expect(
      formatSelectionDisplayLabel({
        marketName: "Match Winner",
        selectionId: "1",
        ...teams,
      }),
    ).toBe("Arsenal");
    expect(
      formatSelectionDisplayLabel({
        marketName: "Match Winner",
        selectionId: "x",
        ...teams,
      }),
    ).toBe("Draw");
    expect(
      formatSelectionDisplayLabel({
        marketName: "Match Winner",
        selectionId: "2",
        ...teams,
      }),
    ).toBe("Chelsea");
  });

  it("uses Arsenal or Draw style for Double Chance", () => {
    expect(
      formatSelectionDisplayLabel({
        marketName: "Double Chance",
        selectionId: "1x",
        ...teams,
      }),
    ).toBe("Arsenal or Draw");
    expect(
      formatSelectionDisplayLabel({
        marketName: "Double Chance",
        selectionId: "12",
        ...teams,
      }),
    ).toBe("Arsenal or Chelsea");
    expect(
      formatSelectionDisplayLabel({
        marketName: "Double Chance",
        selectionId: "x2",
        ...teams,
      }),
    ).toBe("Draw or Chelsea");
  });

  it("maps Home/Draw API values and compact tokens to team labels", () => {
    expect(
      formatSelectionDisplayLabel({
        marketName: "Double Chance",
        selectionId: "Home/Draw",
        home: "Tianjin Teda",
        away: "Shenyang Urban",
      }),
    ).toBe("Tianjin Teda or Draw");
    expect(
      formatSelectionDisplayLabel({
        marketName: "Double Chance",
        selectionId: "1X",
        home: "Tianjin Teda",
        away: "Shenyang Urban",
      }),
    ).toBe("Tianjin Teda or Draw");
  });

  it("maps HT/FT compound labels to team names", () => {
    expect(
      formatSelectionDisplayLabel({
        marketName: "HT/FT Double",
        selectionId: "Home/Draw",
        home: "Tianjin Teda",
        away: "Shenyang Urban",
      }),
    ).toBe("Tianjin Teda/Draw");
    expect(
      formatSelectionDisplayLabel({
        marketName: "HT/FT Double",
        selectionId: "1/X",
        home: "Tianjin Teda",
        away: "Shenyang Urban",
      }),
    ).toBe("Tianjin Teda/Draw");
    expect(
      formatSelectionDisplayLabel({
        marketName: "HT/FT Double",
        selectionId: "Away/Home",
        home: "Tianjin Teda",
        away: "Shenyang Urban",
      }),
    ).toBe("Shenyang Urban/Tianjin Teda");
  });

  it("leaves other markets as-is", () => {
    expect(
      formatSelectionDisplayLabel({
        marketName: "Goals Over/Under",
        selectionId: "Over 2.5",
        ...teams,
      }),
    ).toBe("Over 2.5");
    expect(
      formatSelectionDisplayLabel({
        marketName: "Both Teams Score",
        selectionId: "Yes",
        ...teams,
      }),
    ).toBe("Yes");
  });
});

describe("sortMarketsByPriority", () => {
  it("orders hero markets like zoran (1X2 → BTTS → DC → TOTAL → HT/FT → Odd/Even)", () => {
    const input = [
      { category: "Odd/Even", odds: [] },
      { category: "Goals Over/Under", odds: [] },
      { category: "Corners Over Under", odds: [] },
      { category: "HT/FT Double", odds: [] },
      { category: "Double Chance", odds: [] },
      { category: "Both Teams Score", odds: [] },
      { category: "Match Winner", odds: [] },
    ];
    expect(sortMarketsByPriority(input).map((c) => c.category)).toEqual([
      "Match Winner",
      "Both Teams Score",
      "Double Chance",
      "Goals Over/Under",
      "HT/FT Double",
      "Odd/Even",
      "Corners Over Under",
    ]);
  });

  it("preserves relative order among non-hero markets", () => {
    const input = [
      { category: "Corners Over Under", odds: [] },
      { category: "Exact Score", odds: [] },
    ];
    expect(sortMarketsByPriority(input).map((c) => c.category)).toEqual([
      "Corners Over Under",
      "Exact Score",
    ]);
  });
});

describe("sortOddsWithinMarket", () => {
  it("sorts Goals Over/Under by threshold descending, Over before Under", () => {
    const odds = [
      { id: "Under 2.5", value: "1.90" },
      { id: "Over 4.5", value: "5.00" },
      { id: "Over 2.5", value: "1.85" },
      { id: "Under 4.5", value: "1.15" },
    ];
    expect(
      sortOddsWithinMarket("Goals Over/Under", odds).map((o) => o.id),
    ).toEqual(["Over 4.5", "Under 4.5", "Over 2.5", "Under 2.5"]);
  });

  it("sorts HT/FT by HT side then FT side (Home → Draw → Away)", () => {
    const odds = [
      { id: "Away/Home", value: "13" },
      { id: "Home/Draw", value: "8" },
      { id: "Home/Home", value: "4" },
      { id: "Draw/Away", value: "11" },
      { id: "Home/Away", value: "9" },
    ];
    expect(sortOddsWithinMarket("HT/FT Double", odds).map((o) => o.id)).toEqual([
      "Home/Home",
      "Home/Draw",
      "Home/Away",
      "Draw/Away",
      "Away/Home",
    ]);
  });

  it("does not reorder non-OU markets", () => {
    const odds = [
      { id: "Yes", value: "1.80" },
      { id: "No", value: "1.95" },
    ];
    expect(sortOddsWithinMarket("Both Teams Score", odds)).toEqual(odds);
  });
});

describe("gridColsForMarket", () => {
  it("returns fixed 3/2 cols and responsive HT/FT", () => {
    expect(gridColsForMarket("Match Winner")).toBe("grid-cols-3");
    expect(gridColsForMarket("Double Chance")).toBe("grid-cols-3");
    expect(gridColsForMarket("Both Teams Score")).toBe("grid-cols-2");
    expect(gridColsForMarket("Goals Over/Under")).toBe("grid-cols-2");
    expect(gridColsForMarket("HT/FT Double")).toBe("grid-cols-2 md:grid-cols-4");
  });
});

describe("resolveExpansionSelectionMeta", () => {
  it("keeps canonical DC tokens and adds displayLabel + marketParams", () => {
    const meta = resolveExpansionSelectionMeta("Double Chance", "1x", {
      home: "Arsenal",
      away: "Chelsea",
    });
    expect(meta.label).toBe("1X");
    expect(meta.displayLabel).toBe("Arsenal or Draw");
    expect(meta.marketCode).toBe("DOUBLE_CHANCE");
    expect(meta.marketParams).toEqual({ combination: "1X" });
  });

  it("keeps canonical 1X2 tokens", () => {
    const meta = resolveExpansionSelectionMeta("Match Winner", "1", {
      home: "Arsenal",
      away: "Chelsea",
    });
    expect(meta.label).toBe("1");
    expect(meta.displayLabel).toBe("Arsenal");
    expect(meta.marketCode).toBe("MATCH_WINNER");
    expect(meta.marketParams).toEqual({ side: "HOME" });
  });

  it("keeps HT/FT placement label and team-aware displayLabel", () => {
    const meta = resolveExpansionSelectionMeta("HT/FT Double", "Home/Draw", {
      home: "Tianjin Teda",
      away: "Shenyang Urban",
    });
    expect(meta.label).toBe("HOME/DRAW");
    expect(meta.displayLabel).toBe("Tianjin Teda/Draw");
  });
});
