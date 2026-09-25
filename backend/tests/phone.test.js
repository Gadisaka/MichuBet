/**
 * Run: node --test backend/tests/phone.test.js
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizeEthiopiaPhone, normalizePhoneOrNull } from "../lib/phone.js";

const CANON_9 = "251911223344";
const CANON_7 = "251700112233";

test("all 09-prefixed formats collapse to one canonical number", () => {
  for (const input of [
    "0911223344",
    "+251911223344",
    "251911223344",
    "911223344",
  ]) {
    assert.equal(normalizeEthiopiaPhone(input), CANON_9, `input: ${input}`);
  }
});

test("all 07-prefixed formats collapse to one canonical number", () => {
  for (const input of [
    "0700112233",
    "+251700112233",
    "251700112233",
    "700112233",
  ]) {
    assert.equal(normalizeEthiopiaPhone(input), CANON_7, `input: ${input}`);
  }
});

test("the reported bug case: local and international forms are equal", () => {
  assert.equal(
    normalizeEthiopiaPhone("0911223344"),
    normalizeEthiopiaPhone("+251911223344"),
  );
});

test("shop withdraw accepts 09 and 251 as the same phone", () => {
  const local = "0912345678";
  const international = "251912345678";
  assert.equal(normalizeEthiopiaPhone(local), "251912345678");
  assert.equal(normalizeEthiopiaPhone(international), "251912345678");
  // Stored 09 vs typed 251, and the reverse, both match.
  assert.equal(normalizeEthiopiaPhone(local), normalizeEthiopiaPhone(international));
});

test("whitespace and punctuation are stripped", () => {
  assert.equal(normalizeEthiopiaPhone("09 11 22 33 44"), CANON_9);
  assert.equal(normalizeEthiopiaPhone(" +251-911-22-33-44 "), CANON_9);
  assert.equal(normalizeEthiopiaPhone("(0911) 223344"), CANON_9);
});

test("normalizeEthiopiaPhone returns empty string for blank input", () => {
  assert.equal(normalizeEthiopiaPhone(""), "");
  assert.equal(normalizeEthiopiaPhone(null), "");
  assert.equal(normalizeEthiopiaPhone(undefined), "");
});

test("normalizePhoneOrNull returns null for empty/blank input", () => {
  assert.equal(normalizePhoneOrNull(""), null);
  assert.equal(normalizePhoneOrNull("   "), null);
  assert.equal(normalizePhoneOrNull(null), null);
  assert.equal(normalizePhoneOrNull(undefined), null);
});

test("normalizePhoneOrNull returns canonical digits for a valid value", () => {
  assert.equal(normalizePhoneOrNull("0911223344"), CANON_9);
  assert.equal(normalizePhoneOrNull("+251700112233"), CANON_7);
});
