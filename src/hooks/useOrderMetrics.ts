import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { OrdersFilters } from "@/hooks/useOrders";
import { DEFAULT_ORDERS_FILTERS, hasActiveFilters } from "@/hooks/useOrders";

export interface OrderMetrics {
  totalOrders: number;
  revenueToday: number;
  revenueTotal: number;
}

const EMPTY: OrderMetrics = { totalOrders: 0, revenueToday: 0, revenueTotal: 0 };

export function useOrderMetrics(filters: OrdersFilters = DEFAULT_ORDERS_FILTERS) {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const filtered = hasActiveFilters(filters);

  const fetchMetrics = useCallback(async (): Promise<OrderMetrics> => {
    if (!tenantId) return EMPTY;

    const { data, error } = await supabase.rpc("get_order_metrics", {
      p_tenant_id: tenantId,
      ...(filtered
        ? {
            p_search: filters.search || undefined,
            p_source: filters.source.length > 0 ? filters.source.join(",") : undefined,
            p_status: filters.status.length > 0 ? filters.status.join(",") : undefined,
            p_product_id: filters.productId.length > 0 ? filters.productId.join(",") : undefined,
            p_start_at: filters.startAt || undefined,
            p_end_at: filters.endAt || undefined,
          }
        : {}),
    });

    if (error) throw error;

    const raw = data as {
      total_orders: number;
      revenue_today: number;
      revenue_total: number;
    };

    return {
      totalOrders: raw.total_orders,
      revenueToday: raw.revenue_today,
      revenueTotal: raw.revenue_total,
    };
  }, [tenantId, filters, filtered]);

  const { data: metrics = EMPTY, isPending } = useQuery({
    queryKey: ["order_metrics", tenantId, filters.search, filters.status, filters.productId, filters.source, filters.startAt, filters.endAt],
    queryFn: fetchMetrics,
    enabled: !!tenantId,
    staleTime: 30_000,
  });

  return {
    metrics,
    loading: isPending,
    filtered,
  };
}
