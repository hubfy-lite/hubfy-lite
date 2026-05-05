import { useState, useCallback, useRef } from "react";
import { useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import { useTenant } from "@/hooks/useTenant";
import { getPublicSiteUrl } from "@/lib/public-site-url";
import { limitNameLength } from "@/lib/name-limits";

export interface Customer {
  id: string;
  public_id: string;
  user_id: string;
  email: string;
  name: string;
  first_name: string | null;
  last_name: string | null;
  document_type: string | null;
  document: string | null;
  avatar_url: string | null;
  phone: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  email_marketing_status: string;
  total_revenue_cents: number;
  mrr_cents: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface AddCustomerData {
  email: string;
  name: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  city?: string;
  region?: string;
  country?: string;
  document_type?: string;
  document?: string;
}

export interface UpdateCustomerData {
  name?: string;
  first_name?: string;
  last_name?: string;
  phone?: string;
  city?: string;
  region?: string;
  country?: string;
  document_type?: string;
  document?: string;
  email_marketing_status?: string;
}

export function useCustomers(searchQuery = "") {
  const { tenant, loading: tenantLoading } = useTenant();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);

  const tenantId = tenant?.id ?? null;

  const queryKey = ["tenant-customers", tenantId, searchQuery];

  const fetchCustomers = useCallback(async (): Promise<Customer[]> => {
    if (!tenantId) return [];

    const { data, error } = await supabase.rpc("get_tenant_customers", {
      p_tenant_id: tenantId,
      p_search: searchQuery || undefined,
    });

    if (error) throw error;
    return ((data ?? []) as Customer[]).map((customer) => ({
      ...customer,
      name: limitNameLength(customer.name),
    }));
  }, [tenantId, searchQuery]);

  const hasLoadedOnce = useRef(false);

  const {
    data: customers = [],
    isPending: queryPending,
    error,
    refetch,
  } = useQuery({
    queryKey,
    queryFn: fetchCustomers,
    enabled: !!tenantId,
    staleTime: 10_000,
    placeholderData: keepPreviousData,
  });

  if (!queryPending && customers.length >= 0) {
    hasLoadedOnce.current = true;
  }

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["tenant-customers", tenantId] });
  };

  const addCustomer = async (data: AddCustomerData) => {
    if (!tenantId) throw new Error("No tenant");
    setActionLoading(true);
    try {
      const { data: result } = await invokeEdgeFunction("add-customer", {
        body: {
          ...data,
          name: limitNameLength(data.name.trim()),
          tenant_id: tenantId,
          origin: getPublicSiteUrl(),
        },
      });

      invalidate();
      return result;
    } finally {
      setActionLoading(false);
    }
  };

  const updateCustomer = async (userId: string, data: UpdateCustomerData) => {
    if (!tenantId) throw new Error("No tenant");
    setActionLoading(true);
    try {
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
    } finally {
      setActionLoading(false);
    }
  };

  const removeCustomer = async (userId: string) => {
    if (!tenantId) throw new Error("No tenant");
    setActionLoading(true);
    try {
      const { error } = await supabase.rpc("delete_tenant_customer", {
        p_tenant_id: tenantId,
        p_user_id: userId,
      });

      if (error) throw error;
      invalidate();
    } finally {
      setActionLoading(false);
    }
  };

  // Skeleton only on first load; subsequent navigations keep previous data visible
  const loading = tenantLoading || (!!tenantId && queryPending && !hasLoadedOnce.current);

  return {
    customers,
    loading,
    actionLoading,
    error: error as Error | null,
    refetch,
    addCustomer,
    updateCustomer,
    removeCustomer,
  };
}
