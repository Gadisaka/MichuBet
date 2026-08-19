import { useEffect, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import AdminShell from "../../components/layout/AdminShell";
import PanelCard from "../../components/ui/PanelCard";
import PrimaryButton from "../../components/ui/PrimaryButton";
import Modal from "../../components/ui/Modal";
import {
  useCashierOnlineWithdrawProfileQuery,
  useCashierOnlineWithdrawRequestsQuery,
  useCompleteOnlineWithdrawMutation,
  usePatchCashierOnlineWithdrawProfileMutation,
  useRejectOnlineWithdrawMutation,
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

export default function CashierOnlineWithdrawPage() {
  const { user, logout } = useAuth();
  const profileQuery = useCashierOnlineWithdrawProfileQuery();
  const [page, setPage] = useState(1);
  const requestsQuery = useCashierOnlineWithdrawRequestsQuery({ page });

  return (
    <AdminShell user={user} onLogout={logout}>
      <div className="mb-6">
        <h2 className="text-xl font-semibold">Online Withdraw</h2>
        <p className="mt-1 text-sm text-[var(--muted)]">
          Pay players to their bank or wallet. You keep 10% and send 90%.
        </p>
      </div>

      <SetupCard query={profileQuery} />

      <RequestsTable
        query={requestsQuery}
        page={page}
        setPage={setPage}
        ready={Boolean(profileQuery.data?.enabled)}
      />
    </AdminShell>
  );
}

function SetupCard({ query }) {
  const patch = usePatchCashierOnlineWithdrawProfileMutation();
  const data = query.data;
  const [banks, setBanks] = useState([]);
  const [available, setAvailable] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!data) return;
    setBanks((data.banks ?? []).map((b) => b.code));
    setAvailable(Boolean(data.available));
  }, [data]);

  const allBanks = data?.allBanks ?? [];
  const enabled = Boolean(data?.enabled);

  async function save(e) {
    e.preventDefault();
    setError("");
    setSaved(false);
    try {
      await patch.mutateAsync({ banks, available });
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err.message || "Failed to save");
    }
  }

  function toggleBank(code) {
    setBanks((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    );
  }

  return (
    <PanelCard className="mb-6 p-5">
      <h3 className="text-sm font-semibold uppercase tracking-wide">
        Availability
      </h3>
      {!query.isLoading && !enabled ? (
        <p className="mt-2 text-sm text-amber-600">
          An admin must mark you eligible for online withdraw before players can
          pick you.
        </p>
      ) : null}
      {query.isLoading ? (
        <p className="mt-3 text-sm text-[var(--muted)]">Loading…</p>
      ) : (
        <form onSubmit={save} className="mt-4 space-y-4">
          <label className="flex cursor-pointer items-center gap-3">
            <input
              type="checkbox"
              checked={available}
              onChange={(e) => setAvailable(e.target.checked)}
              className="h-4 w-4 rounded border-[var(--border)]"
            />
            <span className="text-sm font-semibold">
              I am available for online withdrawals
            </span>
          </label>
          <p className="text-xs text-[var(--muted)]">
            Select every bank or wallet you can pay. Players only see cashiers
            who selected at least one.
          </p>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {allBanks.map((bank) => {
              const on = banks.includes(bank.code);
              return (
                <label
                  key={bank.code}
                  className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm ${
                    on
                      ? "border-[var(--accent)] bg-[var(--accent)]/10"
                      : "border-[var(--border)]"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleBank(bank.code)}
                  />
                  <span>
                    {bank.name}
                    <span className="ml-1 text-[10px] uppercase text-[var(--muted)]">
                      {bank.type}
                    </span>
                  </span>
                </label>
              );
            })}
          </div>
          <PrimaryButton
            type="submit"
            disabled={patch.isPending}
            className="w-auto"
          >
            {patch.isPending ? "Saving…" : "Save profile"}
          </PrimaryButton>
          {saved ? (
            <p className="text-xs font-medium text-green-600">Saved.</p>
          ) : null}
          {error ? (
            <p className="text-xs font-medium text-[var(--danger)]">{error}</p>
          ) : null}
        </form>
      )}
    </PanelCard>
  );
}

