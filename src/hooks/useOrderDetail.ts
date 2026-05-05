import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import type { Database } from "@/integrations/supabase/types";

type OrderType = Database["public"]["Enums"]["order_type"];
type OrderStatus = Database["public"]["Enums"]["order_status"];
type SubscriptionStatus = Database["public"]["Enums"]["subscription_status"];

export interface OrderDetail {
  id: string;
  public_id: string | null;
  tenant_id: string;
  customer_id: string;
  customer_public_id: string | null;
  product_id: string;
  product_public_id: string | null;
  price_id: string | null;
  order_number: number | null;
  is_order_bump: boolean;
  type: OrderType;
  status: OrderStatus;
  source: string;
  subscription_status: SubscriptionStatus | null;
  unit_amount: number;
  currency: string;
  gateway_order_created_at: string | null;
  effective_order_at: string;
  created_at: string;
  updated_at: string;
  // payment
  payment_method: string;
  gateway_external_id: string | null;
  // joined: customer
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  customer_city: string | null;
  customer_region: string | null;
  customer_country: string | null;
  customer_document: string | null;
  customer_document_type: string | null;
  // joined: product
  product_name: string;
  product_benefit: string | null;
  product_cover_url: string | null;
}

interface OrderDetailRow {
  id: string;
  public_id: string | null;
  tenant_id: string;
  customer_id: string;
  product_id: string;
  price_id: string | null;
  order_number: number | null;
  is_order_bump: boolean | null;
  type: OrderType;
  status: OrderStatus;
  source: string | null;
  subscription_status: SubscriptionStatus | null;
  unit_amount: number;
  currency: string;
  gateway_order_created_at: string | null;
  created_at: string;
  updated_at: string;
  payment_method: string;
  gateway_external_id: string | null;
  customers: {
    public_id: string | null;
    name: string;
    email: string;
    phone: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
    document: string | null;
    document_type: string | null;
  } | null;
  products: {
    public_id: string | null;
    name: string;
    benefit: string | null;
    cover_url: string | null;
  } | null;
}

export function useOrderDetail(orderId: string | undefined) {
  const { tenant, loading: tenantLoading } = useTenant();
  const tenantId = tenant?.id ?? null;

  const { data: order, isPending, error } = useQuery({
    queryKey: ["order-detail", tenantId, orderId],
    queryFn: async (): Promise<OrderDetail | null> => {
      if (!tenantId || !orderId) return null;

      const { data, error } = await supabase
        .from("orders")
        .select(
          "*, customers!orders_customer_id_fkey(public_id, name, email, phone, city, region, country, document, document_type), products!orders_product_id_fkey(public_id, name, benefit, cover_url)"
        )
        .eq("public_id", orderId)
        .eq("tenant_id", tenantId)
        .single();

      if (error) throw error;
      if (!data) return null;

      const o = data as unknown as OrderDetailRow;
      return {
        id: o.id,
        public_id: o.public_id ?? null,
        tenant_id: o.tenant_id,
        customer_id: o.customer_id,
        customer_public_id: o.customers?.public_id ?? null,
        product_id: o.product_id,
        product_public_id: o.products?.public_id ?? null,
        price_id: o.price_id,
        order_number: o.order_number,
        is_order_bump: o.is_order_bump ?? false,
        type: o.type,
        status: o.status,
        source: o.source ?? "hubfy",
        subscription_status: o.subscription_status ?? null,
        unit_amount: o.unit_amount,
        currency: o.currency,
        gateway_order_created_at: o.gateway_order_created_at ?? null,
        effective_order_at: o.gateway_order_created_at ?? o.created_at,
        created_at: o.created_at,
        updated_at: o.updated_at,
        payment_method: o.payment_method ?? "free",
        gateway_external_id: o.gateway_external_id ?? null,
        customer_name: o.customers?.name ?? o.customers?.email ?? "",
        customer_email: o.customers?.email ?? "",
        customer_phone: o.customers?.phone ?? null,
        customer_city: o.customers?.city ?? null,
        customer_region: o.customers?.region ?? null,
        customer_country: o.customers?.country ?? null,
        customer_document: o.customers?.document ?? null,
        customer_document_type: o.customers?.document_type ?? null,
        product_name: o.products?.name ?? "",
        product_benefit: o.products?.benefit ?? null,
        product_cover_url: o.products?.cover_url ?? null,
      };
    },
    enabled: !!tenantId && !!orderId,
    staleTime: 10_000,
  });

  const loading = tenantLoading || (!!tenantId && !!orderId && isPending);

  return { order: order ?? null, loading, error: error as Error | null };
}
