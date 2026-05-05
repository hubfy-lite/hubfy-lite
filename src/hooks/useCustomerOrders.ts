import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerOrder {
  id: string;
  product_id: string;
  customer_id: string;
  status: string;
  unit_amount: number;
  currency: string;
  payment_method: string | null;
  gateway_order_created_at: string | null;
  effective_order_at: string;
  created_at: string;
  product: {
    name: string;
    cover_url: string | null;
  } | null;
}

interface CustomerOrderRow extends Omit<CustomerOrder, "effective_order_at"> {}

export function useCustomerOrders(customerId: string | undefined) {
  return useQuery({
    queryKey: ["portal-orders", customerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, product_id, customer_id, status, unit_amount, currency, payment_method, gateway_order_created_at, created_at, source, product:products(name, cover_url)")
        .eq("customer_id", customerId!)
        .neq("source", "csv_import")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const orders = ((data ?? []) as CustomerOrderRow[])
        .map((order) => ({
          ...order,
          effective_order_at: order.gateway_order_created_at ?? order.created_at,
        }))
        .sort((a, b) => {
          const timeDiff =
            new Date(b.effective_order_at).getTime() -
            new Date(a.effective_order_at).getTime();

          if (timeDiff !== 0) return timeDiff;
          return b.id.localeCompare(a.id);
        });

      return orders;
    },
    enabled: !!customerId,
    staleTime: 30_000,
  });
}
