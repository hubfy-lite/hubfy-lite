import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CustomerProduct {
  product_id: string;
  product_name: string;
  product_cover_url: string | null;
  product_updated_at: string | null;
  product_benefit: string | null;
  order_id: string;
  order_status: string;
  order_created_at: string;
  unit_amount: number;
  currency: string;
}

export function useCustomerProducts() {
  return useQuery({
    queryKey: ["portal-purchased-products"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_customer_purchased_products"
      );
      if (error) throw error;
      return (data ?? []) as CustomerProduct[];
    },
    staleTime: 60_000,
  });
}
