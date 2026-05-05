import { useCallback, useRef } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuperadminCustomer {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  tenant_id: string;
  tenant_name: string;
  total_revenue_cents: number;
  mrr_cents: number;
  user_id: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  orders_count: number;
  created_at: string;
}

const PAGE_SIZE = 50;

interface RpcRow {
  id: string;
  name: string | null;
  email: string;
  phone: string | null;
  tenant_id: string;
  tenant_name: string;
  total_revenue_cents: number;
  mrr_cents: number;
  user_id: string | null;
  last_sign_in_at: string | null;
  email_confirmed_at: string | null;
  orders_count: number;
  created_at: string;
  total_count: number;
}

interface PageResult {
  customers: SuperadminCustomer[];
  totalCount: number;
  page: number;
}

export function useSuperadminCustomers(
  searchQuery = "",
  tenantId: string | null = null,
) {
  const fetchPage = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }): Promise<PageResult> => {
      const { data, error } = await supabase.rpc("get_superadmin_customers" as string, {
        p_search: searchQuery || undefined,
        p_tenant_id: tenantId || undefined,
        p_page: pageParam,
        p_page_size: PAGE_SIZE,
      });

      if (error) throw error;

      const rows = (data ?? []) as RpcRow[];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

      return {
        customers: rows.map((r) => ({
          id: r.id,
          name: r.name,
          email: r.email,
          phone: r.phone,
          tenant_id: r.tenant_id,
          tenant_name: r.tenant_name,
          total_revenue_cents: r.total_revenue_cents,
          mrr_cents: r.mrr_cents,
          user_id: r.user_id,
          last_sign_in_at: r.last_sign_in_at,
          email_confirmed_at: r.email_confirmed_at,
          orders_count: Number(r.orders_count),
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
    queryKey: ["superadmin_customers", searchQuery, tenantId],
    queryFn: fetchPage,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined;
    },
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });

  const allCustomers = data?.pages.flatMap((p) => p.customers) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  if (!queryPending && allCustomers.length >= 0) {
    hasLoadedOnce.current = true;
  }

  const loading = queryPending && !hasLoadedOnce.current;

  return {
    customers: allCustomers,
    totalCount,
    loading,
    error: error as Error | null,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    refetch,
  };
}
