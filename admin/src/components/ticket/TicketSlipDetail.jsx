function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString();
}

function toNumber(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export default function TicketSlipDetail({ ticket }) {
  if (!ticket) return null;

  return (
    <div className="overflow-hidden rounded-sm border border-(--border) bg-(--surfaceMuted)/40">
      <div className="border-b border-(--border) px-3 py-2 text-xs font-semibold uppercase tracking-wide text-(--muted)">
        Slip — receipt {ticket.receiptNumber || "—"} · coupon {ticket.couponNumber}
      </div>
      <div className="max-h-[min(50vh,24rem)] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-(--border) text-xs uppercase tracking-wide text-(--muted)">
              <th className="px-3 py-2">Schedule</th>
              <th className="px-3 py-2">Match</th>
              <th className="px-3 py-2">Selection</th>
              <th className="px-3 py-2">Odd</th>
              <th className="px-3 py-2">Result</th>
            </tr>
          </thead>
          <tbody>
            {(ticket.selections || []).map((selection) => (
              <tr key={selection.id} className="border-b border-(--border)/60 last:border-0">
                <td className="px-3 py-2 text-xs text-(--muted)">
                  {selection.match?.startTime
                    ? formatDateTime(selection.match.startTime)
                    : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {selection.match
                    ? `${selection.match.homeTeam} vs ${selection.match.awayTeam}`
                    : "—"}
                </td>
                <td className="px-3 py-2 text-xs">
                  {selection.marketLabel
                    ? `${selection.marketLabel}: ${selection.selection}`
                    : selection.selection}
                </td>
                <td className="px-3 py-2 font-mono text-xs">
                  {toNumber(selection.odds).toFixed(2)}
                </td>
                <td className="px-3 py-2 text-xs font-mono">{selection.result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="space-y-1 border-t border-(--border) px-3 py-3 text-sm">
        <p>
          <span className="font-semibold">Stake:</span>{" "}
          {toNumber(ticket.stake).toLocaleString()} ETB
        </p>
        <p>
          <span className="font-semibold">Total odds:</span>{" "}
          {toNumber(ticket.totalOdds).toFixed(2)}
        </p>
        <p>
          <span className="font-semibold">Potential win:</span>{" "}
          {toNumber(ticket.potentialWin).toLocaleString()} ETB
        </p>
        <p>
          <span className="font-semibold">Status:</span>{" "}
          <span className="font-mono">{ticket.status}</span>
        </p>
      </div>
    </div>
  );
}
