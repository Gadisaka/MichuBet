import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppIcon from "../common/AppIcon";
import MobileBetSlip from "../sections/MobileBetSlip";
import MobileLeaguesSheet from "../sections/MobileLeaguesSheet";
import MobileMenu from "./MobileMenu";
import { usePlatformSettings } from "../../hooks/usePlatformSettings";
import { slipHasExpiredSelection } from "../../utils/selectionExpiry";
import {
  coerceStakeDisplayToLimits,
  parseStakeNumeric,
  stakeBoundsInvalid,
} from "../../utils/stakeLimits";
import { slipGrossTaxNet } from "../../utils/winningsTax";
import { useTranslation } from "../../i18n/LanguageContext.jsx";

const navItems = [
  { id: "leagues", icon: "trophy" },
  { id: "live", icon: "radio" },
  { id: "menu", icon: "menu" },
  { id: "games", icon: "gamepad" },
  { id: "deposit", icon: "banknote" },
];

function MobileBottomBar({
  selections = [],
  onRemoveSelection = () => {},
  onClearSelections = () => {},
  onReplaceSelections = () => {},
  leaguesSidebarProps = null,
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [slipOpen, setSlipOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [leaguesOpen, setLeaguesOpen] = useState(false);
  const [stakeInput, setStakeInput] = useState("20");
  const { limits, winningsTax } = usePlatformSettings();

  useEffect(() => {
    if (!limits) return;
    setStakeInput((prev) => coerceStakeDisplayToLimits(prev, limits));
  }, [limits?.MIN_BET_AMOUNT, limits?.MAX_BET_AMOUNT]);

  const mobileLeaguesSidebarProps = useMemo(() => {
    if (!leaguesSidebarProps) return null;
    const { onSelectLeague } = leaguesSidebarProps;
    return {
      ...leaguesSidebarProps,
      onSelectLeague: (id) => {
        onSelectLeague?.(id);
        setLeaguesOpen(false);
      },
    };
  }, [leaguesSidebarProps, setLeaguesOpen]);
  const safeSelections = Array.isArray(selections) ? selections : [];
  const hasSelections = safeSelections.length > 0;

  const hasExpiredSelection = slipHasExpiredSelection(safeSelections);
  const totalOddsProduct =
    safeSelections.length && !hasExpiredSelection
      ? safeSelections.reduce((acc, s) => acc * parseFloat(s.value), 1)
      : null;
  const totalOddsDisplay =
    safeSelections.length === 0
      ? "0.00"
      : hasExpiredSelection
        ? "—"
        : totalOddsProduct != null && Number.isFinite(totalOddsProduct)
          ? totalOddsProduct.toFixed(2)
          : "0.00";

  const stakeNum = parseStakeNumeric(stakeInput) ?? 0;
  const stakeSummaryInvalid = stakeBoundsInvalid(limits, stakeInput);
  const possibleWin =
    totalOddsProduct != null && Number.isFinite(totalOddsProduct)
      ? (stakeNum * totalOddsProduct).toFixed(2)
      : "—";
  const { netWin: netWinFormatted } = slipGrossTaxNet(possibleWin, winningsTax);

  const [, bumpAuth] = useState(0);
  useEffect(() => {
    const onSession = () => bumpAuth((n) => n + 1);
    window.addEventListener("authSessionUpdated", onSession);
    return () => window.removeEventListener("authSessionUpdated", onSession);
  }, []);

  const token =
    localStorage.getItem("token") || sessionStorage.getItem("token");
  const isLoggedIn = !!token;

  const visibleNavItems = useMemo(
    () =>
      isLoggedIn
        ? navItems
        : navItems.filter((item) => item.id !== "menu" && item.id !== "deposit"),
    [isLoggedIn],
  );

  const bottomNav = (
    <nav className="fixed inset-x-0 bottom-0 z-50 flex items-stretch justify-around border-t border-t-[#1b2842] bg-[#091025] lg:hidden">
      {visibleNavItems.map((item) => (
        <button
          key={item.id}
          type="button"
          aria-label={
            item.id === "deposit" ? t("mobileBar.deposit") : undefined
          }
          onClick={() => {
            if (item.id === "menu") setMenuOpen(true);
            if (item.id === "live") navigate("/live");
            if (item.id === "deposit") navigate("/deposit");
            if (item.id === "leagues") {
              if (leaguesSidebarProps) setLeaguesOpen(true);
              else navigate("/");
            }
          }}
          className={`flex flex-1 cursor-pointer flex-col items-center justify-center gap-1 border-0 bg-transparent py-2.5 text-[10px] font-bold ${
            item.id === "menu"
              ? "relative -mt-8 rounded-full"
              : "text-[#ced7ee]"
          }`}
        >
          {item.id === "menu" ? (
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-(--sb-accent-fill) text-[#101012]">
              <AppIcon name={item.icon} size={22} strokeWidth={2.5} />
            </span>
          ) : (
            <AppIcon
              name={item.icon}
              size={20}
              strokeWidth={1.8}
              className="text-[#ced7ee]"
            />
          )}
          {item.id === "deposit" ? null : (
            <span
              className={
                item.id === "menu" ? "text-(--sb-accent-text-muted)" : ""
              }
            >
              {t(`mobileBar.${item.id}`)}
            </span>
          )}
        </button>
      ))}
    </nav>
  );

  return (
    <>
      <MobileBetSlip
        open={slipOpen}
        onClose={() => setSlipOpen(false)}
        selections={safeSelections}
        onRemoveSelection={onRemoveSelection}
        onClearSelections={onClearSelections}
        onReplaceSelections={onReplaceSelections}
        stakeInput={stakeInput}
        onStakeInputChange={setStakeInput}
        limits={limits}
        winningsTax={winningsTax}
      />
      <MobileLeaguesSheet
        open={leaguesOpen}
        onClose={() => setLeaguesOpen(false)}
        sidebarProps={mobileLeaguesSidebarProps}
      />
      {isLoggedIn && (
        <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} />
      )}
      {hasSelections && (
        <div className="fixed inset-x-0 bottom-20 z-55 px-3 lg:hidden">
          <button
            type="button"
            onClick={() => setSlipOpen((p) => !p)}
            className={`flex w-full cursor-pointer items-center justify-between rounded-2xl border bg-[#091025] px-4 py-2.5 text-[#e9eef9] shadow-[0_0_0_1px_rgba(56,203,191,0.35),0_10px_24px_rgba(56,203,191,0.42)] ${
              stakeSummaryInvalid
                ? "border-[#991b1b]/70 ring-1 ring-[#b91c1c]/40"
                : "border-[#1b3231]"
            }`}
          >
            <div className="flex min-w-0 items-center gap-3">
              <span className="text-sm font-bold">
                {t("mobileBar.betSlip")} ({safeSelections.length})
              </span>
              <span className="text-sm font-extrabold text-(--sb-accent-text-muted)">
                {totalOddsDisplay}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-right text-xs font-bold leading-tight text-(--sb-accent-text-muted) tabular-nums">
                ETB{" "}
                <span className="text-[13px] text-[#e9eef9]">
                  {netWinFormatted}
                </span>
              </span>
              <AppIcon
                name={slipOpen ? "chevronDown" : "chevronUp"}
                size={18}
                strokeWidth={2.5}
              />
            </div>
          </button>
        </div>
      )}
      {bottomNav}
      <div className={hasSelections ? "h-32 lg:hidden" : "h-16 lg:hidden"} />
    </>
  );
}

export default MobileBottomBar;
