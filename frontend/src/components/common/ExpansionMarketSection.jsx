import { useState } from "react";
import AppIcon from "./AppIcon";
import OddsCell from "./OddsCell";
import {
  getMarketDisplayName,
  gridColsForMarket,
  resolveExpansionSelectionMeta,
} from "../../utils/marketDisplay";

/** Markets with more than this many selections render as collapsible (initially closed). */
const ODDS_EXPAND_THRESHOLD = 3;

function OddsGrid({
  marketLabel,
  odds,
  matchName,
  apiFixtureId,
  kickoffAt,
  matchStatus,
  fromLive,
  home,
  away,
  onOddsClick,
  selectedOdds,
}) {
  const gridClass = gridColsForMarket(marketLabel);

  return (
    <div className={`grid gap-1.5 p-2 ${gridClass}`}>
      {odds.map((odd) => {
        const selectionId = `${matchName}-${marketLabel}-${odd.id}`;
        const meta = resolveExpansionSelectionMeta(marketLabel, odd.id, {
          home,
          away,
        });
        return (
          <OddsCell
            key={`${marketLabel}-${odd.id}`}
            label={meta.displayLabel || meta.label}
            value={odd.value}
            layout="stacked"
            selected={selectedOdds?.has(selectionId)}
            onClick={() =>
              onOddsClick?.({
                id: selectionId,
                apiFixtureId,
                matchName,
                marketLabel: meta.marketLabel,
                label: meta.label,
                displayLabel: meta.displayLabel,
                marketCode: meta.marketCode,
                marketParams: meta.marketParams,
                value: odd.value,
                kickoffAt,
                matchStatus,
                fromLive,
              })
            }
            className="min-h-[44px]"
          />
        );
      })}
    </div>
  );
}

/**
 * @param {{
 *   marketLabel: string,
 *   displayMarketLabel?: string,
 *   odds: Array<{ id: string, value: string }>,
 *   matchName: string,
 *   apiFixtureId: unknown,
 *   kickoffAt: string | null,
 *   matchStatus: unknown,
 *   fromLive: boolean,
 *   home?: string,
 *   away?: string,
 *   onOddsClick?: (payload: Record<string, unknown>) => void,
 *   selectedOdds?: Set<string>,
 * }} props
 */
function ExpansionMarketSection({
  marketLabel,
  displayMarketLabel,
  odds,
  matchName,
  apiFixtureId,
  kickoffAt,
  matchStatus,
  fromLive,
  home,
  away,
  onOddsClick,
  selectedOdds,
}) {
  const collapsible = odds.length > ODDS_EXPAND_THRESHOLD;
  const [open, setOpen] = useState(false);
  const headerLabel =
    displayMarketLabel || getMarketDisplayName(marketLabel);

  const gridProps = {
    marketLabel,
    odds,
    matchName,
    apiFixtureId,
    kickoffAt,
    matchStatus,
    fromLive,
    home,
    away,
    onOddsClick,
    selectedOdds,
  };

  if (!collapsible) {
    return (
      <section className="overflow-hidden rounded-xl bg-[#0a0a0a]/45 ">
        <header className="border-b border-white/8 px-3 py-2 text-xs font-bold uppercase tracking-wide text-[#d6daea]">
          {headerLabel}
        </header>
        <OddsGrid {...gridProps} />
      </section>
    );
  }

  return (
    <section className="overflow-hidden rounded-xl bg-[#0a0a0a]/45 ">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="flex w-full cursor-pointer items-center justify-between gap-2 border-0 bg-transparent px-3 py-2 text-left transition-colors hover:bg-[#0a0a0a]/55"
      >
        <span className="text-xs font-bold uppercase tracking-wide text-[#d6daea]">
          {headerLabel}
        </span>
        <span className="flex shrink-0 items-center gap-1.5">
          <span className="text-[10px] font-semibold tabular-nums text-[#7f89a4]">
            {odds.length}
          </span>
          <AppIcon
            name={open ? "chevronUp" : "chevronDown"}
            size={14}
            strokeWidth={2.5}
            className="text-[rgba(255,255,255,0.72)]"
          />
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ease-in-out ${
          open ? "max-h-[4000px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <OddsGrid {...gridProps} />
      </div>
    </section>
  );
}

export default ExpansionMarketSection;
