import { useCallback, useRef } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuperadminProduct {
  id: string;
  name: string;
  tenant_id: string;
  tenant_name: string;
  unit_amount: number;
  currency: string;
  status: string;
  benefit: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

interface RpcRow {
  id: string;
  name: string;
  tenant_id: string;
  tenant_name: string;
  unit_amount: number;
  currency: string;
  status: string;
  benefit: string | null;
  created_at: string;
  total_count: number;
}

interface PageResult {
  products: SuperadminProduct[];
  totalCount: number;
  page: number;
}

export function useSuperadminProducts(
  searchQuery = "",
  tenantId: string | null = null,
) {
  const fetchPage = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }): Promise<PageResult> => {
      const { data, error } = await supabase.rpc("get_superadmin_products" as string, {
        p_search: searchQuery || undefined,
        p_tenant_id: tenantId || undefined,
        p_page: pageParam,
        p_page_size: PAGE_SIZE,
      });

      if (error) throw error;

      const rows = (data ?? []) as RpcRow[];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

      return {
        products: rows.map((r) => ({
          id: r.id,
          name: r.name,
          tenant_id: r.tenant_id,
          tenant_name: r.tenant_name,
          unit_amount: r.unit_amount,
          currency: r.currency,
          status: r.status,
          benefit: r.benefit,
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
    queryKey: ["superadmin_products", searchQuery, tenantId],
    queryFn: fetchPage,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined;
    },
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });

  const allProducts = data?.pages.flatMap((p) => p.products) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  if (!queryPending && allProducts.length >= 0) {
    hasLoadedOnce.current = true;
  }

  const loading = queryPending && !hasLoadedOnce.current;

  return {
    products: allProducts,
    totalCount,
    loading,
    error: error as Error | null,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    refetch,
  };
}
