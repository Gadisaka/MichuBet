import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./useApiRequest";

const KEY = ["online-withdraw"];

export function useOnlineWithdrawBanksQuery() {
  return useQuery({
    queryKey: [...KEY, "banks"],
    queryFn: () => apiRequest("/online-withdraw/banks"),
    staleTime: 60 * 60 * 1000,
  });
}

export function useCashierOnlineWithdrawProfileQuery() {
  return useQuery({
    queryKey: [...KEY, "cashier", "profile"],
    queryFn: () => apiRequest("/cashier/online-withdraw/profile"),
  });
}

export function usePatchCashierOnlineWithdrawProfileMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (body) =>
      apiRequest("/cashier/online-withdraw/profile", {
        method: "PATCH",
        body: JSON.stringify(body),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useCashierOnlineWithdrawRequestsQuery({
  page = 1,
  status = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (status) params.set("status", status);
  return useQuery({
    queryKey: [...KEY, "cashier", "requests", { page, status }],
    queryFn: () => apiRequest(`/cashier/online-withdraw?${params.toString()}`),
    refetchInterval: 15_000,
  });
}

export function useCompleteOnlineWithdrawMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) =>
      apiRequest(`/cashier/online-withdraw/${id}/complete`, {
        method: "POST",
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRejectOnlineWithdrawMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) =>
      apiRequest(`/cashier/online-withdraw/${id}/reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useAdminOnlineWithdrawSummaryQuery() {
  return useQuery({
    queryKey: [...KEY, "admin", "summary"],
    queryFn: () => apiRequest("/admin/online-withdraw/summary"),
    refetchInterval: 30_000,
  });
}

export function useAdminOnlineWithdrawRequestsQuery({
  page = 1,
  status = "",
  cashierId = "",
  search = "",
} = {}) {
  const params = new URLSearchParams();
  params.set("page", String(page));
  if (status) params.set("status", status);
  if (cashierId) params.set("cashierId", cashierId);
  if (search) params.set("search", search);
  return useQuery({
    queryKey: [...KEY, "admin", "requests", { page, status, cashierId, search }],
    queryFn: () =>
      apiRequest(`/admin/online-withdraw/requests?${params.toString()}`),
    keepPreviousData: true,
  });
}

export function useAdminOnlineWithdrawCashiersQuery() {
  return useQuery({
    queryKey: [...KEY, "admin", "cashiers"],
    queryFn: () => apiRequest("/admin/online-withdraw/cashiers"),
  });
}

export function usePatchOnlineWithdrawEligibilityMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled }) =>
      apiRequest(`/admin/online-withdraw/cashiers/${id}/eligibility`, {
        method: "PATCH",
        body: JSON.stringify({ enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}

export function useForceRejectOnlineWithdrawMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }) =>
      apiRequest(`/admin/online-withdraw/requests/${id}/force-reject`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: KEY }),
  });
}
