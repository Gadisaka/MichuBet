import { normalizeApiFixtureId } from "./fixtureId";
import { getCalendarDayOffset } from "./matchTimeUtils";
import { dayOffsetToTimeId } from "./sportsbookTimeOptions";

export function matchIdFromFixtureId(apiFixtureId) {
  const id = normalizeApiFixtureId(apiFixtureId);
  if (id == null) return null;
  return `fx-${id}`;
}

export function findMatchByFixtureId(allMatches, apiFixtureId) {
  const target = normalizeApiFixtureId(apiFixtureId);
  if (target == null) return null;
  return (
    (allMatches || []).find(
      (m) => normalizeApiFixtureId(m?.apiFixtureId) === target,
    ) ?? null
  );
}

function timeIdFromKickoffAt(kickoffAt) {
  if (!kickoffAt) return null;
  const d = new Date(kickoffAt);
  if (Number.isNaN(d.getTime())) return null;
  const pad = (n) => String(n).padStart(2, "0");
  const uiDate = `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())} ${d.getFullYear()}`;
  const offset = getCalendarDayOffset(uiDate);
  if (offset == null) return null;
  return dayOffsetToTimeId(offset);
}

/**
 * Filter values that make a fixture visible on Home.
 *
 * @param {Record<string, unknown> | null | undefined} match
 * @param {string | null | undefined} kickoffAt
 * @returns {{ sportId?: string, leagueId: string, timeId?: string | null, clubSearch: string }}
 */
export function filtersToRevealMatch(match, kickoffAt) {
  const sportId = match?.sportId ? String(match.sportId) : undefined;
  const timeIdFromMatch =
    match?.date != null ? dayOffsetToTimeId(getCalendarDayOffset(match.date)) : null;
  const timeId = timeIdFromMatch ?? timeIdFromKickoffAt(kickoffAt);

  return {
    sportId,
    leagueId: "all-leagues",
    timeId,
    clubSearch: "",
  };
}
