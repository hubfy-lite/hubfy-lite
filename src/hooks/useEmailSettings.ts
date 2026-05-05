import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import { useTenant } from "@/hooks/useTenant";

export interface EmailSettings {
  id: string;
  tenant_id: string;
  resend_domain_id: string | null;
  domain: string | null;
  domain_status: string;
  dns_records: Record<string, unknown>[];
  resend_topic_id: string | null;
  enabled: boolean;
  suspended: boolean;
  suspended_reason: string | null;
  max_recipients_per_broadcast: number;
  created_at: string;
  updated_at: string;
}

export function useEmailSettings() {
  const { tenant } = useTenant();

  const { data, isLoading, error } = useQuery({
    queryKey: ["email-settings", tenant?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("tenant_email_settings")
        .select("*")
        .eq("tenant_id", tenant!.id)
        .maybeSingle();

      if (error) throw error;
      return data as EmailSettings | null;
    },
    enabled: !!tenant?.id,
    staleTime: 30_000,
  });

  return {
    settings: data ?? null,
    loading: isLoading,
    error,
  };
}

export function useEmailDomain() {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const invoke = async (body: Record<string, unknown>) => {
    const { data } = await invokeEdgeFunction("email-marketing-domain", {
      body: { tenant_id: tenant?.id, ...body },
    });
    return data;
  };

  const createDomain = useMutation({
    mutationFn: (params: { domain: string }) =>
      invoke({ action: "create", ...params }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["email-settings", tenant?.id] }),
  });

  const verifyDomain = useMutation({
    mutationFn: () => invoke({ action: "verify" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["email-settings", tenant?.id] }),
  });

  const deleteDomain = useMutation({
    mutationFn: () => invoke({ action: "delete" }),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["email-settings", tenant?.id] }),
  });

  return { createDomain, verifyDomain, deleteDomain };
}
