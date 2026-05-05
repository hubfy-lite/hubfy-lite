import {
  useInfiniteQuery,
  useQuery,
  useMutation,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import { useTenant } from "@/hooks/useTenant";

/* ─── Tipos ─── */

export type WebhookLogStatus =
  | "received"
  | "processing"
  | "processed"
  | "failed"
  | "ignored"
  | "duplicate"
  | "unauthorized"
  | "invalid_payload";

export interface GatewayWebhookLog {
  id: string;
  tenant_id: string | null;
  gateway_id: string | null;
  provider: string;
  event_type: string | null;
  external_event_type: string | null;
  external_order_id: string | null;
  external_offer_id: string | null;
  buyer_email: string | null;
  status: WebhookLogStatus;
  error_message: string | null;
  retry_count: number;
  processed_at: string | null;
  created_at: string;
}

export interface GatewayWebhookLogDetails {
  id: string;
  raw_payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
}

export interface GatewayLogsFilters {
  status?: WebhookLogStatus | "";
  email?: string;
}

interface GatewayLogsPageCursor {
  created_at: string;
  id: string;
}

interface GatewayLogsPage {
  items: GatewayWebhookLog[];
  nextCursor: GatewayLogsPageCursor | null;
}

interface UseGatewayLogsOptions {
  enabled?: boolean;
}

const PAGE_SIZE = 50;
const LIST_COLUMNS =
  "id, tenant_id, gateway_id, provider, event_type, external_event_type, external_order_id, external_offer_id, buyer_email, status, error_message, retry_count, processed_at, created_at";

/* ─── Hook ─── */

export function useGatewayLogs(
  filters: GatewayLogsFilters = {},
  options: UseGatewayLogsOptions = {},
) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? null;
  const isEnabled = options.enabled ?? true;

  const normalizedEmail = (filters.email ?? "").trim().toLowerCase();
  const normalizedStatus = filters.status ?? "";

  const queryKey = ["gateway-webhook-logs", tenantId, normalizedStatus, normalizedEmail];

  const {
    data,
    isPending,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery<
    GatewayLogsPage,
    Error,
    InfiniteData<GatewayLogsPage>,
    (string | null)[],
    GatewayLogsPageCursor | null
  >({
    queryKey,
    enabled: !!tenantId && isEnabled,
    initialPageParam: null,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async ({ pageParam }) => {
      if (!tenantId) return { items: [], nextCursor: null };

      let query = supabase
        .from("gateway_events")
        .select(LIST_COLUMNS)
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .order("id", { ascending: false })
        .limit(PAGE_SIZE + 1);

      if (normalizedStatus) {
        query = query.eq("status", normalizedStatus);
      }

      if (normalizedEmail) {
        query = query.ilike("buyer_email", `%${normalizedEmail}%`);
      }

      if (pageParam) {
        query = query.or(
          `created_at.lt.${pageParam.created_at},and(created_at.eq.${pageParam.created_at},id.lt.${pageParam.id})`,
        );
      }

      const { data, error } = await query;
      if (error) throw error;

      const rows = (data ?? []) as GatewayWebhookLog[];
      const hasMore = rows.length > PAGE_SIZE;
      const items = hasMore ? rows.slice(0, PAGE_SIZE) : rows;
      const lastItem = items.at(-1);

      return {
        items,
        nextCursor:
          hasMore && lastItem
            ? {
                created_at: new Date(lastItem.created_at).toISOString(),
                id: lastItem.id,
              }
            : null,
      };
    },
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });

  const logs = useMemo(
    () => data?.pages.flatMap((page) => page.items) ?? [],
    [data],
  );

  // ── Reprocessar evento com falha via gateway-reprocess ──
  const reprocessLog = useMutation({
    mutationFn: async (logId: string) => {
      await invokeEdgeFunction("gateway-reprocess", {
        body: { event_id: logId },
      });
      return logId;
    },
    onSuccess: (logId) => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({
        queryKey: ["gateway-webhook-log-details", tenantId, logId],
      });
    },
  });

  return {
    logs,
    isLoading: isPending,
    refreshLogs: refetch,
    isRefreshing: isRefetching,
    fetchNextPage,
    hasNextPage: Boolean(hasNextPage),
    isFetchingNextPage,
    reprocessLog,
  };
}

export function useGatewayLogDetails(logId: string, enabled = false) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;

  return useQuery<GatewayWebhookLogDetails | null>({
    queryKey: ["gateway-webhook-log-details", tenantId, logId],
    enabled: !!tenantId && !!logId && enabled,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    queryFn: async () => {
      if (!tenantId || !logId) return null;

      const { data, error } = await supabase
        .from("gateway_events")
        .select("id, raw_payload, result, error_message")
        .eq("tenant_id", tenantId)
        .eq("id", logId)
        .maybeSingle();

      if (error) throw error;
      return (data ?? null) as GatewayWebhookLogDetails | null;
    },
  });
}
