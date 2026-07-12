import { topHeaderData } from "../../data/homepageData";
import {
  mapLegUiStatus,
  mapTicketUiStatus,
} from "../../utils/ticketDisplayStatus";

/**
 * Coupon check preview — displays list of paid tickets for a coupon number.
 * Shows coupon, selections, odds, status, and credited cashback when present.
 * Does not show stake or potential win.
 *
 * Used by the "Check Coupon" feature in betslip and CheckTicket page.
 * `tickets` is the array from `fetchPublicCouponCheck`:
 * `[{ couponNumber, receiptNumber, status, createdAt, cashbackAmount, selections: [...] }]`
 */

const TICKET_STATUS_CLS = {
  won: "coupon-receipt__ticket-status--won",
  lost: "coupon-receipt__ticket-status--lost",
  pending: "coupon-receipt__ticket-status--pending",
  cancelled: "coupon-receipt__ticket-status--cancelled",
};

const LEG_STATUS_CLS = {
  won: "coupon-receipt__leg--won",
  lost: "coupon-receipt__leg--lost",
  postponed: "coupon-receipt__leg--postponed",
  notplayed: "coupon-receipt__leg--notplayed",
};

function formatReceiptKickoff(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatOdds(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return "—";
  return n.toFixed(2);
}

function formatCashbackEtb(value) {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toFixed(2)} ETB`;
}

function formatLeagueLine(sel) {
  const league = String(sel?.league ?? "").trim();
  if (league) return league;
  const country = String(sel?.country ?? "").trim();
  const leagueName = String(sel?.leagueName ?? "").trim();
  if (country && leagueName) return `${country} - ${leagueName}`;
  return leagueName || country || "";
}

function ReceiptDivider() {
  return (
    <div aria-hidden className="my-2 border-t border-dashed border-[#9a9a9a]" />
  );
}

function SingleTicketCard({ ticket, className = "" }) {
  if (!ticket) return null;
  const selections = ticket.selections || [];
  const ticketStatus = mapTicketUiStatus(ticket.status);
  const cashbackLabel = formatCashbackEtb(ticket.cashbackAmount);

  return (
    <div
      className={`coupon-receipt w-full max-w-[330px] bg-[#fcfcf9] px-5 py-7 font-mono text-[#0a0a0a] shadow-[0_22px_48px_-18px_rgba(0,0,0,0.7)] ${className}`}
    >
      <div className="text-center">
        <p className="m-0 text-lg font-black uppercase tracking-[0.35em] text-[#0a0a0a]">
          {topHeaderData.brand}
        </p>
        <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.15em] text-[#777]">
          Coupon
        </p>
        <p className="break-all text-base font-extrabold tracking-[0.08em] text-[#0a0a0a]">
          {ticket.couponNumber || "—"}
        </p>
        <p
          className={`coupon-receipt__ticket-status mt-2 inline-block px-3 py-1 text-[12px] font-black uppercase tracking-[0.15em] ${TICKET_STATUS_CLS[ticketStatus.key] ?? TICKET_STATUS_CLS.pending}`}
        >
          {ticketStatus.label}
        </p>
        {cashbackLabel ? (
          <p className="mt-2 text-[12px] font-black uppercase tracking-[0.12em] text-[#0a0a0a]">
            Cashback{" "}
            <span className="tracking-normal">{cashbackLabel}</span>
          </p>
        ) : null}
      </div>

      <ReceiptDivider />

      <p className="m-0 text-center text-[10px] font-bold uppercase tracking-[0.25em] text-[#555]">
        Selections ({selections.length})
      </p>

      <ReceiptDivider />

      <div className="space-y-1">
        {selections.map((sel, idx) => {
          const kickoff = formatReceiptKickoff(sel.kickoffAt);
          const pick = String(sel.label ?? "").trim() || "-";
          const market = String(sel.marketLabel ?? "").trim() || "-";
          const leagueLine = formatLeagueLine(sel);
          const legStatus = mapLegUiStatus(sel);
          const legCls =
            LEG_STATUS_CLS[legStatus.key] ?? LEG_STATUS_CLS.notplayed;

          return (
            <div
              key={`${ticket.receiptNumber || ticket.couponNumber}-${idx}`}
              className={`coupon-receipt__leg rounded px-2 py-1.5 ${legCls}`}
            >
              {leagueLine ? (
                <div className="text-[11px] font-extrabold leading-snug uppercase tracking-wide">
                  {leagueLine}
                </div>
              ) : null}
              <div className="text-[13px] font-extrabold leading-snug">
                {idx + 1}. {sel.matchName}
              </div>
              <div className="mt-0.5 flex items-end justify-between gap-3">
                <span className="min-w-0 flex-1 break-words text-[12px] font-bold">
                  {market}
                </span>
                <span className="shrink-0 text-[12px] font-black">
                  {pick}
                </span>
              </div>
              <div className="mt-0.5 flex items-end justify-between gap-3">
                <span className="min-w-0 flex-1 text-[11px] font-bold opacity-90">
                  {kickoff || "-"}
                </span>
                <span className="shrink-0 text-[12px] font-black">
                  {formatOdds(sel.odds)}
                </span>
              </div>
              <div className="mt-0.5 text-right text-[10px] font-black uppercase tracking-wide">
                {legStatus.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CouponCheckPreview({ tickets, className = "" }) {
  if (!tickets || tickets.length === 0) return null;

  if (tickets.length === 1) {
    return <SingleTicketCard ticket={tickets[0]} className={className} />;
  }

  return (
    <div className={`space-y-4 ${className}`}>
      <p className="text-center text-xs font-bold uppercase tracking-wide text-[rgba(255,255,255,0.72)]">
        {tickets.length} Tickets Found
      </p>
      {tickets.map((ticket, idx) => (
        <SingleTicketCard
          key={ticket.receiptNumber || `ticket-${idx}`}
          ticket={ticket}
        />
      ))}
    </div>
  );
}

export default CouponCheckPreview;
