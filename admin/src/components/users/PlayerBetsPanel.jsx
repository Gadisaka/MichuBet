import { Fragment, useState } from "react";
import Modal from "../ui/Modal";
import TicketSlipDetail from "../ticket/TicketSlipDetail";
import {
  useAdminTicketDetailQuery,
  useAdminTicketsQuery,
} from "../../hook/useAdminTickets";

function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

export default function PlayerBetsPanel({ player, onClose }) {
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState(null);

  const query = useAdminTicketsQuery({
    page,
    limit: 20,
    userId: player?.id || "",
    enabled: Boolean(player?.id),
  });

  const detailQuery = useAdminTicketDetailQuery(expandedId, {
    enabled: Boolean(expandedId),
  });

  const items = Array.isArray(query.data?.items) ? query.data.items : [];
  const total = Number(query.data?.total || 0);
  const totalPages = Number(query.data?.totalPages || 1);

  function toggleRow(id) {
    setExpandedId((prev) => (prev === id ? null : id));
  }

  const subtitle = [player?.name, player?.phone].filter(Boolean).join(" · ");

  return (
    <Modal
      open={Boolean(player)}
      onClose={onClose}
      title={subtitle ? `Bet history — ${subtitle}` : "Bet history"}
      maxWidthClassName="max-w-4xl"
      centered
    >
      {query.isError ? (
        <p className="text-sm text-rose-600 dark:text-rose-400">
          {query.error?.message || "Failed to load bet history."}
        </p>
      ) : null}

      <p className="mb-3 text-xs text-[var(--muted)]">
        {query.isLoading
          ? "Loading tickets…"
          : `${total} ticket${total !== 1 ? "s" : ""}`}
      </p>

      <div className="overflow-x-auto rounded-sm border border-[var(--border)]">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-[var(--border)] text-xs uppercase tracking-wide text-[var(--muted)]">
              <th className="w-8 px-3 py-2" aria-hidden />
              <th className="px-3 py-2 font-semibold">Time</th>
              <th className="px-3 py-2 font-semibold">Receipt</th>
              <th className="px-3 py-2 font-semibold">Coupon</th>
              <th className="px-3 py-2 font-semibold">Stake</th>
              <th className="px-3 py-2 font-semibold">Potential Win</th>
              <th className="px-3 py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {query.isLoading ? (
              <tr>
                <td className="px-3 py-4 text-[var(--muted)]" colSpan={7}>
                  Loading tickets...
                </td>
              </tr>
            ) : items.length === 0 ? (
              <tr>
                <td className="px-3 py-4 text-[var(--muted)]" colSpan={7}>
                  No tickets found for this player.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const open = expandedId === item.id;
                return (
                  <Fragment key={item.id}>
                    <tr
                      className={`cursor-pointer border-b border-[var(--border)]/60 hover:bg-[var(--surfaceMuted)] ${
                        open ? "bg-[var(--surfaceMuted)]/60" : ""
                      }`}
                      onClick={() => toggleRow(item.id)}
                    >
                      <td className="px-3 py-2 text-[var(--muted)]">
                        {open ? "▼" : "▶"}
                      </td>
                      <td className="px-3 py-2">
                        {formatDateTime(item.created_at)}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {item.receipt_number || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono">
                        {item.coupon_number}
                      </td>
                      <td className="px-3 py-2">
                        {Number(item.stake || 0).toLocaleString()} ETB
                      </td>
                      <td className="px-3 py-2">
                        {Number(item.potential_win || 0).toLocaleString()} ETB
                      </td>
                      <td className="px-3 py-2">{item.status}</td>
                    </tr>
                    {open ? (
                      <tr className="border-b border-[var(--border)]/60 bg-[var(--surface)]/80">
                        <td colSpan={7} className="px-3 py-3">
                          {detailQuery.isLoading ? (
                            <p className="text-sm text-[var(--muted)]">
                              Loading slip...
                            </p>
                          ) : detailQuery.isError ? (
                            <p className="text-sm text-rose-600 dark:text-rose-400">
                              Could not load slip details.
                            </p>
                          ) : (
                            <TicketSlipDetail ticket={detailQuery.data} />
                          )}
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 ? (
        <div className="mt-3 flex items-center justify-end gap-2 text-xs">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => {
              setExpandedId(null);
              setPage((value) => Math.max(1, value - 1));
            }}
            className="rounded-sm border border-[var(--border)] px-2 py-1 disabled:opacity-50"
          >
            Prev
          </button>
          <span className="text-[var(--muted)]">
            {page} / {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => {
              setExpandedId(null);
              setPage((value) => value + 1);
            }}
            className="rounded-sm border border-[var(--border)] px-2 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      ) : null}
    </Modal>
  );
}
