import { useState } from "react";
import { useAuth } from "../../context/AuthContext";
import { hasPermission } from "../../lib/permissions";
import AdminShell from "../../components/layout/AdminShell";
import PanelCard from "../../components/ui/PanelCard";
import SelectInput from "../../components/ui/SelectInput";
import TextInput from "../../components/ui/TextInput";
import PrimaryButton from "../../components/ui/PrimaryButton";
import Modal from "../../components/ui/Modal";
import {
  useAdminOnlineWithdrawCashiersQuery,
  useAdminOnlineWithdrawRequestsQuery,
  useAdminOnlineWithdrawSummaryQuery,
  useForceRejectOnlineWithdrawMutation,
  usePatchOnlineWithdrawEligibilityMutation,
} from "../../hook/useOnlineWithdraw";

function money(n) {
  return Number(n ?? 0).toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function statusClass(status) {
  if (status === "PENDING") return "text-amber-600";
  if (status === "COMPLETED") return "text-green-600";
  if (status === "REJECTED" || status === "EXPIRED") return "text-[var(--danger)]";
  return "text-[var(--muted)]";
}

export default function AdminOnlineWithdrawPage() {
  const { user, logout } = useAuth();
  const [view, setView] = useState("transactions");
  const summary = useAdminOnlineWithdrawSummaryQuery();
  const s = summary.data ?? {};

  const cards = [
    { label: "Requested", value: money(s.totalRequested), hint: `${s.totalCount ?? 0} requests` },
    { label: "Paid to players", value: money(s.totalPaidOut), hint: `${s.completedCount ?? 0} completed` },
    { label: "Fees (cashier)", value: money(s.totalFees), hint: "Kept by cashiers" },
    { label: "Pending", value: money(s.pendingAmount), hint: `${s.pendingCount ?? 0} open` },
    { label: "Rejected / expired", value: `${s.rejectedCount ?? 0} / ${s.expiredCount ?? 0}`, hint: "Refunded to players" },
    { label: "Eligible cashiers", value: String(s.eligibleCashiers ?? 0), hint: "Admin-enabled" },
  ];

  return (
    <AdminShell user={user} onLogout={logout}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Online Withdraw</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Track player payouts through cashiers and manage who can process them.
        </p>
      </div>

      <div className="mb-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <PanelCard key={c.label} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              {c.label}
            </p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{c.hint}</p>
          </PanelCard>
        ))}
      </div>

      <div className="mb-5 flex gap-1 border-b border-[var(--border)]">
        {[
          { key: "transactions", label: "Transactions" },
          { key: "cashiers", label: "Cashiers" },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setView(tab.key)}
            className={`border-b-2 px-4 py-2 text-sm font-semibold ${
              view === tab.key
                ? "border-[var(--accent)] text-[var(--accent)]"
                : "border-transparent text-[var(--muted)]"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {view === "transactions" ? <TransactionsTable /> : <CashiersTable />}
    </AdminShell>
  );
}

function TransactionsTable() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, "online-withdraw:manage");
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [searchApplied, setSearchApplied] = useState("");
  const query = useAdminOnlineWithdrawRequestsQuery({
    page,
    status,
    search: searchApplied,
  });
  const forceReject = useForceRejectOnlineWithdrawMutation();
  const [rejectRow, setRejectRow] = useState(null);
  const [reason, setReason] = useState("Cancelled by admin");
  const { items = [], totalPages = 1 } = query.data ?? {};

  return (
    <>
      <PanelCard className="mb-4 p-4">
        <div className="grid gap-3 md:grid-cols-3">
          <SelectInput
            label="Status"
            value={status}
            onChange={(e) => {
              setStatus(e.target.value);
              setPage(1);
            }}
            options={[
              { value: "PENDING", label: "Pending" },
              { value: "COMPLETED", label: "Completed" },
              { value: "REJECTED", label: "Rejected" },
              { value: "EXPIRED", label: "Expired" },
            ]}
            placeholder="All"
          />
          <TextInput
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Player, phone, account"
          />
          <div className="flex items-end">
            <PrimaryButton
              className="w-auto"
              onClick={() => {
                setSearchApplied(search.trim());
                setPage(1);
              }}
            >
              Filter
            </PrimaryButton>
          </div>
        </div>
      </PanelCard>
      <PanelCard className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Cashier</th>
              <th className="px-4 py-3">Gross / net</th>
              <th className="px-4 py-3">Destination</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              {canManage ? <th className="px-4 py-3">Actions</th> : null}
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={8}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={8}>
                  No transactions.
                </td>
              </tr>
            ) : (
              items.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-[var(--border)] last:border-0"
                >
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.player?.name || "—"}</p>
                    <p className="text-xs text-[var(--muted)]">
                      {r.player?.phone || "—"}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    {r.cashier?.branchName || r.cashier?.user?.name || "—"}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs">
                    {money(r.amount)} / {money(r.netAmount)}
                    <p className="text-[var(--muted)]">fee {money(r.feeAmount)}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{r.bankName}</p>
                    <p className="font-mono text-xs">{r.accountNumber}</p>
                    <p className="text-xs text-[var(--muted)]">{r.accountName}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className={`text-xs font-semibold ${statusClass(r.status)}`}>
                      {r.status}
                    </p>
                    {(r.status === "REJECTED" || r.status === "EXPIRED") &&
                    r.rejectReason ? (
                      <p className="mt-1 text-[11px] font-normal leading-snug text-[var(--muted)]">
                        {r.rejectReason}
                      </p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      {r.status === "PENDING" ? (
                        <button
                          type="button"
                          onClick={() => setRejectRow(r)}
                          className="text-xs font-semibold text-[var(--danger)]"
                        >
                          Force reject
                        </button>
                      ) : (
                        "—"
                      )}
                    </td>
                  ) : null}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </PanelCard>
      {totalPages > 1 ? (
        <div className="mt-4 flex items-center justify-center gap-3 text-sm">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
            className="rounded-sm border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Previous
          </button>
          <span className="text-[var(--muted)]">
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
            className="rounded-sm border border-[var(--border)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold disabled:opacity-40"
          >
            Next
          </button>
        </div>
      ) : null}

      <Modal
        open={Boolean(rejectRow)}
        onClose={() => setRejectRow(null)}
        title="Force reject"
      >
        {rejectRow ? (
          <div className="space-y-3 text-sm">
            <p>
              Refund {money(rejectRow.amount)} ETB to{" "}
              {rejectRow.player?.name || "the player"}.
            </p>
            <TextInput
              label="Reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
            <PrimaryButton
              onClick={async () => {
                await forceReject.mutateAsync({
                  id: rejectRow.id,
                  reason,
                });
                setRejectRow(null);
              }}
              disabled={forceReject.isPending}
            >
              {forceReject.isPending ? "Rejecting…" : "Refund player"}
            </PrimaryButton>
          </div>
        ) : null}
      </Modal>
    </>
  );
}

function CashiersTable() {
  const { user } = useAuth();
  const canManage = hasPermission(user?.role, "online-withdraw:manage");
  const query = useAdminOnlineWithdrawCashiersQuery();
  const patch = usePatchOnlineWithdrawEligibilityMutation();
  const items = query.data?.items ?? [];

  return (
    <PanelCard className="overflow-x-auto">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
            <th className="px-4 py-3">Cashier</th>
            <th className="px-4 py-3">Banks</th>
            <th className="px-4 py-3">7-day volume</th>
            <th className="px-4 py-3">Pending</th>
            <th className="px-4 py-3">Completed</th>
            <th className="px-4 py-3">Avg time</th>
            <th className="px-4 py-3">Available</th>
            <th className="px-4 py-3">Eligible</th>
          </tr>
        </thead>
        <tbody>
          {query.isLoading ? (
            <tr>
              <td className="px-4 py-6 text-[var(--muted)]" colSpan={8}>
                Loading…
              </td>
            </tr>
          ) : items.length === 0 ? (
            <tr>
              <td className="px-4 py-6 text-[var(--muted)]" colSpan={8}>
                No cashiers.
              </td>
            </tr>
          ) : (
            items.map((c) => (
              <tr
                key={c.id}
                className="border-b border-[var(--border)] last:border-0"
              >
                <td className="px-4 py-3">
                  <p className="font-medium">{c.name}</p>
                  <p className="text-xs text-[var(--muted)]">
                    {c.branchName} · {c.phone || "—"}
                  </p>
                </td>
                <td className="px-4 py-3 text-xs">
                  {(c.banks ?? []).map((b) => b.name).join(", ") || "—"}
                </td>
                <td className="px-4 py-3 font-mono">{money(c.volume7d)}</td>
                <td className="px-4 py-3">{c.pendingCount}</td>
                <td className="px-4 py-3">{c.completedCount}</td>
                <td className="px-4 py-3 text-xs text-[var(--muted)]">
                  {c.avgCompletionMs != null
                    ? `${Math.round(c.avgCompletionMs / 3600000)}h`
                    : "—"}
                </td>
                <td className="px-4 py-3">{c.available ? "Yes" : "No"}</td>
                <td className="px-4 py-3">
                  {canManage ? (
                    <label className="inline-flex items-center gap-2 text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(c.enabled)}
                        onChange={(e) =>
                          patch.mutate({ id: c.id, enabled: e.target.checked })
                        }
                        disabled={patch.isPending}
                      />
                      {c.enabled ? "Enabled" : "Off"}
                    </label>
                  ) : (
                    c.enabled ? "Yes" : "No"
                  )}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </PanelCard>
  );
}
