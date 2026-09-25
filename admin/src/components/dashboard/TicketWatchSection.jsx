import { useMemo, useState } from "react";
import PanelCard from "../ui/PanelCard";
import {
  useAdminCashiersForReportsQuery,
  useAdminTicketWatchQuery,
} from "../../hook/useAdminInsights";
import { useCashierTicketWatchQuery } from "../../hook/useCashierDashboardStats";

function localYmd(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function defaultTicketWatchFilters(view) {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const dated = view !== "high-potential";
  return {
    from: dated ? localYmd(yesterday) : "",
    to: dated ? localYmd(today) : "",
    couponNumber: "",
    receiptNumber: "",
    branchName: "",
    branchLocation: "",
    cashierId: "",
    source: "",
    channel: "",
    minStake: "",
    maxStake: "",
    minAmount: "",
    maxAmount: "",
    minLegs: "",
    maxLegs: "",
    remaining: "both",
    sort: "amount",
  };
}

function money(value) {
  return Number(value || 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function resultClass(result) {
  const status = String(result || "").toUpperCase();
  if (status === "WON") return "text-emerald-600 dark:text-emerald-400";
  if (status === "LOST") return "text-rose-600 dark:text-rose-400";
  if (status === "PENDING") return "text-amber-600 dark:text-amber-400";
  return "text-(--muted)";
}

function rowTime(row, view) {
  if (view === "paid") return row.paidAt;
  if (view === "payable") return row.settledAt;
  return row.createdAt;
}

const inputClass =
  "mt-1 block w-full min-w-0 rounded-sm border border-(--border) bg-(--surface) px-2.5 py-1.5 text-sm text-(--text)";

function Field({ label, children }) {
  return (
    <label className="block text-xs text-(--muted)">
      {label}
      {children}
    </label>
  );
}

function countLabel(value) {
  return Number(value || 0).toLocaleString(undefined, { maximumFractionDigits: 0 });
}

function summaryAmountTitle(view) {
  if (view === "payable") return "Payable Amount";
  if (view === "high-potential") return "Potential Amount";
  return "Paid Amount";
}

function StatCard({ title, value, isCount }) {
  return (
    <div className="rounded-md border border-[var(--border)] bg-[var(--surface)] p-4 shadow-sm">
      <p className="text-sm font-semibold text-[var(--text)]">{title}</p>
      <p className="mt-2 text-sm font-normal text-[var(--muted)]">
        {isCount ? (
          <>
            <span className="font-mono text-[var(--text)]"># </span>
            <span className="font-mono">{value}</span>
            <span className="ml-1">tickets</span>
          </>
        ) : (
          <span className="inline-flex items-center gap-1">
            <span
              className="inline-block h-3.5 w-3.5 shrink-0 rounded-full bg-amber-500/90 ring-1 ring-amber-600/30"
              aria-hidden
            />
            <span className="font-mono">{value}</span>
            <span className="text-[var(--muted)]">ETB</span>
          </span>
        )}
      </p>
    </div>
  );
}

export default function TicketWatchSection({
  mode,
  view,
  title,
  description,
  amountLabel,
  timeLabel,
  embedInGrid = false,
}) {
  const isAdmin = mode === "admin";
  const [draft, setDraft] = useState(() => defaultTicketWatchFilters(view));
  const [applied, setApplied] = useState(() => defaultTicketWatchFilters(view));
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const cashiersQuery = useAdminCashiersForReportsQuery({ enabled: isAdmin });
  const adminQuery = useAdminTicketWatchQuery({
    ...applied,
    view,
    page,
    enabled: isAdmin,
  });
  const cashierQuery = useCashierTicketWatchQuery({
    ...applied,
    view,
    page,
    enabled: !isAdmin,
  });
  const query = isAdmin ? adminQuery : cashierQuery;

  const cashierOptions = useMemo(() => {
    const list = cashiersQuery.data || [];
    return list
      .filter((cashier) => cashier.cashierProfileId)
      .map((cashier) => ({
        value: cashier.cashierProfileId,
        label: `${cashier.name} · ${cashier.branch?.name || "—"}`,
      }));
  }, [cashiersQuery.data]);

  const items = query.data?.items || [];
  const summary = query.data?.summary || { count: 0, netPayout: 0 };
  const totalPages = Number(query.data?.totalPages || 1);
  const columnCount = isAdmin ? 8 : 7;

  function setField(key, value) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function onApply(event) {
    event.preventDefault();
    const next = { ...draft };
    if (next.source === "player") next.cashierId = "";
    setDraft(next);
    setApplied(next);
    setPage(1);
    setExpandedId(null);
  }

  function onReset() {
    const fresh = defaultTicketWatchFilters(view);
    setDraft(fresh);
    setApplied(fresh);
    setPage(1);
    setExpandedId(null);
  }

  const summaryCards = (
    <>
      <StatCard title="Bets" value={countLabel(summary.count)} isCount />
      <StatCard title={summaryAmountTitle(view)} value={money(summary.netPayout)} />
    </>
  );

  const details = (
    <PanelCard className={`overflow-hidden ${embedInGrid ? "no-print sm:col-span-2" : ""}`}>
      <div className="border-b border-(--border) px-4 py-3">
        <h3 className="text-base font-semibold">Ticket details</h3>
        <p className="mt-1 text-xs text-(--muted)">{description}</p>
      </div>

      <form className="space-y-3 border-b border-(--border) px-4 py-3" onSubmit={onApply}>
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          <Field label="From">
            <input
              type="date"
              value={draft.from}
              onChange={(event) => setField("from", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="To">
            <input
              type="date"
              value={draft.to}
              onChange={(event) => setField("to", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Coupon">
            <input
              value={draft.couponNumber}
              onChange={(event) => setField("couponNumber", event.target.value)}
              placeholder="Contains"
              className={inputClass}
            />
          </Field>
          <Field label="Receipt">
            <input
              value={draft.receiptNumber}
              onChange={(event) => setField("receiptNumber", event.target.value)}
              placeholder="Contains"
              className={inputClass}
            />
          </Field>
          <Field label="Branch">
            <input
              value={draft.branchName}
              onChange={(event) => setField("branchName", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Location">
            <input
              value={draft.branchLocation}
              onChange={(event) => setField("branchLocation", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Channel">
            <select
              value={draft.channel}
              onChange={(event) => setField("channel", event.target.value)}
              className={inputClass}
            >
              <option value="">All</option>
              <option value="PREMATCH">Prematch</option>
              <option value="LIVE">Live</option>
            </select>
          </Field>
          {isAdmin ? (
            <Field label="Source">
              <select
                value={draft.source}
                onChange={(event) => setField("source", event.target.value)}
                className={inputClass}
              >
                <option value="">All</option>
                <option value="cashier">Cashier</option>
                <option value="player">Player</option>
              </select>
            </Field>
          ) : null}
          {isAdmin ? (
            <Field label="Cashier">
              <select
                value={draft.cashierId}
                onChange={(event) => setField("cashierId", event.target.value)}
                disabled={draft.source === "player" || cashiersQuery.isLoading}
                className={`${inputClass} disabled:opacity-60`}
              >
                <option value="">All cashiers</option>
                {cashierOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <Field label="Min stake">
            <input
              inputMode="decimal"
              value={draft.minStake}
              onChange={(event) => setField("minStake", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Max stake">
            <input
              inputMode="decimal"
              value={draft.maxStake}
              onChange={(event) => setField("maxStake", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={`Min ${amountLabel.toLowerCase()}`}>
            <input
              inputMode="decimal"
              value={draft.minAmount}
              onChange={(event) => setField("minAmount", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={`Max ${amountLabel.toLowerCase()}`}>
            <input
              inputMode="decimal"
              value={draft.maxAmount}
              onChange={(event) => setField("maxAmount", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Min selections">
            <input
              inputMode="numeric"
              value={draft.minLegs}
              onChange={(event) => setField("minLegs", event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label="Max selections">
            <input
              inputMode="numeric"
              value={draft.maxLegs}
              onChange={(event) => setField("maxLegs", event.target.value)}
              className={inputClass}
            />
          </Field>
          {view === "high-potential" ? (
            <Field label="Remaining">
              <select
                value={draft.remaining}
                onChange={(event) => setField("remaining", event.target.value)}
                className={inputClass}
              >
                <option value="both">1 or 2</option>
                <option value="1">1 left</option>
                <option value="2">2 left</option>
              </select>
            </Field>
          ) : null}
          <Field label="Sort">
            <select
              value={draft.sort}
              onChange={(event) => setField("sort", event.target.value)}
              className={inputClass}
            >
              <option value="amount">{amountLabel}, highest</option>
              <option value="stake">Stake, highest</option>
              <option value="time">{timeLabel}, newest</option>
            </select>
          </Field>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="submit"
            className="rounded-sm bg-(--accent) px-3 py-2 text-xs font-semibold text-white"
          >
            Apply filters
          </button>
          <button
            type="button"
            onClick={onReset}
            className="rounded-sm border border-(--border) px-3 py-2 text-xs font-semibold text-(--text)"
          >
            Reset
          </button>
          <p className="text-xs text-(--muted)">
            {query.isLoading
              ? "Loading..."
              : query.isError
                ? "Could not apply these filters."
                : `${Number(summary.count || 0).toLocaleString()} tickets · ${money(summary.netPayout)} ETB ${amountLabel.toLowerCase()}`}
            {!query.isError && query.data?.from && query.data?.to
              ? ` · ${query.data.from} to ${query.data.to}`
              : ""}
          </p>
        </div>
        {query.data?.truncated ? (
          <p className="text-xs text-amber-600 dark:text-amber-400">
            Showing the newest 2,000 matching tickets. Narrow the dates or filters to see the rest.
          </p>
        ) : null}
        {query.isError ? (
          <p className="text-sm text-rose-600 dark:text-rose-400">
            {query.error?.message || "Failed to load tickets."}
          </p>
        ) : null}
      </form>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-(--border) text-xs uppercase tracking-wide text-(--muted)">
              <th className="px-4 py-3 font-semibold">Coupon</th>
              <th className="px-4 py-3 font-semibold">Receipt</th>
              {isAdmin ? <th className="px-4 py-3 font-semibold">Cashier</th> : null}
              <th className="px-4 py-3 font-semibold">Branch</th>
              <th className="px-4 py-3 font-semibold">Selections</th>
              <th className="px-4 py-3 font-semibold">Stake</th>
              <th className="px-4 py-3 font-semibold">{amountLabel}</th>
              <th className="px-4 py-3 font-semibold">{timeLabel}</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-5 text-(--muted)">
                  Loading...
                </td>
              </tr>
            ) : query.isError ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-5 text-(--muted)">
                  Tickets could not be loaded.
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td colSpan={columnCount} className="px-4 py-5 text-(--muted)">
                  No tickets match these filters.
                </td>
              </tr>
            ) : (
              items.map((row) => {
                const open = expandedId === row.id;
                return (
                  <FragmentRow
                    key={row.id}
                    row={row}
                    view={view}
                    open={open}
                    isAdmin={isAdmin}
                    columnCount={columnCount}
                    onToggle={() => setExpandedId(open ? null : row.id)}
                  />
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-(--border) px-4 py-3 text-xs">
        <span className="text-(--muted)">
          Page {Number(query.data?.page || page)} of {totalPages}
        </span>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={page <= 1 || query.isLoading}
            onClick={() => {
              setPage((current) => Math.max(1, current - 1));
              setExpandedId(null);
            }}
            className="rounded-sm border border-(--border) px-2.5 py-1.5 font-semibold disabled:opacity-50"
          >
            Previous
          </button>
          <button
            type="button"
            disabled={page >= totalPages || query.isLoading}
            onClick={() => {
              setPage((current) => current + 1);
              setExpandedId(null);
            }}
            className="rounded-sm border border-(--border) px-2.5 py-1.5 font-semibold disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </PanelCard>
  );

  if (embedInGrid) {
    return (
      <>
        <h3 className="sm:col-span-2 pt-2 text-base font-semibold text-[var(--text)]">{title}</h3>
        {summaryCards}
        {details}
      </>
    );
  }

  return (
    <div className="space-y-3">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="grid gap-3 sm:grid-cols-2">{summaryCards}</div>
      {details}
    </div>
  );
}

function FragmentRow({ row, view, open, isAdmin, columnCount, onToggle }) {
  return (
    <>
      <tr className="border-b border-(--border)/60">
        <td className="px-4 py-3">
          <button type="button" onClick={onToggle} className="font-mono text-xs underline">
            {row.couponNumber || row.id}
          </button>
        </td>
        <td className="px-4 py-3 font-mono text-xs">{row.receiptNumber || "-"}</td>
        {isAdmin ? (
          <td className="px-4 py-3">
            <div>{row.cashierName || (row.source === "player" ? "Player" : "-")}</div>
            <div className="text-xs uppercase text-(--muted)">{row.source}</div>
          </td>
        ) : null}
        <td className="px-4 py-3">
          <div>{row.branchName || "-"}</div>
          <div className="text-xs text-(--muted)">{row.branchLocation || ""}</div>
        </td>
        <td className="px-4 py-3">
          {view === "high-potential"
            ? `${row.pendingCount} left / ${row.legCount}`
            : row.legCount}
        </td>
        <td className="px-4 py-3">{money(row.stake)}</td>
        <td className="px-4 py-3 font-semibold">{money(row.netPayout)}</td>
        <td className="px-4 py-3 text-(--muted)">{formatDateTime(rowTime(row, view))}</td>
      </tr>
      {open ? (
        <tr className="border-b border-(--border)/60 bg-(--surfaceMuted)">
          <td colSpan={columnCount} className="px-4 py-3">
            <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-(--muted)">
              <span>Status {row.status}</span>
              <span>Gross {money(row.potentialWin)} ETB</span>
              <span>Tax {money(row.winningsTaxAmount)} ETB</span>
              <span>Net {money(row.netPayout)} ETB</span>
              <span>Channel {row.channel || "-"}</span>
              <span>Placed {formatDateTime(row.createdAt)}</span>
              <span>Settled {formatDateTime(row.settledAt)}</span>
              <span>Paid {formatDateTime(row.paidAt)}</span>
            </div>
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="text-(--muted)">
                  <th className="py-1 pr-3 font-semibold">Match</th>
                  <th className="py-1 pr-3 font-semibold">Market</th>
                  <th className="py-1 pr-3 font-semibold">Selection</th>
                  <th className="py-1 pr-3 font-semibold">Odds</th>
                  <th className="py-1 pr-3 font-semibold">Result</th>
                  <th className="py-1 font-semibold">Kickoff</th>
                </tr>
              </thead>
              <tbody>
                {(row.selections || []).map((selection) => (
                  <tr key={selection.id}>
                    <td className="py-1 pr-3">{selection.matchName || "-"}</td>
                    <td className="py-1 pr-3">{selection.marketLabel || "-"}</td>
                    <td className="py-1 pr-3">{selection.label || "-"}</td>
                    <td className="py-1 pr-3">{Number(selection.odds || 0).toFixed(2)}</td>
                    <td className={`py-1 pr-3 font-semibold ${resultClass(selection.result)}`}>
                      {selection.result}
                    </td>
                    <td className="py-1">{formatDateTime(selection.kickoffAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      ) : null}
    </>
  );
}
