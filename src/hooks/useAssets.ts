import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "./useTenant";
import { useUploadContext } from "@/contexts/UploadContext";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;

type Asset = Database["public"]["Tables"]["assets"]["Row"];
type AssetType = Database["public"]["Enums"]["asset_type"];
type AssetStatus = Database["public"]["Enums"]["asset_status"];

export type AssetWithDetails = Asset & {
  asset_files: Database["public"]["Tables"]["asset_files"]["Row"] | null;
  asset_videos: Database["public"]["Tables"]["asset_videos"]["Row"] | null;
};

type SortField = "title" | "created_at";
type SortOrder = "asc" | "desc";

export interface UploadingAsset {
  id: string;
  title: string;
  type: AssetType;
  status: AssetStatus;
  progress: number;
  created_at: string;
  error?: string;
}

export const ASSETS_PAGE_SIZE = 50;

// Realtime + fallback sync settings
const REALTIME_INVALIDATE_DEBOUNCE_MS = 500;
const FALLBACK_SYNC_MS = 45_000; // only when processing/uploading and realtime is stale
const STALE_REALTIME_MS = 30_000;

export function useAssets(folderId?: string | null) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const { uploads, startUpload } = useUploadContext();

  // Filters and sorting state
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<AssetType | "all">("all");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortOrder, setSortOrder] = useState<SortOrder>("desc");

  // Pagination
  const [page, setPage] = useState(0);

  // Reset to page 0 when any filter or folder changes
  useEffect(() => {
    setPage(0);
  }, [search, typeFilter, sortField, sortOrder, folderId]);

  // Upload via global context
  const uploadInputRef = useRef<HTMLInputElement>(null);
  const trackedAssetIdsRef = useRef<Set<string>>(new Set());
  const lastRealtimeEventAtRef = useRef<number>(Date.now());
  const invalidateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const queryKey = ["assets", tenant?.id, search, typeFilter, sortField, sortOrder, folderId ?? "all", page];

  const fetchAssets = useCallback(async (): Promise<{ items: AssetWithDetails[]; total: number }> => {
    if (!tenant?.id) return { items: [], total: 0 };

    const offset = page * ASSETS_PAGE_SIZE;

    let query = supabase
      .from("assets")
      .select(
        `*,
        asset_files(object_path, bucket, original_filename, public_url),
        asset_videos(gumlet_asset_id, thumbnail_url, progress_pct, subtitles_status)`,
        { count: "exact" }
      )
      .eq("tenant_id", tenant.id)
      .neq("status", "deleted");

    if (search.trim()) {
      query = query.ilike("title", `%${search.trim()}%`);
    }

    if (typeFilter !== "all") {
      query = query.eq("type", typeFilter);
    }

    // Folder filter: undefined = all, null = no folder, string = specific folder
    if (folderId === null) {
      query = query.is("folder_id", null);
    } else if (folderId !== undefined) {
      query = query.eq("folder_id", folderId);
    }

    query = query
      .order(sortField, { ascending: sortOrder === "asc" })
      .range(offset, offset + ASSETS_PAGE_SIZE - 1);

    const { data, error, count } = await query;

    if (error) throw error;

    return {
      items: (data ?? []).map((a) => ({
        ...a,
        asset_files: Array.isArray(a.asset_files) ? a.asset_files[0] ?? null : a.asset_files,
        asset_videos: Array.isArray(a.asset_videos) ? a.asset_videos[0] ?? null : a.asset_videos,
      })),
      total: count ?? 0,
    };
  }, [tenant?.id, search, typeFilter, sortField, sortOrder, folderId, page]);

  const {
    data: queryResult = { items: [], total: 0 },
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: fetchAssets,
    enabled: !!tenant?.id,
    staleTime: 30_000,
    placeholderData: (prev) => prev, // keep previous page visible while loading next
  });

  const assets = queryResult?.items ?? [];
  const totalCount = queryResult?.total ?? 0;
  const totalPages = Math.ceil(totalCount / ASSETS_PAGE_SIZE);

  useEffect(() => {
    trackedAssetIdsRef.current = new Set(assets.map((a) => a.id));
  }, [assets]);

  const invalidateAssetsQueries = useCallback(() => {
    if (!tenant?.id) return;
    lastRealtimeEventAtRef.current = Date.now();
    if (invalidateTimeoutRef.current) return;
    invalidateTimeoutRef.current = setTimeout(() => {
      invalidateTimeoutRef.current = null;
      queryClient.invalidateQueries({ queryKey: ["assets", tenant.id] });
      queryClient.invalidateQueries({ queryKey: ["asset_folders", tenant.id] });
    }, REALTIME_INVALIDATE_DEBOUNCE_MS);
  }, [queryClient, tenant?.id]);

  useEffect(() => {
    if (!tenant?.id) return;

    const channel = supabase
      .channel(`assets-live-${tenant.id}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "assets",
          filter: `tenant_id=eq.${tenant.id}`,
        },
        () => {
          invalidateAssetsQueries();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "asset_videos",
        },
        (payload) => {
          const row = (payload.new ?? payload.old) as { asset_id?: string } | null;
          if (!row?.asset_id) return;
          if (!trackedAssetIdsRef.current.has(row.asset_id)) return;
          invalidateAssetsQueries();
        }
      )
      .subscribe();

    return () => {
      if (invalidateTimeoutRef.current) {
        clearTimeout(invalidateTimeoutRef.current);
        invalidateTimeoutRef.current = null;
      }
      supabase.removeChannel(channel);
    };
  }, [tenant?.id, invalidateAssetsQueries]);

  // Realtime-first flow: keep minimal fallback sync while there are in-flight assets.
  const hasProcessingAssets = useMemo(() => {
    return assets.some((a) => a.status === "processing");
  }, [assets]);

  const hasUploadingAssets = useMemo(() => {
    return assets.some((a) => a.status === "uploading");
  }, [assets]);

  // Fallback path for stalled updates (webhook/realtime issues)
  const pollGumletProgress = useCallback(async () => {
    if (!tenant?.id) return;
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      await fetch(
        `${SUPABASE_URL}/functions/v1/hosting-poll-progress`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ tenant_id: tenant.id }),
        }
      );
    } catch (err) {
      console.error("Poll progress error:", err);
    }
  }, [tenant?.id]);

  useEffect(() => {
    if (!hasProcessingAssets && !hasUploadingAssets) return;
    const interval = setInterval(async () => {
      const msSinceRealtime = Date.now() - lastRealtimeEventAtRef.current;
      if (msSinceRealtime < STALE_REALTIME_MS) return;

      // Poll the hosting backend whenever there are uploading OR processing
      // assets — uploading covers the case where the webhook didn't fire and
      // the asset would otherwise be stuck forever.
      if (hasProcessingAssets || hasUploadingAssets) {
        await pollGumletProgress();
      }
      await refetch();
    }, FALLBACK_SYNC_MS);
    return () => clearInterval(interval);
  }, [hasProcessingAssets, hasUploadingAssets, refetch, pollGumletProgress]);

  // Upload — delegates to global UploadContext
  const triggerUpload = () => uploadInputRef.current?.click();

  const handleFileSelect = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file) return;
      event.target.value = "";
      startUpload(file, folderId);
    },
    [startUpload, folderId]
  );

  // Map global uploads to UploadingAsset format for the asset list.
  // Keep "ready" uploads visible until the DB asset appears (avoids blink).
  const dbAssetIds = useMemo(() => new Set(assets.map((a) => a.id)), [assets]);

  const uploadingAssets: UploadingAsset[] = uploads
    .filter((u) => {
      if (u.status === "failed") return false;
      // Hide once the real DB asset is in the query results — from that point
      // the DB row is the source of truth and drives status/thumbnail/etc.
      if (u.realAssetId && dbAssetIds.has(u.realAssetId)) return false;
      return true;
    })
    .map((u) => ({
      id: u.id,
      title: u.title,
      type: u.type,
      status: u.status === "failed" ? ("failed" as AssetStatus) : (u.status as AssetStatus),
      progress: u.progress,
      created_at: new Date().toISOString(),
    }));

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({
      assetId,
      title,
      description,
    }: {
      assetId: string;
      title: string;
      description: string | null;
    }) => {
      const { error } = await supabase
        .from("assets")
        .update({ title: title.trim(), description: description?.trim() ?? null })
        .eq("id", assetId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Arquivo atualizado!");
      queryClient.invalidateQueries({ queryKey: ["assets", tenant?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao atualizar: ${error.message}`);
    },
  });

  const updateAsset = useCallback(
    (assetId: string, title: string, description: string | null) => {
      updateMutation.mutate({ assetId, title, description });
    },
    [updateMutation]
  );

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (assetId: string) => {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("No auth token");

      const res = await fetch(
        `${SUPABASE_URL}/functions/v1/asset-delete`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ asset_id: assetId }),
        }
      );

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to delete asset");
      }

      return res.json();
    },
    onSuccess: () => {
      toast.success("Arquivo deletado com sucesso");
      queryClient.invalidateQueries({ queryKey: ["assets", tenant?.id] });
      queryClient.invalidateQueries({ queryKey: ["asset_folders", tenant?.id] });
    },
    onError: (error: Error) => {
      toast.error(`Erro ao deletar: ${error.message}`);
    },
  });

  const deleteAsset = useCallback((assetId: string) => {
    deleteMutation.mutate(assetId);
  }, [deleteMutation]);

  // Combined list: uploading + db assets
  const allAssets: (AssetWithDetails | UploadingAsset)[] = [
    ...uploadingAssets,
    ...assets,
  ];

  return {
    assets: allAssets,
    dbAssets: assets,
    uploadingAssets,
    isLoading,
    error: error as Error | null,
    refetch,

    // Filters
    search,
    setSearch,
    typeFilter,
    setTypeFilter,
    sortField,
    setSortField,
    sortOrder,
    setSortOrder,

    // Pagination
    page,
    setPage,
    totalCount,
    totalPages,
    pageSize: ASSETS_PAGE_SIZE,

    // Upload (unified, single file)
    uploadInputRef,
    triggerUpload,
    handleFileSelect,

    // Update
    updateAsset,
    isUpdating: updateMutation.isPending,

    // Delete
    deleteAsset,
    isDeleting: deleteMutation.isPending,
  };
}
