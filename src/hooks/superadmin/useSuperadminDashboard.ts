import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface RevenueByDay {
  day: string;
  revenue: number;
}

interface TopTenant {
  id: string;
  name: string;
  slug: string;
  customers_count: number;
  orders_count: number;
  revenue: number;
}

interface RecentTenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

export interface SuperadminDashboardMetrics {
  totalTenants: number;
  totalCustomers: number;
  totalRevenue: number;
  totalMrr: number;
  revenueThisMonth: number;
  revenueLastMonth: number;
  growthPercent: number | null;
  ordersToday: number;
  newCustomersToday: number;
  revenueByDay: RevenueByDay[];
  topTenants: TopTenant[];
  recentTenants: RecentTenant[];
}

export function useSuperadminDashboard() {
  const fetchMetrics = useCallback(async (): Promise<SuperadminDashboardMetrics> => {
    const { data, error } = await supabase.rpc("get_superadmin_dashboard_metrics" as string);
    if (error) throw error;

    const raw = data as {
      total_tenants: number;
      total_customers: number;
      total_revenue: number;
      total_mrr: number;
      revenue_this_month: number;
      revenue_last_month: number;
      orders_today: number;
      new_customers_today: number;
      revenue_by_day: RevenueByDay[];
      top_tenants: TopTenant[];
      recent_tenants: RecentTenant[];
    };

    const growthPercent =
      raw.revenue_last_month === 0
        ? raw.revenue_this_month > 0
          ? 100
          : null
        : ((raw.revenue_this_month - raw.revenue_last_month) / raw.revenue_last_month) * 100;

    const revenueByDay = (raw.revenue_by_day ?? []).map((d) => {
      const date = new Date(d.day + "T12:00:00");
      return {
        day: date.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" }),
        revenue: d.revenue,
      };
    });

    return {
      totalTenants: raw.total_tenants,
      totalCustomers: raw.total_customers,
      totalRevenue: raw.total_revenue,
      totalMrr: raw.total_mrr,
      revenueThisMonth: raw.revenue_this_month,
      revenueLastMonth: raw.revenue_last_month,
      growthPercent: growthPercent !== null ? Math.round(growthPercent * 10) / 10 : null,
      ordersToday: raw.orders_today,
      newCustomersToday: raw.new_customers_today,
      revenueByDay,
      topTenants: raw.top_tenants ?? [],
      recentTenants: raw.recent_tenants ?? [],
    };
  }, []);

  const { data: metrics, isPending } = useQuery({
    queryKey: ["superadmin_dashboard_metrics"],
    queryFn: fetchMetrics,
    staleTime: 5 * 60_000,
    gcTime: 30 * 60_000,
    refetchOnWindowFocus: false,
  });

  return { metrics, loading: isPending };
}
