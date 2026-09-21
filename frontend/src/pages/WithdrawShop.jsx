import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import PageContainer from "../components/layout/PageContainer";
import TopHeader from "../components/layout/TopHeader";
import PrimaryNav from "../components/layout/PrimaryNav";
import MobileBottomBar from "../components/layout/MobileBottomBar";
import AppIcon from "../components/common/AppIcon";
import SoftPanel from "../components/common/SoftPanel";
import {
  accountInputCls,
  accountPrimaryBtn,
} from "../components/common/accountFormClasses";
import { topHeaderData, topNavItems } from "../data/homepageData";
import {
  createPlayerShopWithdraw,
  fetchPlayerWallet,
  fetchProfile,
} from "../services/api";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { useTranslation } from "../i18n/LanguageContext.jsx";

function withdrawFormError(t, limits, amount, { balance, withdrawable }) {
  if (!Number.isFinite(amount) || amount <= 0) {
    return t("withdraw.invalidAmount");
  }
  if (withdrawable != null && amount > withdrawable) {
    return `${t("withdraw.exceedsWithdrawable")} ${Number(withdrawable).toLocaleString()} ETB`;
  }
  if (balance != null && amount > balance) {
    return t("withdraw.exceedsBalance");
  }
  const minW = limits?.MIN_WITHDRAW;
  const maxW = limits?.MAX_WITHDRAW;
  if (minW != null && Number.isFinite(minW) && amount < minW) {
    return `${t("withdraw.min")} ${minW} ETB`;
  }
  if (maxW != null && Number.isFinite(maxW) && amount > maxW) {
    return `${t("withdraw.max")} ${maxW} ETB`;
  }
  return "";
}

