import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "./useApiRequest";

const BASE = "/admin/casino";

/** Full catalog incl. disabled games (casino:read). */
export function useCasinoGamesQuery() {
  return useQuery({
    queryKey: ["admin", "casino", "games"],
    queryFn: () => apiRequest(`${BASE}/games`),
  });
}

/** Toggle enabled / set sort_order for one game (casino:manage). */
export function useUpdateCasinoGameMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, enabled, sort_order }) =>
      apiRequest(`${BASE}/games/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ enabled, sort_order }),
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "casino", "games"] });
    },
  });
}

/** Re-sync the catalog from InOut (casino:manage). */
export function useSyncCasinoCatalogMutation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiRequest(`${BASE}/sync`, { method: "POST" }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin", "casino", "games"] });
    },
  });
}
