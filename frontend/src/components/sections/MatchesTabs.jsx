import AppIcon from "../common/AppIcon";
import LogoImg from "../common/LogoImg";

import { useTranslation } from "../../i18n/LanguageContext.jsx";
import { timeOptionDisplayLabel } from "../../i18n/coreTranslations.js";

function MatchesTabs({
  sports = [],
  times = [],
  leagues = [],
  selectedSportId,
  selectedTimeId,
  selectedLeagueId,
  onSportChange,
  onTimeChange,
  onLeagueChange,
  searchQuery = "",
  onSearchChange,
}) {
  const { t } = useTranslation();
  return (
    <section className="animate-deposit-panel overflow-hidden rounded-[1.15rem] bg-gradient-to-br from-[#1f2038]/90 via-[#0f172b]/95 to-[#090f1f]/92 ring-1 ring-[#3d3f5c]/40 shadow-[0_12px_28px_-12px_rgba(0,0,0,0.4)] backdrop-blur-sm">
      {/* <PillToggle
        options={tabs}
        className="w-full border-b border-[#1b2842] p-1.5"
        optionClassName="flex-1 bg-[#2d3347] px-3 py-1.5 text-[11px]"
        activeOptionClassName="bg-(--sb-accent-fill) text-[#16081a]"
        inactiveOptionClassName="bg-[#2d3347] text-[#c8d1ea]"
      /> */}

      <div className="border-b border-[#2a3754]/55 px-2 py-1.5">
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap text-[11px] font-semibold text-[#b7c2df]">
          {sports.map((sport) => (
            <button
              key={sport.id}
              type="button"
              onClick={() => onSportChange?.(sport.id)}
              className={`flex cursor-pointer items-center gap-1 rounded-full border px-2 py-1 transition-all duration-200 ${
                sport.id === selectedSportId
                  ? "border-(--sb-accent-border) bg-(--sb-accent-surface) text-(--sb-accent-text-on-dark) shadow-[0_6px_16px_-6px_rgba(79,220,204,0.35)]"
                  : "border-[#2f3f55]/80 bg-[#101020]/55 text-[#afbbd8] hover:border-[#5fe3d6]/25"
              }`}
            >
              <AppIcon name={sport.icon} size={11} />
              <span>{sport.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-[#2a3754]/55 px-2 py-1.5">
        <div className="flex items-center gap-1.5 overflow-x-auto whitespace-nowrap text-[11px] font-bold md:gap-1 md:text-[10px]">
          {times.map((time) => (
            <button
              key={time.id}
              type="button"
              onClick={() => onTimeChange?.(time.id)}
              className={`h-8 min-h-[32px] cursor-pointer rounded-xl border px-3 transition-all duration-200 md:h-6 md:min-h-0 md:px-2.5 ${
                time.id === selectedTimeId
                  ? "border-(--sb-accent-border) bg-(--sb-accent-surface-alt) text-(--sb-accent-text-on-dark) shadow-[0_6px_16px_-6px_rgba(79,220,204,0.3)]"
                  : "border-[#2f3f55]/80 bg-[#101020]/50 text-[#8f9dbf] hover:border-[#5fe3d6]/22"
              }`}
            >
              {timeOptionDisplayLabel(time, t)}
            </button>
          ))}
        </div>
      </div>

      <div className="border-b border-[#2a3754]/55 px-2 py-1.5">
        <div className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-[10px] font-semibold">
          {leagues.map((league) => (
            <button
              key={league.id}
              type="button"
              onClick={() => onLeagueChange?.(league.id)}
              className={`flex h-6 cursor-pointer items-center gap-1 rounded-xl border px-2.5 transition-all duration-200 ${
                league.id === selectedLeagueId
                  ? "border-(--sb-accent-border) bg-(--sb-accent-surface) text-(--sb-accent-text-on-dark) shadow-[0_4px_12px_-4px_rgba(79,220,204,0.28)]"
                  : "border-[#2f3f55]/80 bg-[#101020]/50 text-[#9aa7c6] hover:border-[#5fe3d6]/22"
              }`}
            >
              {league.countryFlag ? (
                <LogoImg src={league.countryFlag} alt="" size={14} rounded="rounded-[2px]" />
              ) : null}
              {league.logo ? (
                <LogoImg src={league.logo} alt="" size={14} className="max-h-[14px]" />
              ) : null}
              <span className="truncate">{league.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="p-2">
        <div className="flex h-9 items-center rounded-2xl border border-[#2f3f55]/70 bg-[#101020]/55 px-3 text-[#7f8dad] shadow-inner shadow-black/20 ring-1 ring-[#34354f]/30">
          <AppIcon name="search" size={13} className="mr-2 shrink-0" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => onSearchChange?.(e.target.value)}
            placeholder={t("sidebar.searchClubsPlaceholder")}
            className="min-w-0 flex-1 border-0 bg-transparent text-[12px] font-semibold text-[#dce2f0] placeholder:text-[#6d7a9b] outline-none"
            aria-label={t("sidebar.searchClubsAria")}
          />
          {searchQuery ? (
            <button
              type="button"
              className="ml-1 shrink-0 text-[10px] font-bold uppercase text-(--sb-accent)"
              onClick={() => onSearchChange?.("")}
            >
              {t("common.clear")}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export default MatchesTabs;
