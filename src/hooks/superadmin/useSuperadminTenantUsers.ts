import { useCallback, useRef } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuperadminTenantUser {
  id: string;
  user_id: string;
  tenant_id: string;
  tenant_name: string;
  name: string;
  email: string;
  whatsapp: string | null;
  role: string;
  status: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

interface RpcRow {
  id: string;
  user_id: string;
  tenant_id: string;
  tenant_name: string;
  name: string;
  email: string;
  whatsapp: string | null;
  role: string;
  status: string;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  created_at: string;
  total_count: number;
}

interface PageResult {
  users: SuperadminTenantUser[];
  totalCount: number;
  page: number;
}

export function useSuperadminTenantUsers(
  searchQuery = "",
  tenantId: string | null = null,
) {
  const fetchPage = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }): Promise<PageResult> => {
      const { data, error } = await supabase.rpc("get_superadmin_tenant_users" as string, {
        p_search: searchQuery || undefined,
        p_tenant_id: tenantId || undefined,
        p_page: pageParam,
        p_page_size: PAGE_SIZE,
      });

      if (error) throw error;

      const rows = (data ?? []) as RpcRow[];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

      return {
        users: rows.map((r) => ({
          id: r.id,
          user_id: r.user_id,
          tenant_id: r.tenant_id,
          tenant_name: r.tenant_name,
          name: r.name,
          email: r.email,
          whatsapp: r.whatsapp,
          role: r.role,
          status: r.status,
          last_sign_in_at: r.last_sign_in_at,
          email_confirmed_at: r.email_confirmed_at,
          created_at: r.created_at,
        })),
        totalCount,
        page: pageParam,
      };
    },
    [searchQuery, tenantId],
  );

  const hasLoadedOnce = useRef(false);

  const {
    data,
    isPending: queryPending,
    error,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    refetch,
  } = useInfiniteQuery({
    queryKey: ["superadmin_tenant_users", searchQuery, tenantId],
    queryFn: fetchPage,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined;
    },
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });

  const allUsers = data?.pages.flatMap((p) => p.users) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  if (!queryPending && allUsers.length >= 0) {
    hasLoadedOnce.current = true;
  }

  const loading = queryPending && !hasLoadedOnce.current;

  return {
    users: allUsers,
    totalCount,
    loading,
    error: error as Error | null,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    refetch,
  };
}
