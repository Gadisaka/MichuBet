import { useEffect, useMemo, useState } from "react";
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
  createOnlineWithdraw,
  fetchOnlineWithdrawCashiers,
  fetchOnlineWithdrawConfig,
  fetchOnlineWithdrawRequests,
  fetchPlayerWallet,
  fetchProfile,
} from "../services/api";
import { usePlatformSettings } from "../hooks/usePlatformSettings";
import { withdrawAmountViolation } from "../utils/stakeLimits";
import { useTranslation } from "../i18n/LanguageContext.jsx";

function money(n) {
  return Number(n ?? 0).toLocaleString();
}

function StepDots({ step, total = 4 }) {
  return (
    <div className="mb-6 flex items-center justify-center gap-2">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1;
        const active = n === step;
        const done = n < step;
        return (
          <div
            key={n}
            className={`h-2.5 rounded-full transition-all duration-500 ease-out ${
              active
                ? "w-9 bg-(--sb-accent-fill) shadow-[0_0_14px_rgba(246,175,1,0.45)]"
                : done
                  ? "w-2.5 bg-(--sb-accent-fill)/55"
                  : "w-2.5 bg-[#F6AF01]/80"
            }`}
            aria-hidden
          />
        );
      })}
    </div>
  );
}

function statusLabel(status, t) {
  if (status === "PENDING") return t("withdraw.statusPending");
  if (status === "COMPLETED") return t("withdraw.statusCompleted");
  if (status === "REJECTED") return t("withdraw.statusRejected");
  if (status === "EXPIRED") return t("withdraw.statusExpired");
  return status;
}

