import { useMemo, useState } from "react";
import { useAuth } from "../../context/AuthContext";
import AdminShell from "../../components/layout/AdminShell";
import PanelCard from "../../components/ui/PanelCard";
import PrimaryButton from "../../components/ui/PrimaryButton";
import {
  useCasinoGamesQuery,
  useSyncCasinoCatalogMutation,
  useUpdateCasinoGameMutation,
} from "../../hook/useCasinoGames";

export default function CasinoPage() {
  const { user, logout } = useAuth();
  const games = useCasinoGamesQuery();
  const syncMutation = useSyncCasinoCatalogMutation();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [syncMessage, setSyncMessage] = useState("");
  const [syncError, setSyncError] = useState("");

  const list = games.data ?? [];

  const stats = useMemo(() => {
    const total = list.length;
    const enabled = list.filter((g) => g.enabled).length;
    return { total, enabled, disabled: total - enabled };
  }, [list]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return list.filter((g) => {
      if (statusFilter === "enabled" && !g.enabled) return false;
      if (statusFilter === "disabled" && g.enabled) return false;
      if (!q) return true;
      return (
        String(g.title || "").toLowerCase().includes(q) ||
        String(g.game_mode || "").toLowerCase().includes(q)
      );
    });
  }, [list, search, statusFilter]);

  async function handleSync() {
    setSyncMessage("");
    setSyncError("");
    try {
      const result = await syncMutation.mutateAsync();
      setSyncMessage(
        `Synced ${result?.total ?? 0} games (${result?.created ?? 0} new, ${result?.updated ?? 0} updated).`,
      );
      setTimeout(() => setSyncMessage(""), 5000);
    } catch (err) {
      setSyncError(err?.message || "Failed to sync catalog from InOut");
    }
  }

  return (
    <AdminShell user={user} onLogout={logout}>
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Casino Games</h2>
          <p className="mt-1 text-sm text-[var(--muted)]">
            Curate the InOut game catalog shown in the player lobby. Toggle
            availability, set display order, and re-sync from the provider.
          </p>
        </div>
        <PrimaryButton
          type="button"
          onClick={handleSync}
          disabled={syncMutation.isPending}
          className="w-auto shrink-0"
        >
          {syncMutation.isPending ? "Syncing…" : "Sync from InOut"}
        </PrimaryButton>
      </div>

      {(syncMessage || syncError) && (
        <div className="mb-4">
          {syncMessage && (
            <p className="text-xs font-medium text-green-600">{syncMessage}</p>
          )}
          {syncError && (
            <p className="text-xs font-medium text-[var(--danger)]">
              {syncError}
            </p>
          )}
        </div>
      )}

      <div className="mb-4 grid grid-cols-3 gap-3">
        <StatCard label="Total games" value={stats.total} />
        <StatCard label="Enabled" value={stats.enabled} accent="green" />
        <StatCard label="Disabled" value={stats.disabled} accent="muted" />
      </div>

      <PanelCard className="p-4">
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by title or game mode…"
            className="min-w-[200px] flex-1 rounded-sm border border-[var(--border)] bg-[var(--bgApp)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
          />
          <div className="flex gap-1">
            {["all", "enabled", "disabled"].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatusFilter(s)}
                className={`rounded-sm border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                  statusFilter === s
                    ? "border-[var(--accent)] bg-[var(--accent)] text-white"
                    : "border-[var(--border)] text-[var(--text)] hover:bg-[var(--surfaceMuted)]"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {games.isLoading ? (
          <p className="py-10 text-center text-sm text-[var(--muted)]">
            Loading games…
          </p>
        ) : games.isError ? (
          <p className="py-10 text-center text-sm text-[var(--danger)]">
            {games.error?.message || "Failed to load games"}
          </p>
        ) : filtered.length === 0 ? (
          <p className="py-10 text-center text-sm text-[var(--muted)]">
            {list.length === 0
              ? "No games yet. Click “Sync from InOut” to populate the catalog."
              : "No games match your filters."}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[var(--border)] text-left">
                  <Th>Game</Th>
                  <Th>Game mode</Th>
                  <Th className="text-center">RTP</Th>
                  <Th className="text-center">Multiplayer</Th>
                  <Th className="text-center">Order</Th>
                  <Th className="text-center">Status</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((game) => (
                  <GameRow key={game.id} game={game} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </PanelCard>
    </AdminShell>
  );
}

function GameRow({ game }) {
  const updateMutation = useUpdateCasinoGameMutation();
  const [orderDraft, setOrderDraft] = useState(String(game.sort_order ?? 0));
  const [rowError, setRowError] = useState("");

  const orderDirty = String(game.sort_order ?? 0) !== orderDraft.trim();

  async function toggleEnabled() {
    setRowError("");
    try {
      await updateMutation.mutateAsync({ id: game.id, enabled: !game.enabled });
    } catch (err) {
      setRowError(err?.message || "Failed to update");
    }
  }

  async function saveOrder() {
    setRowError("");
    const n = Number.parseInt(orderDraft, 10);
    if (!Number.isInteger(n)) {
      setRowError("Order must be a whole number");
      return;
    }
    try {
      await updateMutation.mutateAsync({ id: game.id, sort_order: n });
    } catch (err) {
      setRowError(err?.message || "Failed to update");
    }
  }

  return (
    <tr className="border-b border-[var(--border)] last:border-b-0">
      <td className="px-3 py-2.5">
        <div className="flex items-center gap-3">
          {game.icon_url ? (
            <img
              src={game.icon_url}
              alt=""
              className="h-9 w-9 shrink-0 rounded-sm object-cover"
              loading="lazy"
            />
          ) : (
            <div className="h-9 w-9 shrink-0 rounded-sm bg-[var(--surfaceMuted)]" />
          )}
          <span className="font-semibold">{game.title}</span>
        </div>
        {rowError && (
          <p className="mt-1 text-[11px] font-medium text-[var(--danger)]">
            {rowError}
          </p>
        )}
      </td>
      <td className="px-3 py-2.5">
        <code className="text-xs text-[var(--muted)]">{game.game_mode}</code>
      </td>
      <td className="px-3 py-2.5 text-center tabular-nums">
        {game.rtp || "—"}
      </td>
      <td className="px-3 py-2.5 text-center text-xs text-[var(--muted)]">
        {game.multiplayer ? "Yes" : "No"}
      </td>
      <td className="px-3 py-2.5">
        <div className="flex items-center justify-center gap-1">
          <input
            type="number"
            value={orderDraft}
            onChange={(e) => setOrderDraft(e.target.value)}
            className="w-16 rounded-sm border border-[var(--border)] bg-[var(--bgApp)] px-2 py-1 text-center text-sm outline-none focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={saveOrder}
            disabled={!orderDirty || updateMutation.isPending}
            className="rounded-sm border border-[var(--border)] px-2 py-1 text-xs font-semibold hover:bg-[var(--surfaceMuted)] disabled:opacity-40"
          >
            Save
          </button>
        </div>
      </td>
      <td className="px-3 py-2.5">
        <div className="flex justify-center">
          <button
            type="button"
            onClick={toggleEnabled}
            disabled={updateMutation.isPending}
            className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors disabled:opacity-50 ${
              game.enabled ? "bg-[var(--accent)]" : "bg-[var(--border)]"
            }`}
            aria-label={game.enabled ? "Disable game" : "Enable game"}
            title={game.enabled ? "Enabled — click to disable" : "Disabled — click to enable"}
          >
            <span
              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                game.enabled ? "translate-x-6" : "translate-x-1"
              }`}
            />
          </button>
        </div>
      </td>
    </tr>
  );
}

function StatCard({ label, value, accent }) {
  const valueColor =
    accent === "green"
      ? "text-green-600"
      : accent === "muted"
        ? "text-[var(--muted)]"
        : "text-[var(--text)]";
  return (
    <PanelCard className="p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {label}
      </p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${valueColor}`}>
        {value}
      </p>
    </PanelCard>
  );
}

function Th({ children, className = "" }) {
  return (
    <th
      className={`px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[var(--muted)] ${className}`}
    >
      {children}
    </th>
  );
}
