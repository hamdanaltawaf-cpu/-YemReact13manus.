import { trpc } from "@/lib/trpc";
import { useCallback, useMemo } from "react";

export function useAuth() {
  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false, refetchOnWindowFocus: false });
  const logoutMutation = trpc.auth.logout.useMutation({ onSuccess: () => utils.auth.me.setData(undefined, null) });
  const logout = useCallback(async () => {
    await logoutMutation.mutateAsync();
    try { ((globalThis as unknown as Record<string, unknown>)["google"] as { accounts?: { id?: { disableAutoSelect?: () => void } } } | undefined)?.accounts?.id?.disableAutoSelect?.(); } catch {}
    utils.auth.me.setData(undefined, null);
    await utils.auth.me.invalidate();
  }, [logoutMutation, utils]);
  return useMemo(() => ({ user: meQuery.data ?? null, loading: meQuery.isLoading || logoutMutation.isPending, error: meQuery.error ?? logoutMutation.error ?? null, isAuthenticated: Boolean(meQuery.data), refresh: () => meQuery.refetch(), logout }), [meQuery.data, meQuery.error, meQuery.isLoading, logoutMutation.error, logoutMutation.isPending, meQuery, logout]);
}