function WithdrawOnline() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { limits } = usePlatformSettings();

  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [pageError, setPageError] = useState(null);
  const [formError, setFormError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [balance, setBalance] = useState(null);
  const [withdrawable, setWithdrawable] = useState(null);
  const [config, setConfig] = useState(null);
  const [cashiers, setCashiers] = useState([]);
  const [history, setHistory] = useState([]);

  const [amount, setAmount] = useState("");
  const [cashierId, setCashierId] = useState("");
  const [bankCode, setBankCode] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [accountName, setAccountName] = useState("");
  const [success, setSuccess] = useState(null);

  const feePercent = Number(config?.feePercent ?? 10);
  const numericAmount = Number(amount);
  const feeAmount =
    Number.isFinite(numericAmount) && numericAmount > 0
      ? Math.round(numericAmount * feePercent) / 100
      : 0;
  const netAmount =
    Number.isFinite(numericAmount) && numericAmount > 0
      ? Math.round((numericAmount - feeAmount) * 100) / 100
      : 0;

  const selectedCashier = useMemo(
    () => cashiers.find((c) => c.id === cashierId) ?? null,
    [cashiers, cashierId],
  );
  const cashierBanks = selectedCashier?.banks ?? [];

  async function load() {
    const [wallet, cfg, cash, hist] = await Promise.all([
      fetchPlayerWallet(),
      fetchOnlineWithdrawConfig(),
      fetchOnlineWithdrawCashiers(),
      fetchOnlineWithdrawRequests({ page: 1, limit: 8 }),
    ]);
    setBalance(wallet === null ? null : Number(wallet.balance ?? 0));
    setWithdrawable(wallet === null ? null : Number(wallet.withdrawable ?? 0));
    setConfig(cfg);
    setCashiers(Array.isArray(cash?.items) ? cash.items : []);
    setHistory(Array.isArray(hist?.items) ? hist.items : []);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await fetchProfile();
        await load();
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

  function validateAmount() {
    const n = Number(amount);
    if (!Number.isFinite(n) || n <= 0) return "Enter a valid amount.";
    if (withdrawable != null && n > withdrawable) {
      return `Withdrawable balance is ${withdrawable.toLocaleString()} ETB.`;
    }
    if (balance != null && n > balance) return "Amount exceeds your balance.";
    return withdrawAmountViolation(limits, n);
  }

  async function handleConfirm(e) {
    e.preventDefault();
    setFormError("");
    const amtErr = validateAmount();
    if (amtErr) {
      setFormError(amtErr);
      setStep(1);
      return;
    }
    if (!cashierId) {
      setFormError(t("withdraw.selectCashier"));
      setStep(2);
      return;
    }
    if (!bankCode) {
      setFormError(t("withdraw.selectBank"));
      setStep(3);
      return;
    }
    setSubmitting(true);
    try {
      const data = await createOnlineWithdraw({
        amount: Number(amount),
        cashierId,
        bankCode,
        accountNumber,
        accountName,
      });
      setSuccess(data);
      setAmount("");
      setAccountNumber("");
      setAccountName("");
      await load();
    } catch (err) {
      setFormError(err.message || "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <PageContainer>
      <div className="sticky top-0 z-50">
        <TopHeader data={topHeaderData} />
        <PrimaryNav items={topNavItems} />
      </div>

      <div className="relative mx-auto w-full max-w-lg px-4 pb-28 pt-2 sm:px-5 sm:pt-4">
        <header className="relative mb-6 flex items-center gap-4">
          <button
            type="button"
            onClick={() => navigate("/withdraw")}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#111111]/90 text-[#ffffff] shadow-lg shadow-black/20 transition-transform duration-300 hover:scale-105 hover:bg-[#111111] active:scale-95"
          >
            <AppIcon name="chevronDown" size={18} className="rotate-90" />
          </button>
          <div>
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.72)]">
              {t("withdraw.onlineEyebrow")}
            </p>
            <h1 className="m-0 text-2xl font-black tracking-tight text-[#ffffff] sm:text-3xl">
              {t("withdraw.title")}
            </h1>
          </div>
        </header>

        {loading ? (
          <div className="flex flex-col items-center justify-center gap-4 py-24 text-[rgba(255,255,255,0.72)]">
            <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#F6AF01] border-t-(--sb-accent-fill)" />
            <span className="text-sm font-semibold">Loading…</span>
          </div>
        ) : pageError ? (
          <SoftPanel>
            <p className="m-0 text-sm font-semibold text-[#ff6b6b]">{pageError}</p>
          </SoftPanel>
        ) : success ? (
          <div className="flex flex-col gap-4">
            <SoftPanel className="ring-[#3f7f5f]/35">
              <p className="m-0 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[#86efac]">
                {t("withdraw.successTitle")}
              </p>
              <p className="mt-3 m-0 text-center text-sm text-[rgba(255,255,255,0.72)]">
                {success.message || t("withdraw.successBody")}
              </p>
              <p className="mt-3 m-0 text-center text-lg font-black text-[#ffffff]">
                {money(success.netAmount)} ETB
              </p>
            </SoftPanel>
            <button
              type="button"
              className={accountPrimaryBtn}
              onClick={() => {
                setSuccess(null);
                setStep(1);
              }}
            >
              {t("withdraw.continueOnline")}
            </button>
            <HistoryList items={history} t={t} />
          </div>
        ) : (
          <form onSubmit={handleConfirm} className="flex flex-col gap-4">
            <StepDots step={step} />

            <SoftPanel>
              <p className="mb-2 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.72)]">
                {t("menu.balance")}
              </p>
              <p className="m-0 text-center text-3xl font-black tabular-nums text-(--sb-positive)">
                {balance == null ? "—" : `${money(balance)} ETB`}
              </p>
              <p className="mt-3 m-0 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.72)]">
                Withdrawable
              </p>
              <p className="m-0 text-center text-xl font-black tabular-nums text-[#ffffff]">
                {withdrawable == null ? "—" : `${money(withdrawable)} ETB`}
              </p>
            </SoftPanel>

            {step === 1 ? (
              <SoftPanel>
                <label className="block">
                  <span className="mb-2 block text-center text-xs font-extrabold uppercase tracking-[0.15em] text-[rgba(255,255,255,0.72)]">
                    {t("withdraw.amount")}
                  </span>
                  <input
                    type="number"
                    min={1}
                    step="any"
                    value={amount}
                    onChange={(ev) => {
                      setAmount(ev.target.value);
                      setFormError("");
                    }}
                    required
                    className={`${accountInputCls} text-2xl tracking-tight`}
                    placeholder="0"
                  />
                </label>
                {Number.isFinite(numericAmount) && numericAmount > 0 ? (
                  <div className="mt-4 space-y-1 text-center text-sm text-[rgba(255,255,255,0.72)]">
                    <p className="m-0">
                      {t("withdraw.fee")}: {money(feeAmount)} ETB ({feePercent}%)
                    </p>
                    <p className="m-0 font-bold text-[#ffffff]">
                      {t("withdraw.youReceive")}: {money(netAmount)} ETB
                    </p>
                  </div>
                ) : null}
                <button
                  type="button"
                  className={`${accountPrimaryBtn} mt-6`}
                  onClick={() => {
                    const err = validateAmount();
                    if (err) {
                      setFormError(err);
                      return;
                    }
                    setFormError("");
                    setStep(2);
                  }}
                >
                  {t("withdraw.next")}
                </button>
              </SoftPanel>
            ) : null}

            {step === 2 ? (
              <SoftPanel>
                <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.15em] text-[rgba(255,255,255,0.72)]">
                  {t("withdraw.selectCashier")}
                </p>
                {cashiers.length === 0 ? (
                  <p className="m-0 text-center text-sm text-[rgba(255,255,255,0.72)]">
                    {t("withdraw.noCashiers")}
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {cashiers.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCashierId(c.id);
                            setBankCode("");
                            setFormError("");
                            setStep(3);
                          }}
                          className={`w-full rounded-2xl px-4 py-3 text-left ring-1 transition ${
                            cashierId === c.id
                              ? "bg-(--sb-accent-fill)/15 ring-(--sb-accent-fill)"
                              : "bg-[#0a0a0a]/40 ring-white/10"
                          }`}
                        >
                          <p className="m-0 font-bold text-[#ffffff]">
                            {c.branchName || c.name}
                          </p>
                          <p className="mt-1 m-0 text-xs text-[rgba(255,255,255,0.6)]">
                            {(c.banks ?? []).map((b) => b.name).join(", ")}
                          </p>
                          <p className="mt-1 m-0 text-[11px] text-[rgba(255,255,255,0.45)]">
                            {c.pendingCount} {t("withdraw.pendingCount")}
                          </p>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                <button
                  type="button"
                  className="mt-4 w-full text-sm text-[rgba(255,255,255,0.6)]"
                  onClick={() => setStep(1)}
                >
                  {t("withdraw.back")}
                </button>
              </SoftPanel>
            ) : null}

            {step === 3 ? (
              <SoftPanel>
                <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.15em] text-[rgba(255,255,255,0.72)]">
                  {t("withdraw.selectBank")}
                </p>
                <div className="grid gap-2">
                  {cashierBanks.map((b) => (
                    <button
                      key={b.code}
                      type="button"
                      onClick={() => {
                        setBankCode(b.code);
                        setFormError("");
                        setStep(4);
                      }}
                      className={`rounded-2xl px-4 py-3 text-left ring-1 ${
                        bankCode === b.code
                          ? "bg-(--sb-accent-fill)/15 ring-(--sb-accent-fill)"
                          : "bg-[#0a0a0a]/40 ring-white/10"
                      }`}
                    >
                      <p className="m-0 font-bold text-[#ffffff]">{b.name}</p>
                      <p className="m-0 text-[11px] uppercase text-[rgba(255,255,255,0.45)]">
                        {b.type}
                      </p>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  className="mt-4 w-full text-sm text-[rgba(255,255,255,0.6)]"
                  onClick={() => setStep(2)}
                >
                  {t("withdraw.back")}
                </button>
              </SoftPanel>
            ) : null}

            {step === 4 ? (
              <SoftPanel>
                <label className="block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.15em] text-[rgba(255,255,255,0.72)]">
                    {t("withdraw.accountNumber")}
                  </span>
                  <input
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value)}
                    required
                    className={accountInputCls}
                  />
                </label>
                <label className="mt-4 block">
                  <span className="mb-2 block text-xs font-extrabold uppercase tracking-[0.15em] text-[rgba(255,255,255,0.72)]">
                    {t("withdraw.accountName")}
                  </span>
                  <input
                    value={accountName}
                    onChange={(e) => setAccountName(e.target.value)}
                    required
                    className={accountInputCls}
                  />
                </label>
                <div className="mt-4 space-y-1 text-sm text-[rgba(255,255,255,0.72)]">
                  <p className="m-0">
                    {t("withdraw.amount")}: {money(numericAmount)} ETB
                  </p>
                  <p className="m-0">
                    {t("withdraw.youReceive")}: {money(netAmount)} ETB
                  </p>
                  <p className="m-0">
                    {selectedCashier?.branchName} ·{" "}
                    {cashierBanks.find((b) => b.code === bankCode)?.name}
                  </p>
                </div>
                <button
                  type="submit"
                  disabled={submitting}
                  className={`${accountPrimaryBtn} mt-6`}
                >
                  {submitting ? t("withdraw.confirming") : t("withdraw.confirm")}
                </button>
                <button
                  type="button"
                  className="mt-3 w-full text-sm text-[rgba(255,255,255,0.6)]"
                  onClick={() => setStep(3)}
                >
                  {t("withdraw.back")}
                </button>
              </SoftPanel>
            ) : null}

            {formError ? (
              <p className="m-0 text-center text-sm font-semibold text-[#ff6b6b]">
                {formError}
              </p>
            ) : null}

            <HistoryList items={history} t={t} />
          </form>
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

function HistoryList({ items, t }) {
  if (!items?.length) return null;
  return (
    <SoftPanel>
      <p className="mb-3 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.72)]">
        {t("withdraw.history")}
      </p>
      <ul className="space-y-2">
        {items.map((r) => (
          <li
            key={r.id}
            className="flex items-start justify-between gap-3 border-b border-white/5 pb-2 last:border-0 last:pb-0"
          >
            <div>
              <p className="m-0 text-sm font-bold text-[#ffffff]">
                {money(r.amount)} ETB → {money(r.netAmount)} ETB
              </p>
              <p className="m-0 text-xs text-[rgba(255,255,255,0.55)]">
                {r.bankName} · {r.accountNumber}
              </p>
            </div>
            <span className="text-xs font-semibold text-[rgba(255,255,255,0.7)]">
              {statusLabel(r.status, t)}
            </span>
          </li>
        ))}
      </ul>
    </SoftPanel>
  );
}

export default WithdrawOnline;
