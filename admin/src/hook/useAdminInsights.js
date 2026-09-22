import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "./useApiRequest";

const KEY = ["admin", "insights"];

export function useAdminDashboardInsightsQuery({
  from = "",
  to = "",
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: [...KEY, "dashboard", { from, to }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return apiRequest(`/admin/insights/dashboard?${params.toString()}`);
    },
    enabled: Boolean(enabled && from && to),
    keepPreviousData: true,
  });
}

/** Same payload as financial support: player-wallet deposit/withdraw reports. */
export function useAdminFinanceReportsQuery({
  from = "",
  to = "",
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: [...KEY, "finance-reports", { from, to }],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      return apiRequest(`/admin/finance/reports?${params.toString()}`);
    },
    enabled: Boolean(enabled && from && to),
    keepPreviousData: true,
  });
}

async function fetchAllAdminAgents() {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({
      page: String(page),
      limit: "100",
    });
    const res = await apiRequest(`/admin/agents-cashiers/agents?${params}`);
    all.push(...(res.items || []));
    totalPages = Number(res.totalPages) || 1;
    page += 1;
  } while (page <= totalPages);
  return all;
}

async function fetchAllAdminCashiers() {
  const all = [];
  let page = 1;
  let totalPages = 1;
  do {
    const params = new URLSearchParams({
      page: String(page),
      limit: "100",
    });
    const res = await apiRequest(`/admin/agents-cashiers/cashiers?${params}`);
    all.push(...(res.items || []));
    totalPages = Number(res.totalPages) || 1;
    page += 1;
  } while (page <= totalPages);
  return all;
}

export function useAdminAgentsForReportsQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: [...KEY, "agents-for-reports"],
    queryFn: fetchAllAdminAgents,
    enabled: Boolean(enabled),
    staleTime: 60_000,
  });
}

export function useAdminCashiersForReportsQuery({ enabled = true } = {}) {
  return useQuery({
    queryKey: [...KEY, "cashiers-for-reports"],
    queryFn: fetchAllAdminCashiers,
    enabled: Boolean(enabled),
    staleTime: 60_000,
  });
}

/** Ticket sales: stakes and counts; optional agentId + cashierProfileId. */
export function useAdminSalesReportsQuery({
  from = "",
  to = "",
  agentId = "",
  cashierProfileId = "",
  enabled = true,
} = {}) {
  return useQuery({
    queryKey: [
      ...KEY,
      "sales-reports",
      { from, to, agentId, cashierProfileId },
    ],
    queryFn: () => {
      const params = new URLSearchParams();
      if (from) params.set("from", from);
      if (to) params.set("to", to);
      if (agentId) params.set("agentId", agentId);
      if (cashierProfileId) params.set("cashierProfileId", cashierProfileId);
      return apiRequest(`/admin/reports/sales?${params.toString()}`);
    },
    enabled: Boolean(enabled && from && to),
    keepPreviousData: true,
  });
}

const WATCH_PARAM_KEYS = [
  "from",
  "to",
  "couponNumber",
  "receiptNumber",
  "branchName",
  "branchLocation",
  "cashierId",
  "source",
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

/** GET /api/admin/insights/ticket-watch */
export function useAdminTicketWatchQuery({
  view,
  page = 1,
  limit = 20,
  enabled = true,
  ...filters
} = {}) {
  const queryFilters = { view, page, limit, ...filters };
  return useQuery({
    queryKey: [...KEY, "ticket-watch", queryFilters],
    queryFn: () => apiRequest(`/admin/insights/ticket-watch?${ticketWatchSearch(queryFilters)}`),
    enabled: Boolean(enabled && view),
    keepPreviousData: true,
  });
}
