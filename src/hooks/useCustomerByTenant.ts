import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PortalCustomer {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  email: string;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  email_marketing_status: string | null;
  total_revenue_cents: number;
  mrr_cents: number;
  currency: string;
  created_at: string;
}

export function useCustomerByTenant(tenantId: string | undefined) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["portal-customer", tenantId, user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("tenant_id", tenantId!)
        .eq("user_id", user!.id)
        .maybeSingle();

      if (error) throw error;
      return data as PortalCustomer | null;
    },
    enabled: !!tenantId && !!user,
    staleTime: 30_000,
  });
}
