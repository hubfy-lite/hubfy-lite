import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import { limitNameLength } from "@/lib/name-limits";
import type { Customer, UpdateCustomerData } from "@/hooks/useCustomers";

export function useCustomerDetail(customerId: string | undefined) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? null;

  const { data: customer, isPending } = useQuery({
    queryKey: ["customer-detail", tenantId, customerId],
    queryFn: async (): Promise<Customer | null> => {
      if (!tenantId || !customerId) return null;

      const { data, error } = await supabase.rpc("get_tenant_customers", {
        p_tenant_id: tenantId,
      });

      if (error) throw error;

      const match = ((data ?? []) as Customer[]).find(
        (c) => c.public_id === customerId
      );

      if (!match) return null;

      return {
        ...match,
        name: limitNameLength(match.name),
      };
    },
    enabled: !!tenantId && !!customerId,
  });

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({
      queryKey: ["customer-detail", tenantId, customerId],
    });
    queryClient.invalidateQueries({
      queryKey: ["tenant-customers", tenantId],
    });
  }, [queryClient, tenantId, customerId]);

  const updateCustomer = useCallback(
    async (userId: string, data: UpdateCustomerData) => {
      if (!tenantId) throw new Error("No tenant");

      const { error } = await supabase.rpc("update_tenant_customer", {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_name: data.name ? limitNameLength(data.name.trim()) : undefined,
        p_first_name: data.first_name ?? undefined,
        p_last_name: data.last_name ?? undefined,
        p_phone: data.phone ?? undefined,
        p_city: data.city ?? undefined,
        p_region: data.region ?? undefined,
        p_country: data.country ?? undefined,
        p_document_type: data.document_type ?? undefined,
        p_document: data.document ?? undefined,
        p_email_marketing_status: data.email_marketing_status ?? undefined,
      });

      if (error) throw error;
      invalidate();
    },
    [tenantId, invalidate]
  );

  const removeCustomer = useCallback(
    async (userId: string) => {
      if (!tenantId) throw new Error("No tenant");

      const { error } = await supabase.rpc("delete_tenant_customer", {
        p_tenant_id: tenantId,
        p_user_id: userId,
      });

      if (error) throw error;
      invalidate();
    },
    [tenantId, invalidate]
  );

  return {
    customer: customer ?? null,
    isPending,
    updateCustomer,
    removeCustomer,
  };
}
