import { useCallback, useRef } from "react";
import { useInfiniteQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { Database } from "@/integrations/supabase/types";

type OrderType = Database["public"]["Enums"]["order_type"];
type OrderStatus = Database["public"]["Enums"]["order_status"];

export interface OrdersFilters {
  search: string;
  status: string[];
  productId: string[];
  source: string[];
  startAt: string | null;
  endAt: string | null;
}

export const DEFAULT_ORDERS_FILTERS: OrdersFilters = {
  search: "",
  status: [],
  productId: [],
  source: [],
  startAt: null,
  endAt: null,
};

export function hasActiveFilters(f: OrdersFilters): boolean {
  return (
    f.search !== "" ||
    f.status.length > 0 ||
    f.productId.length > 0 ||
    f.source.length > 0 ||
    f.startAt !== null ||
    f.endAt !== null
  );
}

export interface Order {
  id: string;
  public_id: string;
  tenant_id: string;
  customer_id: string;
  product_id: string;
  price_id: string | null;
  order_number: number | null;
  type: OrderType;
  status: OrderStatus;
  source: string;
  unit_amount: number;
  currency: string;
  is_order_bump: boolean;
  parent_gateway_external_id: string | null;
  gateway_external_id: string | null;
  gateway_order_created_at: string | null;
  effective_order_at: string;
  created_at: string;
  updated_at: string;
  // joined fields
  customer_name: string;
  customer_email: string;
  product_name: string;
  product_benefit: string | null;
}

const PAGE_SIZE = 50;

interface RpcRow {
  id: string;
  public_id: string;
  tenant_id: string;
  customer_id: string;
  product_id: string;
  price_id: string | null;
  order_number: number | null;
  type: OrderType;
  status: OrderStatus;
  source: string;
  unit_amount: number;
  currency: string;
  is_order_bump: boolean;
  parent_gateway_external_id: string | null;
  gateway_external_id: string | null;
  gateway_order_created_at: string | null;
  effective_order_at: string;
  created_at: string;
  updated_at: string;
  customer_name: string;
  customer_email: string;
  product_name: string;
  product_benefit: string | null;
  total_count: number;
}

interface PageResult {
  orders: Order[];
  totalCount: number;
  page: number;
}

function mapRow(o: RpcRow): Order {
  return {
    id: o.id,
    public_id: o.public_id,
    tenant_id: o.tenant_id,
    customer_id: o.customer_id,
    product_id: o.product_id,
    price_id: o.price_id,
    order_number: o.order_number,
    type: o.type,
    status: o.status,
    source: o.source ?? "hubfy",
    unit_amount: o.unit_amount,
    currency: o.currency,
    is_order_bump: o.is_order_bump ?? false,
    parent_gateway_external_id: o.parent_gateway_external_id,
    gateway_external_id: o.gateway_external_id,
    gateway_order_created_at: o.gateway_order_created_at,
    effective_order_at: o.effective_order_at,
    created_at: o.created_at,
    updated_at: o.updated_at,
    customer_name: o.customer_name,
    customer_email: o.customer_email,
    product_name: o.product_name,
    product_benefit: o.product_benefit,
  };
}

export function useOrders(filters: OrdersFilters = DEFAULT_ORDERS_FILTERS) {
  const { tenant, loading: tenantLoading } = useTenant();
  const tenantId = tenant?.id ?? null;

  const fetchPage = useCallback(
    async ({ pageParam = 0 }: { pageParam?: number }): Promise<PageResult> => {
      if (!tenantId) return { orders: [], totalCount: 0, page: pageParam };

      const { data, error } = await supabase.rpc("get_tenant_orders", {
        p_tenant_id: tenantId,
        p_search: filters.search || undefined,
        p_page: pageParam,
        p_page_size: PAGE_SIZE,
        p_source: filters.source.length > 0 ? filters.source.join(",") : undefined,
        p_status: filters.status.length > 0 ? filters.status.join(",") : undefined,
        p_product_id: filters.productId.length > 0 ? filters.productId.join(",") : undefined,
        p_start_at: filters.startAt || undefined,
        p_end_at: filters.endAt || undefined,
      });

      if (error) throw error;

      const rows = (data ?? []) as RpcRow[];
      const totalCount = rows.length > 0 ? Number(rows[0].total_count) : 0;

      return {
        orders: rows.map(mapRow),
        totalCount,
        page: pageParam,
      };
    },
    [tenantId, filters],
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
    queryKey: ["orders", tenantId, filters.search, filters.status, filters.productId, filters.source, filters.startAt, filters.endAt],
    queryFn: fetchPage,
    initialPageParam: 0,
    getNextPageParam: (lastPage) => {
      const loaded = (lastPage.page + 1) * PAGE_SIZE;
      return loaded < lastPage.totalCount ? lastPage.page + 1 : undefined;
    },
    enabled: !!tenantId,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });

  const allOrders = data?.pages.flatMap((p) => p.orders) ?? [];
  const totalCount = data?.pages[0]?.totalCount ?? 0;

  if (!queryPending && allOrders.length >= 0) {
    hasLoadedOnce.current = true;
  }

  const loading = tenantLoading || (!!tenantId && queryPending && !hasLoadedOnce.current);

  return {
    orders: allOrders,
    totalCount,
    loading,
    error: error as Error | null,
    fetchNextPage,
    hasNextPage: hasNextPage ?? false,
    isFetchingNextPage,
    refetch,
  };
}
