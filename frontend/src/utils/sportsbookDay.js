/**
 * Fixed sportsbook timezone for homepage day tabs (East Africa, UTC+3, no DST).
 *
 * Sportsbook day = 7:00 PM EAT → 6:59 PM EAT next calendar day (24 hours).
 * Rollover at 7:00 PM EAT.
 */
export const SPORTSBOOK_TIMEZONE = "Africa/Addis_Ababa";

/** Hour (0–23 in EAT) when a new sportsbook day begins (7:00 PM). */
export const SPORTSBOOK_DAY_START_HOUR = 19;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * @param {Date} date
 * @param {string} [tz]
 * @returns {{ year: number, month: number, day: number, hour: number, minute: number, second: number }}
 */
export function getZonedParts(date, tz = SPORTSBOOK_TIMEZONE) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);

  const get = (type) => parts.find((p) => p.type === type)?.value ?? "0";
  let hour = Number.parseInt(get("hour"), 10);
  if (hour === 24) hour = 0;

  return {
    year: Number.parseInt(get("year"), 10),
    month: Number.parseInt(get("month"), 10),
    day: Number.parseInt(get("day"), 10),
    hour,
    minute: Number.parseInt(get("minute"), 10),
    second: Number.parseInt(get("second"), 10),
  };
}

function formatYmd(year, month, day) {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** EAT local civil time → UTC `Date` (EAT is UTC+3, no DST). */
export function eatLocalToUtc(
  year,
  month,
  day,
  hour = 0,
  minute = 0,
  second = 0,
  ms = 0,
) {
  return new Date(
    Date.UTC(year, month - 1, day, hour - 3, minute, second, ms),
  );
}

function ymdToUtcMs(ymd) {
  const [y, m, d] = String(ymd || "")
    .split("-")
    .map(Number);
  if (![y, m, d].every(Number.isFinite)) return NaN;
  return Date.UTC(y, m - 1, d);
}

function addDaysToYmd(ymd, deltaDays) {
  const ms = ymdToUtcMs(ymd);
  if (!Number.isFinite(ms)) return ymd;
  const next = new Date(ms + deltaDays * MS_PER_DAY);
  const p = getZonedParts(next);
  return formatYmd(p.year, p.month, p.day);
}

/**
 * Sportsbook anchor calendar date (`YYYY-MM-DD` in EAT) that owns this instant.
 * Before 7:00 PM EAT the instant belongs to the previous anchor day
 * (session runs 7:00 PM → 6:59 PM next calendar day).
 *
 * @param {Date} instant
 */
export function getSportsbookAnchorYmd(instant) {
  const { year, month, day, hour } = getZonedParts(instant);
  if (hour < SPORTSBOOK_DAY_START_HOUR) {
    return addDaysToYmd(formatYmd(year, month, day), -1);
  }
  return formatYmd(year, month, day);
}

/**
 * Day offset from current sportsbook day: 0 = today, 1 = tomorrow, …
 *
 * @param {Date} instant
 * @param {Date} [now]
 */
export function getSportsbookDayOffset(instant, now = new Date()) {
  const anchor = getSportsbookAnchorYmd(instant);
  const nowAnchor = getSportsbookAnchorYmd(now);
  const diff = Math.round((ymdToUtcMs(anchor) - ymdToUtcMs(nowAnchor)) / MS_PER_DAY);
  return Number.isFinite(diff) ? diff : null;
}

/**
 * Anchor date for sportsbook offset `0..N` relative to `now`.
 *
 * @param {number} offset
 * @param {Date} [now]
 */
export function sportsbookAnchorAtOffset(offset, now = new Date()) {
  return addDaysToYmd(getSportsbookAnchorYmd(now), Number(offset) || 0);
}

/**
 * Representative noon-EAT `Date` for tab labels (weekday / month display).
 *
 * @param {string} anchorYmd
 */
export function dateFromEatAnchorYmd(anchorYmd) {
  const [y, m, d] = String(anchorYmd || "")
    .split("-")
    .map(Number);
  return eatLocalToUtc(y, m, d, 12, 0, 0);
}

/** Weekday index (0=Sun … 6=Sat) for an EAT anchor date. */
export function getEatWeekdayIndex(anchorYmd) {
  return dateFromEatAnchorYmd(anchorYmd).getUTCDay();
}

/**
 * UTC `YYYY-MM-DD` dates to fetch for `/fixtures?date=` for one sportsbook day.
 *
 * @param {number} offset
 * @param {Date} [now]
 * @returns {string[]}
 */
export function utcYmdDatesForSportsbookOffset(offset, now = new Date()) {
  const anchorYmd = sportsbookAnchorAtOffset(offset, now);
  const [y, m, d] = anchorYmd.split("-").map(Number);
  const nextAnchor = addDaysToYmd(anchorYmd, 1);
  const [y2, m2, d2] = nextAnchor.split("-").map(Number);
  const windowStart = eatLocalToUtc(y, m, d, SPORTSBOOK_DAY_START_HOUR, 0, 0);
  const windowEnd = eatLocalToUtc(y2, m2, d2, SPORTSBOOK_DAY_START_HOUR, 0, 0);

  const dates = new Set();
  for (let t = windowStart.getTime(); t < windowEnd.getTime(); t += 60 * 60 * 1000) {
    dates.add(new Date(t).toISOString().slice(0, 10));
  }
  return [...dates].sort();
}

/**
 * All UTC dates needed for sportsbook offsets `0 .. maxOffset` inclusive.
 *
 * @param {number} maxOffset
 * @param {Date} [now]
 */
export function utcYmdDatesForSportsbookOffsets(maxOffset, now = new Date()) {
  const dates = new Set();
  const limit = Math.max(0, Number(maxOffset) || 0);
  for (let off = 0; off <= limit; off += 1) {
    for (const ymd of utcYmdDatesForSportsbookOffset(off, now)) {
      dates.add(ymd);
    }
  }
  return [...dates].sort();
}
