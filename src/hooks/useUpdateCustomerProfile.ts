import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface UpdateProfileInput {
  name?: string;
  phone?: string;
  city?: string;
  region?: string;
  country?: string;
}

export function useUpdateCustomerProfile(tenantId: string | undefined) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: UpdateProfileInput) => {
      const { error } = await supabase.rpc("update_customer_profile", {
        p_name: input.name ?? null,
        p_phone: input.phone ?? null,
        p_city: input.city ?? null,
        p_region: input.region ?? null,
        p_country: input.country ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      // Invalida o cache do customer para refletir as mudanças
      queryClient.invalidateQueries({ queryKey: ["portal-customer", tenantId] });
    },
  });
}