function WithdrawShop() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { limits } = usePlatformSettings();
  const minW =
    limits?.MIN_WITHDRAW != null && Number.isFinite(limits.MIN_WITHDRAW)
      ? limits.MIN_WITHDRAW
      : null;
  const maxW =
    limits?.MAX_WITHDRAW != null && Number.isFinite(limits.MAX_WITHDRAW)
      ? limits.MAX_WITHDRAW
      : null;

  const [balance, setBalance] = useState(null);
  const [withdrawable, setWithdrawable] = useState(null);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [formError, setFormError] = useState("");
  const [result, setResult] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchProfile();
        const wallet = await fetchPlayerWallet();
        if (cancelled) return;
        setBalance(wallet === null ? null : Number(wallet.balance ?? 0));
        setWithdrawable(
          wallet === null ? null : Number(wallet.withdrawable ?? 0),
        );
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

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError("");
    setResult(null);
    const err = withdrawFormError(t, limits, Number(amount), {
      balance,
      withdrawable,
    });
    if (err) {
      setFormError(err);
      return;
    }

    setSubmitting(true);
    try {
      const data = await createPlayerShopWithdraw(Number(amount));
      setResult({
        code: data.code,
        expiresAt: data.expiresAt,
        amount: data.amount ?? Number(amount),
      });
      setAmount("");
      const wallet = await fetchPlayerWallet();
      if (wallet) {
        setBalance(Number(wallet.balance ?? 0));
        setWithdrawable(Number(wallet.withdrawable ?? 0));
      }
    } catch (err) {
      setFormError(err.message || t("withdraw.somethingWrong"));
    } finally {
      setSubmitting(false);
    }
  }

  async function copyCode() {
    if (!result?.code) return;
    try {
      await navigator.clipboard.writeText(result.code);
    } catch {
      /* ignore */
    }
  }

  const limitHint =
    minW != null || maxW != null
      ? `${t("withdraw.range")}${minW != null ? ` · ${t("withdraw.limitMin")} ${minW}` : ""}${maxW != null ? ` · ${t("withdraw.limitMax")} ${maxW}` : ""} ETB`
      : null;

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
            onClick={() => navigate("/withdraw")}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#111111]/90 text-[#ffffff] shadow-lg shadow-black/20 transition-transform duration-300 hover:scale-105 hover:bg-[#111111] hover:ring-(--sb-accent-fill)/30 active:scale-95"
          >
            <AppIcon name="chevronDown" size={18} className="rotate-90" />
          </button>
          <div>
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.72)]">
              {t("withdraw.shopEyebrow")}
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
            <p className="m-0 text-sm font-semibold text-[#ff6b6b]">
              {pageError}
            </p>
          </SoftPanel>
        ) : (
          <div className="flex flex-col gap-4">
            <SoftPanel className="animate-deposit-panel">
              <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.72)]">
                {t("withdraw.balance")}
              </p>
              <p className="m-0 text-center text-3xl font-black tabular-nums text-(--sb-positive) sm:text-4xl">
                {balance === null ? "—" : `${balance.toLocaleString()} ETB`}
              </p>
              <p className="mt-3 m-0 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.72)]">
                {t("withdraw.withdrawable")}
              </p>
              <p className="m-0 text-center text-xl font-black tabular-nums text-[#ffffff] sm:text-2xl">
                {withdrawable === null
                  ? "—"
                  : `${withdrawable.toLocaleString()} ETB`}
              </p>
              <p className="mt-2 m-0 text-center text-[11px] leading-relaxed text-[rgba(255,255,255,0.5)]">
                {t("withdraw.winningsOnly")}
              </p>
            </SoftPanel>

            <form onSubmit={handleSubmit} className="animate-deposit-panel">
              <SoftPanel>
                <label className="block">
                  <span className="mb-2 block text-center text-xs font-extrabold uppercase tracking-[0.15em] text-[rgba(255,255,255,0.72)]">
                    {t("withdraw.amount")}
                  </span>
                  {limitHint ? (
                    <p className="mb-3 text-center text-[11px] text-[rgba(255,255,255,0.5)]">
                      {limitHint}
                    </p>
                  ) : null}
                  <div className="relative">
                    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[rgba(255,255,255,0.5)]">
                      Br
                    </span>
                    <input
                      type="number"
                      min={minW != null ? minW : 1}
                      max={maxW != null ? maxW : undefined}
                      step="any"
                      value={amount}
                      onChange={(ev) => {
                        setAmount(ev.target.value);
                        setFormError("");
                      }}
                      required
                      className={`${accountInputCls} pl-12 text-2xl tracking-tight`}
                      placeholder="0"
                    />
                  </div>
                </label>

                {formError ? (
                  <p className="mt-4 text-center text-sm font-semibold text-[#ff6b6b]">
                    {formError}
                  </p>
                ) : null}

                <button
                  type="submit"
                  disabled={submitting}
                  className={`${accountPrimaryBtn} mt-6`}
                >
                  {submitting
                    ? t("withdraw.generatingCode")
                    : t("withdraw.getCode")}
                </button>
              </SoftPanel>
            </form>

            {result ? (
              <SoftPanel
                className="animate-deposit-panel ring-[#3f7f5f]/35"
                style={{
                  background:
                    "linear-gradient(145deg, rgba(15,74,69,0.55) 0%, rgba(24,24,42,0.96) 42%, rgba(18,18,31,0.98) 100%)",
                }}
              >
                <p className="m-0 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[#86efac]">
                  {t("withdraw.codeTitle")}
                </p>
                <p className="mt-4 text-center font-mono text-3xl font-black tracking-[0.2em] text-[#ffffff] sm:text-4xl sm:tracking-[0.25em]">
                  {result.code}
                </p>
                <p className="mt-3 text-center text-sm text-[rgba(255,255,255,0.72)]">
                  {t("withdraw.amount")}:{" "}
                  <span className="font-bold text-[#ffffff]">
                    {Number(result.amount).toLocaleString()} ETB
                  </span>
                </p>
                {result.expiresAt ? (
                  <p className="mt-2 text-center text-xs text-[rgba(255,255,255,0.72)]">
                    {t("withdraw.expiresAt")}:{" "}
                    {new Date(result.expiresAt).toLocaleString()}
                  </p>
                ) : null}
                <button
                  type="button"
                  onClick={copyCode}
                  className="mt-6 w-full rounded-2xl bg-[#0a0a0a]/50 py-3.5 text-sm font-extrabold text-[#86efac] ring-1 ring-[#5f9f6f]/50 transition-all duration-300 hover:bg-(--sb-accent-surface)/40 hover:ring-[#86efac]/40"
                >
                  {t("withdraw.copyCode")}
                </button>
              </SoftPanel>
            ) : null}
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

export default WithdrawShop;
