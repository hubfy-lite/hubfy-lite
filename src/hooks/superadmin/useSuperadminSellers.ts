import { useCallback } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuperadminSeller {
  id: string;
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  type: string;
  status: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  taxpayer_id: string | null;
  business_name: string | null;
  ein: string | null;
  submitted_at: string | null;
  approved_at: string | null;
  rejected_at: string | null;
  created_at: string;
}

const PAGE_SIZE = 50;

interface RpcRow extends SuperadminSeller {
  total_count: number;
}

interface PageResult {
  sellers: SuperadminSeller[];
  totalCount: number;
  page: number;
}

export function useSuperadminSellers(
  searchQuery = "",
  statusFilter: string | null = null
) {
  const fetchPage = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }): Promise<PageResult> => {
      const { data, error } = await supabase.rpc("get_superadmin_sellers" as string, {
        p_search: searchQuery || undefined,
        p_status: statusFilter || undefined,
        p_page: pageParam,
        p_page_size: PAGE_SIZE,
      });

      if (error) throw error;

      const rows = (data ?? []) as RpcRow[];
      const totalCount = rows[0]?.total_count ?? 0;

      return {
        sellers: rows.map(({ total_count, ...rest }) => rest),
        totalCount,
        page: pageParam,
      };
    },
    [searchQuery, statusFilter]
  );

  const query = useInfiniteQuery({
    queryKey: ["superadmin-sellers", searchQuery, statusFilter],
    queryFn: fetchPage,
    getNextPageParam: (lastPage) => {
      const fetched = (lastPage.page + 1) * PAGE_SIZE;
      return fetched < lastPage.totalCount ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 0,
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });

  const sellers = query.data?.pages.flatMap((p) => p.sellers) ?? [];
  const totalCount = query.data?.pages[0]?.totalCount ?? 0;

  return {
    sellers,
    totalCount,
    loading: query.isLoading,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: !!query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}
