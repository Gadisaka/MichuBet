/**
 * InOut Games integration config.
 *
 * Values are read from the environment (see `.env.staging` / `.env` on the
 * server). Secrets (`INOUT_SIGNATURE_KEY`) must never be committed.
 *
 * The signature key is required to verify inbound webhook signatures; the
 * operator id + launch base url are required to build launch URLs. We read
 * lazily (via getters) so importing this module never throws at boot — the
 * webhook/launch layers validate presence when they actually need a value.
 *
 * @module Config/inout
 */

export const INOUT_DEFAULT_CURRENCY =
  process.env.INOUT_DEFAULT_CURRENCY || "ETB";

export const INOUT_LAUNCH_BASE_URL =
  process.env.INOUT_LAUNCH_BASE_URL || "https://api.inout.games/api/launch";

export const INOUT_ALIAS = process.env.INOUT_ALIAS || "";

/** @returns {string} Operator ID (UUID) issued by InOut. */
export function getInoutOperatorId() {
  const v = process.env.INOUT_OPERATOR_ID;
  if (!v) {
    throw new Error("INOUT_OPERATOR_ID is not set");
  }
  return v;
}

/** @returns {string} HMAC-SHA256 signature key issued by InOut. */
export function getInoutSignatureKey() {
  const v = process.env.INOUT_SIGNATURE_KEY;
  if (!v) {
    throw new Error("INOUT_SIGNATURE_KEY is not set");
  }
  return v;
}

/**
 * True when the minimal config needed to verify webhooks is present.
 * Used by the webhook middleware to fail closed with a clear message.
 */
export function isInoutWebhookConfigured() {
  return Boolean(process.env.INOUT_SIGNATURE_KEY);
}

/**
 * True when the config needed to build launch URLs is present.
 */
export function isInoutLaunchConfigured() {
  return Boolean(process.env.INOUT_OPERATOR_ID);
}
