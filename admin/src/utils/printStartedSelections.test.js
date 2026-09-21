/**
 * Run: node --test admin/src/utils/printStartedSelections.test.js
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  remainingCountAfterStartedRemoval,
  selectionIdsForPrintIndexes,
} from "./printStartedSelections.js";

describe("selectionIdsForPrintIndexes", () => {
  const ticket = {
    selections: [
      { id: "sel-a" },
      { id: "sel-b" },
      { id: "sel-c" },
    ],
  };

  it("maps started print indexes to selection ids", () => {
    assert.deepEqual(
      selectionIdsForPrintIndexes(ticket, [{ index: 0 }, { index: 2 }]),
      ["sel-a", "sel-c"],
    );
  });

  it("leaves remaining printable legs after one expired game", () => {
    assert.equal(
      remainingCountAfterStartedRemoval(ticket, [{ index: 1 }]),
      2,
    );
  });
});
