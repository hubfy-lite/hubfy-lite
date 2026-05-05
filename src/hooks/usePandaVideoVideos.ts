import { useEffect } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  invokeEdgeFunction,
  parseEdgeFunctionError,
  isNonRetryable,
} from "@/lib/edge-function-utils";

// ── Types ──────────────────────────────────────────────────────────

export interface PandaVideoItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  source_url: string;
  playback_url: string;
  status: string;
  can_select: boolean;
}

interface PandaVideoListResponse {
  videos: PandaVideoItem[];
  page: number;
  per_page: number;
  total: number;
}

// ── Hook ───────────────────────────────────────────────────────────

export function usePandaVideoVideos(params: {
  enabled: boolean;
  perPage?: number;
  query?: string;
  tenantId?: string;
}) {
  const perPage = params.perPage ?? 20;
  const queryClient = useQueryClient();

  const infiniteQuery = useInfiniteQuery({
    queryKey: ["pandavideo-videos", params.tenantId, perPage, params.query],
    queryFn: async ({ pageParam = 1 }): Promise<PandaVideoListResponse> => {
      const { data } = await invokeEdgeFunction<PandaVideoListResponse>("pandavideo-list-videos", {
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
      queryClient.invalidateQueries({ queryKey: ["simple-integration", "pandavideo", params.tenantId] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [errorUpdatedAt]);

  const videos = infiniteQuery.data?.pages.flatMap((p) => p.videos) ?? [];
  const total = infiniteQuery.data?.pages[0]?.total ?? 0;

  return {
    videos,
    total,
    isLoading: infiniteQuery.isLoading,
    isError: infiniteQuery.isError,
    error: infiniteQuery.error ? parseEdgeFunctionError(infiniteQuery.error) : null,
    refetch: infiniteQuery.refetch,
    fetchNextPage: infiniteQuery.fetchNextPage,
    hasNextPage: infiniteQuery.hasNextPage,
    isFetchingNextPage: infiniteQuery.isFetchingNextPage,
  };
}
