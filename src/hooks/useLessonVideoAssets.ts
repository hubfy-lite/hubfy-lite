import { useCallback } from "react";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AssetWithVideo = Database["public"]["Tables"]["assets"]["Row"] & {
  asset_videos: Database["public"]["Tables"]["asset_videos"]["Row"] | null;
};

const PAGE_SIZE = 60;

// ── Infinite gallery of video assets ──────────────────────────────

export function useLessonVideoAssets(tenantId: string, search: string) {
  const fetchPage = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }): Promise<AssetWithVideo[]> => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;

      let query = supabase
        .from("assets")
        .select("*, asset_videos(*)")
        .eq("tenant_id", tenantId)
        .eq("type", "video")
        .eq("status", "ready")
        .order("created_at", { ascending: false })
        .range(from, to);

      if (search.trim()) {
        query = query.ilike("title", `%${search.trim()}%`);
      }

      const { data, error } = await query;
      if (error) throw error;

      return (data ?? []).map((a) => ({
        ...a,
        asset_videos: Array.isArray(a.asset_videos)
          ? a.asset_videos[0] ?? null
          : a.asset_videos,
      })) as AssetWithVideo[];
    },
    [tenantId, search]
  );

  const query = useInfiniteQuery({
    queryKey: ["lesson-video-assets", tenantId, search],
    queryFn: fetchPage,
    getNextPageParam: (lastPage, _allPages, lastPageParam) =>
      lastPage.length === PAGE_SIZE ? (lastPageParam as number) + 1 : undefined,
    initialPageParam: 0,
    staleTime: 60_000,
  });

  const assets = query.data?.pages.flatMap((p) => p) ?? [];

  return {
    assets,
    isLoading: query.isLoading,
    fetchNextPage: query.fetchNextPage,
    hasNextPage: query.hasNextPage,
    isFetchingNextPage: query.isFetchingNextPage,
  };
}

// ── Pinned (selected) asset ───────────────────────────────────────

export function usePinnedAsset(selectedVideoAssetId: string | null) {
  return useQuery({
    queryKey: ["lesson-pinned-asset", selectedVideoAssetId],
    enabled: !!selectedVideoAssetId,
    staleTime: 120_000,
    queryFn: async (): Promise<AssetWithVideo | null> => {
      const { data } = await supabase
        .from("assets")
        .select("*, asset_videos(*)")
        .eq("id", selectedVideoAssetId!)
        .eq("type", "video")
        .eq("status", "ready")
        .single();

      if (!data) return null;

      return {
        ...data,
        asset_videos: Array.isArray(data.asset_videos)
          ? data.asset_videos[0] ?? null
          : data.asset_videos,
      } as AssetWithVideo;
    },
  });
}

/** Pre-fill the pinned asset cache so the component doesn't flash on selection. */
export function usePrefillPinnedAsset() {
  const queryClient = useQueryClient();
  return (asset: AssetWithVideo) => {
    queryClient.setQueryData(["lesson-pinned-asset", asset.id], asset);
  };
}
