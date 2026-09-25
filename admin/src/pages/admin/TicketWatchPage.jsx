import { useAuth } from "../../context/AuthContext";
import AdminShell from "../../components/layout/AdminShell";
import TicketWatchSection from "../../components/dashboard/TicketWatchSection";

export default function TicketWatchPage() {
  const { user, logout } = useAuth();

  return (
    <AdminShell user={user} onLogout={logout}>
      <div className="space-y-5">
        <div>
          <h2 className="text-2xl font-semibold">Ticket Watch</h2>
          <p className="mt-1 text-sm text-(--muted)">
            Payable, high-potential, and paid tickets.
          </p>
        </div>
        <TicketWatchSection
          mode="admin"
          view="payable"
          title="Two-Day Payable Report"
          description="Won tickets that have not been paid yet. Dates use the day the ticket was settled. Defaults to yesterday and today."
          amountLabel="Net payout"
          timeLabel="Settled"
        />
        <TicketWatchSection
          mode="admin"
          view="high-potential"
          title="High Win Potential"
          description="Sold tickets with 1 or 2 selections still pending and no lost selection. A void leg does not count as remaining. Leave dates empty to include every open ticket."
          amountLabel="Net potential"
          timeLabel="Placed"
        />
        <TicketWatchSection
          mode="admin"
          view="paid"
          title="Paid tickets"
          description="Winning tickets already paid in the selected payout dates, highest net payout first. Cashback refunds are excluded."
          amountLabel="Net payout"
          timeLabel="Paid"
        />
      </div>
    </AdminShell>
  );
}
