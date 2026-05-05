import { useEffect } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useTenant } from "@/hooks/useTenant";
import {
  invokeEdgeFunction,
  parseEdgeFunctionError,
  isNonRetryable,
  translateEdgeError,
  type EdgeFunctionErrorDetails,
} from "@/lib/edge-function-utils";

// ── Types ──────────────────────────────────────────────────────────

export interface VimeoIntegration {
  id: string;
  provider: string;
  status: string;
  account_name: string | null;
  account_external_id: string | null;
  account_url: string | null;
  avatar_url: string | null;
  last_validated_at: string | null;
  last_error: string | null;
}

export interface VimeoVideoItem {
  id: string;
  title: string;
  thumbnail_url: string | null;
  duration_seconds: number;
  source_url: string;
  playback_url: string;
  status: string;
  privacy_view: string;
  privacy_embed: string;
  project_name: string | null;
  can_select: boolean;
}

interface VimeoListResponse {
  videos: VimeoVideoItem[];
  page: number;
  per_page: number;
  total: number;
}

// ── Hook: Integration status ───────────────────────────────────────

export function useVimeoIntegration() {
  const { tenant } = useTenant();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const queryKey = ["vimeo-integration", tenant?.id];

  const { data: integration, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select("id, provider, status, account_name, account_external_id, account_url, avatar_url, last_validated_at, last_error")
        .eq("tenant_id", tenant.id)
        .eq("provider", "vimeo")
        .maybeSingle();

      if (error) throw error;
      return data as VimeoIntegration | null;
    },
    enabled: !!tenant?.id,
  });

  const connectMutation = useMutation({
    mutationFn: async (accessToken: string) => {
      if (!tenant?.id) throw new Error("Tenant não encontrado");
      const { data } = await invokeEdgeFunction("vimeo-connect", {
        body: { access_token: accessToken, tenant_id: tenant.id },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("integrations.vimeo.connected"));
    },
    onError: (err: Error) => {
      toast.error(translateEdgeError(err));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error("Tenant não encontrado");
      const { data } = await invokeEdgeFunction("vimeo-disconnect", {
        body: { tenant_id: tenant.id },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("integrations.vimeo.disconnected"));
    },
    onError: (err: Error) => {
      toast.error(translateEdgeError(err));
    },
  });

  return {
    integration,
    isLoading,
    isConnected: integration?.status === "active",
    connect: connectMutation.mutateAsync,
    disconnect: disconnectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
  };
}

// ── Hook: Video library (infinite scroll) ─────────────────────────

export function useVimeoVideos(params: {
  enabled: boolean;
  perPage?: number;
  query?: string;
  tenantId?: string;
}) {
  const perPage = params.perPage ?? 20;
  const queryClient = useQueryClient();

  const infiniteQuery = useInfiniteQuery({
    queryKey: ["vimeo-videos", params.tenantId, perPage, params.query],
    queryFn: async ({ pageParam = 1 }): Promise<VimeoListResponse> => {
      const { data } = await invokeEdgeFunction<VimeoListResponse>("vimeo-list-videos", {
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
      return failureCount < 1; // max 1 retry for 5xx / network
    },
  });

  // Invalidate integration query once when a non-retryable error appears
  const errorUpdatedAt = infiniteQuery.errorUpdatedAt;
  useEffect(() => {
    if (errorUpdatedAt && infiniteQuery.isError && params.tenantId && isNonRetryable(infiniteQuery.error)) {
      queryClient.invalidateQueries({ queryKey: ["vimeo-integration", params.tenantId] });
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
