import { useState } from "react";
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
import { fetchPublicReceiptTicket } from "../services/api";
import CouponReceipt from "../components/common/CouponReceipt";

function CheckTicket() {
  const navigate = useNavigate();
  const [receiptInput, setReceiptInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [preview, setPreview] = useState(null);

  async function handleSubmit(e) {
    e?.preventDefault?.();
    const trimmed = String(receiptInput || "").trim();
    if (!trimmed || loading) return;
    setLoading(true);
    setError(null);
    setPreview(null);
    try {
      const data = await fetchPublicReceiptTicket(trimmed);
      setPreview(data);
    } catch (err) {
      setError(err?.message || "Ticket not found.");
    } finally {
      setLoading(false);
    }
  }

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
            onClick={() => navigate(-1)}
            className="flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#111111]/90 text-[#ffffff] shadow-lg shadow-black/20  transition-transform duration-300 hover:scale-105 hover:bg-[#111111] hover:ring-(--sb-accent-fill)/30 active:scale-95"
          >
            <AppIcon name="chevronDown" size={18} className="rotate-90" />
          </button>
          <div>
            <p className="m-0 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[rgba(255,255,255,0.72)]">
              Tools
            </p>
            <h1 className="m-0 text-2xl font-black tracking-tight text-[#ffffff] sm:text-3xl">
              Check ticket
            </h1>
          </div>
        </header>

        <form onSubmit={handleSubmit} className="animate-deposit-panel">
          <SoftPanel>
            <p className="mb-4 text-center text-xs font-extrabold uppercase tracking-[0.18em] text-[rgba(255,255,255,0.72)]">
              Receipt ID
            </p>
            <p className="mb-4 text-center text-[11px] leading-relaxed text-[rgba(255,255,255,0.5)]">
              Enter the receipt number from your slip to view selections, status,
              stake, and payout.
            </p>
            <div className="flex gap-2">
              <input
                type="text"
                value={receiptInput}
                onChange={(e) => setReceiptInput(e.target.value)}
                placeholder="e.g. 95548-72957"
                disabled={loading}
                autoComplete="off"
                className={`${accountInputCls} min-h-[3rem] flex-1`}
              />
              <button
                type="submit"
                disabled={loading || !String(receiptInput || "").trim()}
                className="inline-flex min-h-[3rem] shrink-0 cursor-pointer items-center justify-center rounded-2xl border-0 bg-[#0a0a0a]/90 px-4 text-[#9aaed1] ring-1 ring-[#F6AF01]/70 transition-all hover:ring-(--sb-accent-fill)/45 disabled:pointer-events-none disabled:opacity-45"
                aria-label="Look up ticket"
              >
                {loading ? (
                  <span className="text-xs font-bold text-[rgba(255,255,255,0.72)]">…</span>
                ) : (
                  <AppIcon name="ticket" size={20} strokeWidth={1.9} />
                )}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading || !String(receiptInput || "").trim()}
              className={`${accountPrimaryBtn} mt-4`}
            >
              {loading ? "Checking…" : "Check ticket"}
            </button>
            {error ? (
              <p className="mt-4 rounded-2xl bg-[#3a1515]/90 px-4 py-3 text-center text-sm font-semibold text-[#ff6b6b] ring-1 ring-red-900/30">
                {error}
              </p>
            ) : null}
          </SoftPanel>
        </form>

        {preview ? (
          <div className="animate-deposit-panel mt-6 flex justify-center">
            <CouponReceipt ticket={preview} />
          </div>
        ) : null}
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

export default CheckTicket;
