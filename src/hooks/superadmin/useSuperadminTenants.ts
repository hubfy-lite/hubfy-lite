import { useCallback, useRef } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuperadminTenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  customers_count: number;
  orders_count: number;
  products_count: number;
  courses_count: number;
  revenue_total: number;
  owner_name: string | null;
  owner_email: string | null;
  owner_whatsapp: string | null;
  onboarding_goal: string | null;
  referral_source: string | null;
  customer_count: string | null;
  annual_revenue: string | null;
  used_tools: string[] | null;
}

export interface TenantStats {
  total: number;
  migrate: number;
  onboardingComplete: number;
  recent7d: number;
}

export interface TenantFilters {
  goals: string[];
  customerCounts: string[];
  annualRevenues: string[];
  usedTools: string[];
}

const EMPTY_FILTERS: TenantFilters = { goals: [], customerCounts: [], annualRevenues: [], usedTools: [] };

const PAGE_SIZE = 50;

interface RpcRow {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  customers_count: number;
  orders_count: number;
  products_count: number;
  courses_count: number;
  revenue_total: number;
  owner_name: string | null;
  owner_email: string | null;
  owner_whatsapp: string | null;
  onboarding_goal: string | null;
  referral_source: string | null;
  customer_count: string | null;
  annual_revenue: string | null;
  used_tools: string[] | null;
  total_count: number;
  stat_total: number;
  stat_migrate: number;
  stat_onboarding_complete: number;
  stat_recent_7d: number;
}

interface PageResult {
  tenants: SuperadminTenant[];
  totalCount: number;
  page: number;
  stats: TenantStats;
}

export function useSuperadminTenants(
  searchQuery = "",
  sortBy = "created_at",
  sortDir: "asc" | "desc" = "desc",
  filters: TenantFilters = EMPTY_FILTERS,
) {
  const fetchPage = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }): Promise<PageResult> => {
      const { data, error } = await supabase.rpc("get_superadmin_tenants" as string, {
        p_search: searchQuery || undefined,
        p_page: pageParam,
        p_page_size: PAGE_SIZE,
        p_sort_by: sortBy,
        p_sort_dir: sortDir,
        p_goals: filters.goals.length > 0 ? filters.goals : undefined,
        p_customer_counts: filters.customerCounts.length > 0 ? filters.customerCounts : undefined,
        p_annual_revenues: filters.annualRevenues.length > 0 ? filters.annualRevenues : undefined,
        p_used_tools: filters.usedTools.length > 0 ? filters.usedTools : undefined,
      });

      if (error) throw error;

      const rows = (data ?? []) as RpcRow[];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;
      const first = rows[0];

      return {
        tenants: rows.map((r) => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          created_at: r.created_at,
          customers_count: Number(r.customers_count),
          orders_count: Number(r.orders_count),
          products_count: Number(r.products_count),
          courses_count: Number(r.courses_count),
          revenue_total: Number(r.revenue_total),
          owner_name: r.owner_name,
          owner_email: r.owner_email,
          owner_whatsapp: r.owner_whatsapp,
          onboarding_goal: r.onboarding_goal,
          referral_source: r.referral_source,
          customer_count: r.customer_count,
          annual_revenue: r.annual_revenue,
          used_tools: r.used_tools,
        })),
        totalCount,
        page: pageParam,
        stats: {
          total: first ? Number(first.stat_total) : 0,
          migrate: first ? Number(first.stat_migrate) : 0,
          onboardingComplete: first ? Number(first.stat_onboarding_complete) : 0,
          recent7d: first ? Number(first.stat_recent_7d) : 0,
        },
      };
    },
    [searchQuery, sortBy, sortDir, filters.goals, filters.customerCounts, filters.annualRevenues, filters.usedTools],
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
    queryKey: ["superadmin_tenants", searchQuery, sortBy, sortDir, filters.goals, filters.customerCounts, filters.annualRevenues, filters.usedTools],
    queryFn: fetchPage,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined;
    },
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });

  const allTenants = data?.pages.flatMap((p) => p.tenants) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;
  const stats: TenantStats = data?.pages[0]?.stats ?? { total: 0, migrate: 0, onboardingComplete: 0, recent7d: 0 };

  if (!queryPending && allTenants.length >= 0) {
    hasLoadedOnce.current = true;
  }

  const loading = queryPending && !hasLoadedOnce.current;

  return {
    tenants: allTenants,
    totalCount,
    stats,
    loading,
    error: error as Error | null,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    refetch,
  };
}
