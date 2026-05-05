/**
 * Generic hook for simple integrations stored in tenant_integrations.
 * Covers providers that just need credentials saved and validated
 * (no complex sub-resources like product mappings).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import type { Json } from "@/integrations/supabase/types";

export interface SimpleIntegration {
  id: string;
  provider: string;
  status: string;
  account_name: string | null;
  account_url: string | null;
  credentials_hint: Json | null;
  last_validated_at: string | null;
  last_error: string | null;
}

interface ConnectOptions {
  connectFnName: string; // edge function name
  disconnectFnName: string; // edge function name
  onConnected?: (data: SimpleIntegration) => void;
  successMessage?: string;
  disconnectSuccessMessage?: string;
}

export function useSimpleIntegration(provider: string, opts: ConnectOptions) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();

  const queryKey = ["simple-integration", provider, tenant?.id];

  const { data: integration, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select(
          "id, provider, status, account_name, account_url, credentials_hint, last_validated_at, last_error",
        )
        .eq("tenant_id", tenant.id)
        .eq("provider", provider)
        .maybeSingle();
      if (error) throw error;
      return data as SimpleIntegration | null;
    },
    enabled: !!tenant?.id,
  });

  const connectMutation = useMutation({
    mutationFn: async (credentials: Record<string, string>) => {
      if (!tenant?.id) throw new Error("Tenant não encontrado");
      const { data } = await invokeEdgeFunction<{ integration: SimpleIntegration }>(
        opts.connectFnName,
        { body: { tenant_id: tenant.id, ...credentials } },
      );
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey });
      if (opts.successMessage) toast.success(opts.successMessage);
      if (data?.integration) opts.onConnected?.(data.integration);
    },
    onError: (err: Error) => {
      toast.error(translateEdgeError(err));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error("Tenant não encontrado");
      const { data } = await invokeEdgeFunction(opts.disconnectFnName, {
        body: { tenant_id: tenant.id },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      if (opts.disconnectSuccessMessage) toast.success(opts.disconnectSuccessMessage);
    },
    onError: (err: Error) => {
      toast.error(translateEdgeError(err));
    },
  });

  return {
    integration,
    isLoading,
    isConnected: integration?.status === "active",
    connect: connectMutation.mutateAsync,
    disconnect: disconnectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
  };
}
