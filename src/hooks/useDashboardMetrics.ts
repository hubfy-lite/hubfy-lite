import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";

interface RevenueByDay {
  day: string;
  revenue: number;
}

interface RevenueByMethod {
  method: string;
  revenue: number;
}

export interface RecentSale {
  id: string;
  customer_name: string;
  customer_email: string;
  product_name: string;
  unit_amount: number;
  status: string;
  effective_order_at: string;
}

export interface TopProduct {
  product_name: string;
  sales_count: number;
  revenue: number;
}

export interface DashboardMetrics {
  revenueTotal: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  ordersCount: number;
  growthPercent: number | null;
  revenueByDay: RevenueByDay[];
  revenueByPaymentMethod: RevenueByMethod[];
  recentSales: RecentSale[];
  topProducts: TopProduct[];
  onboarding: {
    hasProduct: boolean;
    hasCourse: boolean;
    hasDesignCustomized: boolean;
  };
}

export function useDashboardMetrics() {
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;

  const fetchMetrics = useCallback(async (): Promise<DashboardMetrics> => {
    if (!tenantId) {
      return {
        revenueTotal: 0,
        revenueThisMonth: 0,
        revenueLastMonth: 0,
        ordersCount: 0,
        growthPercent: null,
        revenueByDay: [],
        revenueByPaymentMethod: [],
        recentSales: [],
        topProducts: [],
        onboarding: { hasProduct: false, hasCourse: false, hasDesignCustomized: false },
      };
    }

    const { data, error } = await supabase.rpc("get_dashboard_metrics", {
      p_tenant_id: tenantId,
    });

    if (error) throw error;

    const raw = data as {
      revenue_total: number;
      revenue_this_month: number;
      revenue_last_month: number;
      orders_count: number;
      revenue_by_day: Array<{ day: string; revenue: number }>;
      revenue_by_payment_method: Array<{ method: string; revenue: number }>;
      recent_sales: RecentSale[];
      top_products: TopProduct[];
      products_count: number;
      courses_count: number;
    };

    const revenueByDay = (raw.revenue_by_day ?? []).map((d) => {
      const date = new Date(d.day + "T12:00:00");
      return {
        day: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        revenue: d.revenue,
      };
    });

    const growthPercent =
      raw.revenue_last_month === 0
        ? raw.revenue_this_month > 0
          ? 100
          : null
        : ((raw.revenue_this_month - raw.revenue_last_month) / raw.revenue_last_month) * 100;

    return {
      revenueTotal: raw.revenue_total,
      revenueThisMonth: raw.revenue_this_month,
      revenueLastMonth: raw.revenue_last_month,
      ordersCount: raw.orders_count,
      growthPercent: growthPercent !== null ? Math.round(growthPercent * 10) / 10 : null,
      revenueByDay,
      revenueByPaymentMethod: raw.revenue_by_payment_method ?? [],
      recentSales: raw.recent_sales ?? [],
      topProducts: raw.top_products ?? [],
      onboarding: {
        hasProduct: raw.products_count > 0,
        hasCourse: raw.courses_count > 0,
        hasDesignCustomized: !!(tenant?.icon_url || tenant?.primary_color),
      },
    };
  }, [tenantId, tenant?.icon_url, tenant?.primary_color]);

  const { data: metrics, isPending } = useQuery({
    queryKey: ["dashboard_metrics", tenantId],
    queryFn: fetchMetrics,
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  return { metrics, loading: isPending };
}
