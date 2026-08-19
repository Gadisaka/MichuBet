import assert from "node:assert/strict";
import test from "node:test";
import {
  computeOnlineWithdrawFee,
  DEFAULT_ONLINE_WITHDRAW_FEE_PERCENT,
} from "../lib/onlineWithdrawSettings.js";
import {
  getBankByCode,
  isValidBankCode,
  normalizeBankCodes,
} from "../lib/ethiopianBanks.js";

test("10% fee on 100 birr yields 10 fee and 90 net", () => {
  const r = computeOnlineWithdrawFee(100, DEFAULT_ONLINE_WITHDRAW_FEE_PERCENT);
  assert.equal(r.amount, 100);
  assert.equal(r.feeAmount, 10);
  assert.equal(r.netAmount, 90);
});

test("fee rounding uses money decimals", () => {
  const r = computeOnlineWithdrawFee(33.33, 10);
  assert.equal(r.feeAmount, 3.33);
  assert.equal(r.netAmount, 30);
});

test("bank lookup is case-insensitive", () => {
  assert.equal(isValidBankCode("CBE"), true);
  assert.equal(getBankByCode("telebirr")?.type, "WALLET");
  assert.deepEqual(normalizeBankCodes(["cbe", "CBE", "nope"]), ["cbe"]);
});
