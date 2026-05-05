import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  invokeEdgeFunction,
  parseEdgeFunctionError,
  isNonRetryable,
} from "@/lib/edge-function-utils";

// ── Types ──────────────────────────────────────────────────────────

export interface WistiaVideoItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  source_url: string;
  playback_url: string;
  status: string;
  can_select: boolean;
}

interface WistiaListResponse {
  videos: WistiaVideoItem[];
  page: number;
  per_page: number;
  total: number; // -1 means "unknown total" (Wistia doesn't expose total)
}

// ── Hook ───────────────────────────────────────────────────────────

export function useWistiaVideos(params: {
  enabled: boolean;
  perPage?: number;
  query?: string;
  tenantId?: string;
}) {
  const perPage = params.perPage ?? 20;
  const queryClient = useQueryClient();

  const infiniteQuery = useInfiniteQuery({
    queryKey: ["wistia-videos", params.tenantId, perPage, params.query],
    queryFn: async ({ pageParam = 1 }): Promise<WistiaListResponse> => {
      const { data } = await invokeEdgeFunction<WistiaListResponse>("wistia-list-videos", {
        body: {
          tenant_id: params.tenantId,
          page: pageParam,
          per_page: perPage,
          query: params.query || undefined,
        },
      });
      return data;
    },
    getNextPageParam: (lastPage) => {
      // Wistia doesn't return total — use heuristic: if full page, likely more
      if (lastPage.total === -1) {
        return lastPage.videos.length === lastPage.per_page ? lastPage.page + 1 : undefined;
      }
      const totalPages = Math.ceil(lastPage.total / lastPage.per_page);
      return lastPage.page < totalPages ? lastPage.page + 1 : undefined;
    },
    initialPageParam: 1,
    enabled: params.enabled,
    staleTime: 60_000,
    retry: (failureCount, error) => {
      if (isNonRetryable(error)) return false;
      return failureCount < 1;
    },
  });

  // Invalidate integration query on non-retryable errors
  const errorUpdatedAt = infiniteQuery.errorUpdatedAt;
  useEffect(() => {
    if (errorUpdatedAt && infiniteQuery.isError && params.tenantId && isNonRetryable(infiniteQuery.error)) {
      queryClient.invalidateQueries({ queryKey: ["simple-integration", "wistia", params.tenantId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorUpdatedAt]);

  const videos = infiniteQuery.data?.pages.flatMap((p) => p.videos) ?? [];

  return {
    videos,
    isLoading: infiniteQuery.isLoading,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error ? parseEdgeFunctionError(infiniteQuery.error) : null,
    refetch: infiniteQuery.refetch,
    fetchNextPage: infiniteQuery.fetchNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
  };
}