function RequestsTable({ query, page, setPage, ready }) {
  const complete = useCompleteOnlineWithdrawMutation();
  const reject = useRejectOnlineWithdrawMutation();
  const [completeRow, setCompleteRow] = useState(null);
  const [rejectRow, setRejectRow] = useState(null);
  const [reason, setReason] = useState("");
  const [actionError, setActionError] = useState("");

  const { items = [], totalPages = 1 } = query.data ?? {};

  async function confirmComplete() {
    if (!completeRow) return;
    setActionError("");
    try {
      await complete.mutateAsync(completeRow.id);
      setCompleteRow(null);
    } catch (err) {
      setActionError(err.message || "Failed to complete");
    }
  }

  async function confirmReject() {
    if (!rejectRow) return;
    setActionError("");
    try {
      await reject.mutateAsync({ id: rejectRow.id, reason });
      setRejectRow(null);
      setReason("");
    } catch (err) {
      setActionError(err.message || "Failed to reject");
    }
  }

  return (
    <>
      <PanelCard className="overflow-x-auto">
        {!ready ? (
          <p className="px-4 py-6 text-sm text-[var(--muted)]">
            Finish setup above. Requests appear here once an admin enables you
            and a player picks you.
          </p>
        ) : null}
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="px-4 py-3">Player</th>
              <th className="px-4 py-3">Gross</th>
              <th className="px-4 py-3">Send</th>
              <th className="px-4 py-3">Bank / account</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Created</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={7}>
                  Loading…
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-[var(--muted)]" colSpan={7}>
                  No online withdraw requests yet.
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
                  <td className="px-4 py-3 font-mono">{money(r.amount)}</td>
                  <td className="px-4 py-3 font-mono font-semibold">
                    {money(r.netAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <p>{r.bankName}</p>
                    <p className="font-mono text-xs">{r.accountNumber}</p>
                    <p className="text-xs text-[var(--muted)]">{r.accountName}</p>
                  </td>
                  <td className={`px-4 py-3 text-xs font-semibold ${statusClass(r.status)}`}>
                    {r.status}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {r.createdAt ? new Date(r.createdAt).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-3">
                    {r.status === "PENDING" ? (
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setActionError("");
                            setCompleteRow(r);
                          }}
                          className="text-xs font-semibold text-green-600"
                        >
                          Complete
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setActionError("");
                            setReason("");
                            setRejectRow(r);
                          }}
                          className="text-xs font-semibold text-[var(--danger)]"
                        >
                          Reject
                        </button>
                      </div>
                    ) : (
                      "—"
                    )}
                  </td>
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
        open={Boolean(completeRow)}
        onClose={() => setCompleteRow(null)}
        title="Confirm transfer"
      >
        {completeRow ? (
          <div className="space-y-3 text-sm">
            <p>
              Send{" "}
              <span className="font-mono font-semibold">
                {money(completeRow.netAmount)} ETB
              </span>{" "}
              to {completeRow.accountName} ({completeRow.bankName}{" "}
              {completeRow.accountNumber}).
            </p>
            <p className="text-xs text-[var(--muted)]">
              Your cashier wallet will increase by {money(completeRow.amount)}{" "}
              ETB (gross). Keep {money(completeRow.feeAmount)} ETB as the fee.
            </p>
            {actionError ? (
              <p className="text-xs text-[var(--danger)]">{actionError}</p>
            ) : null}
            <div className="flex gap-2">
              <PrimaryButton
                onClick={confirmComplete}
                disabled={complete.isPending}
              >
                {complete.isPending ? "Confirming…" : "I have sent the money"}
              </PrimaryButton>
              <button
                type="button"
                onClick={() => setCompleteRow(null)}
                className="rounded-sm border border-[var(--border)] px-4 py-2.5 text-sm"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : null}
      </Modal>

      <Modal
        open={Boolean(rejectRow)}
        onClose={() => setRejectRow(null)}
        title="Reject request"
      >
        {rejectRow ? (
          <div className="space-y-3 text-sm">
            <p>
              The player will be refunded {money(rejectRow.amount)} ETB in full.
            </p>
            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase text-[var(--muted)]">
                Reason
              </span>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full rounded-sm border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-sm"
              />
            </label>
            {actionError ? (
              <p className="text-xs text-[var(--danger)]">{actionError}</p>
            ) : null}
            <PrimaryButton
              onClick={confirmReject}
              disabled={reject.isPending || reason.trim().length < 3}
            >
              {reject.isPending ? "Rejecting…" : "Reject and refund"}
            </PrimaryButton>
          </div>
        ) : null}
      </Modal>
    </>
  );
}
