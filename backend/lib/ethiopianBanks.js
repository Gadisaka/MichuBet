/**
 * Seeded list of popular Ethiopian banks and mobile wallets for online withdraw.
 * Not admin-CRUD — add/remove here and redeploy.
 *
 * @module lib/ethiopianBanks
 */

export const ETHIOPIAN_BANKS = Object.freeze([
  { code: "cbe", name: "Commercial Bank of Ethiopia", type: "BANK" },
  { code: "awash", name: "Awash Bank", type: "BANK" },
  { code: "dashen", name: "Dashen Bank", type: "BANK" },
  { code: "boa", name: "Bank of Abyssinia", type: "BANK" },
  { code: "wegagen", name: "Wegagen Bank", type: "BANK" },
  { code: "nib", name: "NIB International Bank", type: "BANK" },
  { code: "oromia", name: "Oromia Bank", type: "BANK" },
  { code: "coop", name: "Cooperative Bank of Oromia", type: "BANK" },
  { code: "abay", name: "Abay Bank", type: "BANK" },
  { code: "zemen", name: "Zemen Bank", type: "BANK" },
  { code: "berhan", name: "Berhan Bank", type: "BANK" },
  { code: "hibret", name: "Hibret Bank", type: "BANK" },
  { code: "amhara", name: "Amhara Bank", type: "BANK" },
  { code: "enat", name: "Enat Bank", type: "BANK" },
  { code: "bunna", name: "Bunna Bank", type: "BANK" },
  { code: "telebirr", name: "Telebirr", type: "WALLET" },
  { code: "cbebirr", name: "CBE Birr", type: "WALLET" },
  { code: "mpesa", name: "M-Pesa", type: "WALLET" },
  { code: "amole", name: "Amole", type: "WALLET" },
]);

const BY_CODE = new Map(ETHIOPIAN_BANKS.map((b) => [b.code, b]));

export function getBankByCode(code) {
  if (!code) return null;
  return BY_CODE.get(String(code).trim().toLowerCase()) ?? null;
}

export function isValidBankCode(code) {
  return getBankByCode(code) != null;
}

export function resolveBanks(codes) {
  const list = Array.isArray(codes) ? codes : [];
  const seen = new Set();
  const out = [];
  for (const raw of list) {
    const bank = getBankByCode(raw);
    if (!bank || seen.has(bank.code)) continue;
    seen.add(bank.code);
    out.push(bank);
  }
  return out;
}

export function normalizeBankCodes(codes) {
  return resolveBanks(codes).map((b) => b.code);
}
