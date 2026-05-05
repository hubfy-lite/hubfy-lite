import { useCallback, useRef } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface SuperadminUser {
  user_id: string;
  name: string | null;
  email: string;
  email_confirmed_at: string | null;
  whatsapp: string | null;
  created_at: string;
  tenant_name: string | null;
  tenant_slug: string | null;
}

export interface UserFilters {
  emailStatus: string[];
  workspaceStatus: string[];
}

const EMPTY_FILTERS: UserFilters = { emailStatus: [], workspaceStatus: [] };

const PAGE_SIZE = 50;

interface RpcRow {
  user_id: string;
  name: string | null;
  email: string;
  email_confirmed_at: string | null;
  whatsapp: string | null;
  created_at: string;
  tenant_name: string | null;
  tenant_slug: string | null;
  total_count: number;
}

interface PageResult {
  users: SuperadminUser[];
  totalCount: number;
  page: number;
}

export function useSuperadminUsers(
  searchQuery = "",
  sortBy = "created_at",
  sortDir: "asc" | "desc" = "desc",
  filters: UserFilters = EMPTY_FILTERS,
) {
  const fetchPage = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }): Promise<PageResult> => {
      const { data, error } = await supabase.rpc("get_superadmin_users" as string, {
        p_search: searchQuery || undefined,
        p_page: pageParam,
        p_page_size: PAGE_SIZE,
        p_sort_by: sortBy,
        p_sort_dir: sortDir,
        p_email_status: filters.emailStatus.length > 0 ? filters.emailStatus : undefined,
        p_workspace_status: filters.workspaceStatus.length > 0 ? filters.workspaceStatus : undefined,
      });

      if (error) throw error;

      const rows = (data ?? []) as RpcRow[];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

      return {
        users: rows.map((r) => ({
          user_id: r.user_id,
          name: r.name,
          email: r.email,
          email_confirmed_at: r.email_confirmed_at,
          whatsapp: r.whatsapp,
          created_at: r.created_at,
          tenant_name: r.tenant_name,
          tenant_slug: r.tenant_slug,
        })),
        totalCount,
        page: pageParam,
      };
    },
    [searchQuery, sortBy, sortDir, filters.emailStatus, filters.workspaceStatus],
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
    queryKey: ["superadmin_users", searchQuery, sortBy, sortDir, filters.emailStatus, filters.workspaceStatus],
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
