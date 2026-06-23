import { describe, expect, it } from "vitest";
import {
  eatLocalToUtc,
  getSportsbookAnchorYmd,
  getSportsbookDayOffset,
  getZonedParts,
  sportsbookAnchorAtOffset,
  utcYmdDatesForSportsbookOffset,
} from "./sportsbookDay.js";

/** Mon 2026-06-22 20:00 EAT = Mon 17:00 UTC */
const MON_8PM_EAT = new Date("2026-06-22T17:00:00.000Z");

/** Mon 2026-06-22 18:30 EAT = Mon 15:30 UTC (before 7 PM rollover) */
const MON_630PM_EAT = new Date("2026-06-22T15:30:00.000Z");

/** Tue 2026-06-23 02:00 EAT = Mon 23:00 UTC (still Mon sportsbook day) */
const TUE_2AM_EAT = new Date("2026-06-22T23:00:00.000Z");

/** Tue 2026-06-23 20:00 EAT = Tue 17:00 UTC */
const TUE_8PM_EAT = new Date("2026-06-23T17:00:00.000Z");

/** Tue 2026-06-23 18:59 EAT = Tue 15:59 UTC (last minute of Mon sportsbook day) */
const TUE_659PM_EAT = new Date("2026-06-23T15:59:00.000Z");

/** Tue 2026-06-23 19:00 EAT = Tue 16:00 UTC (first minute of Tue sportsbook day) */
const TUE_7PM_EAT = new Date("2026-06-23T16:00:00.000Z");

/** Tue 2026-06-23 12:00 EAT = Tue 09:00 UTC (midday, still Mon sportsbook day) */
const TUE_NOON_EAT = new Date("2026-06-23T09:00:00.000Z");

describe("sportsbookDay (7 PM → 6:59 PM EAT boundary)", () => {
  it("assigns anchor before 7 PM EAT to previous calendar day", () => {
    expect(getSportsbookAnchorYmd(MON_630PM_EAT)).toBe("2026-06-21");
  });

  it("assigns anchor at/after 7 PM EAT to same calendar day", () => {
    expect(getSportsbookAnchorYmd(MON_8PM_EAT)).toBe("2026-06-22");
    expect(getSportsbookAnchorYmd(TUE_2AM_EAT)).toBe("2026-06-22");
  });

  it("computes offsets from a fixed now (Mon 8 PM EAT)", () => {
    expect(getSportsbookDayOffset(MON_8PM_EAT, MON_8PM_EAT)).toBe(0);
    expect(getSportsbookDayOffset(TUE_2AM_EAT, MON_8PM_EAT)).toBe(0);
    expect(getSportsbookDayOffset(TUE_8PM_EAT, MON_8PM_EAT)).toBe(1);
  });

  it("before 7 PM EAT, same-day evening kickoff is tomorrow tab", () => {
    /** Kickoff Mon 8 PM when now is Mon 6:30 PM EAT */
    const kickoff = MON_8PM_EAT;
    expect(getSportsbookDayOffset(kickoff, MON_630PM_EAT)).toBe(1);
  });

  it("6:59 PM EAT kickoff is still today (last minute of session)", () => {
    expect(getSportsbookAnchorYmd(TUE_659PM_EAT)).toBe("2026-06-22");
    expect(getSportsbookDayOffset(TUE_659PM_EAT, MON_8PM_EAT)).toBe(0);
  });

  it("7:00 PM EAT kickoff starts tomorrow tab", () => {
    expect(getSportsbookAnchorYmd(TUE_7PM_EAT)).toBe("2026-06-23");
    expect(getSportsbookDayOffset(TUE_7PM_EAT, MON_8PM_EAT)).toBe(1);
  });

  it("midday EAT kickoff is included in today (not overnight-only)", () => {
    expect(getSportsbookAnchorYmd(TUE_NOON_EAT)).toBe("2026-06-22");
    expect(getSportsbookDayOffset(TUE_NOON_EAT, MON_8PM_EAT)).toBe(0);
  });

  it("sportsbookAnchorAtOffset advances anchor days", () => {
    expect(sportsbookAnchorAtOffset(0, MON_8PM_EAT)).toBe("2026-06-22");
    expect(sportsbookAnchorAtOffset(1, MON_8PM_EAT)).toBe("2026-06-23");
  });

  it("utcYmdDatesForSportsbookOffset spans two UTC days near boundary", () => {
    const dates = utcYmdDatesForSportsbookOffset(0, MON_8PM_EAT);
    expect(dates).toContain("2026-06-22");
    expect(dates).toContain("2026-06-23");
    expect(dates.length).toBeGreaterThanOrEqual(2);
  });

  it("screenshot scenario: early 24/06 games today, 22:00 tomorrow (23/06 23:00 EAT now)", () => {
    const now = new Date("2026-06-23T20:00:00.000Z"); // 23/06 23:00 EAT
    const early = new Date("2026-06-23T23:00:00.000Z"); // 24/06 02:00 EAT
    const morning = new Date("2026-06-24T02:00:00.000Z"); // 24/06 05:00 EAT
    const evening = new Date("2026-06-24T19:00:00.000Z"); // 24/06 22:00 EAT

    expect(getSportsbookDayOffset(early, now)).toBe(0);
    expect(getSportsbookDayOffset(morning, now)).toBe(0);
    expect(getSportsbookDayOffset(evening, now)).toBe(1);
  });

  it("eatLocalToUtc matches getZonedParts for noon EAT", () => {
    const utc = eatLocalToUtc(2026, 6, 22, 12, 0, 0);
    const parts = getZonedParts(utc);
    expect(parts.year).toBe(2026);
    expect(parts.month).toBe(6);
    expect(parts.day).toBe(22);
    expect(parts.hour).toBe(12);
  });
});
