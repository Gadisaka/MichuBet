import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import TopHeader from "../components/layout/TopHeader";
import PrimaryNav from "../components/layout/PrimaryNav";
import MobileBottomBar from "../components/layout/MobileBottomBar";
import AppIcon from "../components/common/AppIcon";
import SoftPanel from "../components/common/SoftPanel";
import { topHeaderData, topNavItems } from "../data/homepageData";
import { fetchProfile } from "../services/api";
import { useTranslation } from "../i18n/LanguageContext.jsx";

function MethodCard({ title, hint, onClick }) {
  return (
    <button type="button" onClick={onClick} className="text-left">
      <SoftPanel className="animate-deposit-panel h-full transition hover:ring-(--sb-accent-fill)/40">
        <p className="m-0 text-xs font-extrabold uppercase tracking-[0.18em] text-(--sb-accent-fill)">
          {title}
        </p>
        <p className="mt-2 m-0 text-sm text-[rgba(255,255,255,0.72)]">{hint}</p>
      </SoftPanel>
    </button>
  );
}

function Withdraw() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchProfile();
      } catch (e) {
        if (cancelled) return;
        if (e.message === "NOT_LOGGED_IN") {
          navigate("/login");
          return;
        }
        setPageError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [navigate]);

  return (
    <PageContainer>
      <div className="sticky top-0 z-50">
        <TopHeader data={topHeaderData} />
        <PrimaryNav items={topNavItems} />
      </div>

      <div className="relative mx-auto w-full max-w-lg px-4 pb-28 pt-2 sm:px-5 sm:pt-4">
        <div
          className="pointer-events-none absolute -top-4 left-1/2 h-64 w-[min(100%,28rem)] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(246,175,1,0.14),transparent_68%)] blur-xl"
          aria-hidden
        />

        <header className="relative mb-8 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/profile")}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#111111]/90 text-[#ffffff] shadow-lg shadow-black/20 transition-transform duration-300 hover:scale-105 hover:bg-[#111111] hover:ring-(--sb-accent-fill)/30 active:scale-95"
          >
            <AppIcon name="chevronDown" size={18} className="rotate-90" />
          </button>
          <div>
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.72)]">
              {t("withdraw.chooseMethod")}
            </p>
            <h1 className="m-0 text-2xl font-black tracking-tight text-[#ffffff] sm:text-3xl">
              {t("withdraw.title")}
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-[rgba(255,255,255,0.72)]">
            <div className="relative h-14 w-14">
              <div className="absolute inset-0 animate-ping rounded-full bg-(--sb-accent-fill)/25" />
              <div className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#111111] ring-2 ring-(--sb-accent-fill)/40">
                <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#F6AF01] border-t-(--sb-accent-fill)" />
              </div>
            </div>
            <span className="text-sm font-semibold">{t("withdraw.loading")}</span>
          </div>
        ) : pageError ? (
          <SoftPanel className="animate-deposit-panel ring-red-900/30">
            <p className="m-0 text-sm font-semibold text-[#ff6b6b]">{pageError}</p>
          </SoftPanel>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            <MethodCard
              title={t("withdraw.shopTitle")}
              hint={t("withdraw.shopHint")}
              onClick={() => navigate("/withdraw/shop")}
            />
            <MethodCard
              title={t("withdraw.onlineTitle")}
              hint={t("withdraw.onlineHint")}
              onClick={() => navigate("/withdraw/online")}
            />
          </div>
        )}
      </div>

      <MobileBottomBar
        selections={[]}
        onRemoveSelection={() => {}}
        onClearSelections={() => {}}
      />
      <div className="h-16 lg:hidden" />
    </PageContainer>
  );
}

export default Withdraw;
