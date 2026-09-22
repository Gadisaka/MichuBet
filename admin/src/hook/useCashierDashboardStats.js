import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./useApiRequest";

const KEY = ["cashier", "wallet", "dashboard-stats"];

/**
 * GET /api/cashier/wallet/dashboard-stats?from=YYYY-MM-DD&to=YYYY-MM-DD
 */
export function useCashierDashboardStatsQuery({ from, to, enabled = true }) {
  return useQuery({
    queryKey: [...KEY, { from, to }],
    queryFn: () => {
      const params = new URLSearchParams();
      params.set("from", from);
      params.set("to", to);
      return apiRequest(`/cashier/wallet/dashboard-stats?${params.toString()}`);
    },
    enabled: Boolean(enabled && from && to),
  });
}

const WATCH_PARAM_KEYS = [
  "from",
  "to",
  "couponNumber",
  "receiptNumber",
  "branchName",
  "branchLocation",
  "channel",
  "minStake",
  "maxStake",
  "minAmount",
  "maxAmount",
  "minLegs",
  "maxLegs",
  "remaining",
  "sort",
];

function ticketWatchSearch(filters) {
  const params = new URLSearchParams();
  params.set("view", filters.view);
  params.set("page", String(filters.page || 1));
  params.set("limit", String(filters.limit || 20));
  for (const key of WATCH_PARAM_KEYS) {
    const value = filters[key];
    if (value == null || String(value).trim() === "") continue;
    if (key === "remaining" && filters.view !== "high-potential") continue;
    params.set(key, String(value).trim());
  }
  return params.toString();
}

/** GET /api/cashier/wallet/ticket-watch — scoped to the logged-in cashier. */
export function useCashierTicketWatchQuery({
  view,
  page = 1,
  limit = 20,
  enabled = true,
  ...filters
} = {}) {
  const queryFilters = { view, page, limit, ...filters };
  return useQuery({
    queryKey: [...KEY, "ticket-watch", queryFilters],
    queryFn: () => apiRequest(`/cashier/wallet/ticket-watch?${ticketWatchSearch(queryFilters)}`),
    enabled: Boolean(enabled && view),
  });
}
