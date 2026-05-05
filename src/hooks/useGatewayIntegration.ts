/**
 * Hook genérico para gateways de pagamento.
 *
 * Usa tenant_integrations (sistema novo) ao invés de tenant_gateways (legado).
 * Conecta via gateway-connect, desconecta via gateway-disconnect.
 */

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import type { GatewayProvider } from "@/lib/gateway";
import type { Json } from "@/integrations/supabase/types";

export interface GatewayIntegration {
  id: string;
  provider: string;
  status: string;
  credentials_hint: Json | null;
  last_validated_at: string | null;
  last_error: string | null;
  created_at: string | null;
  updated_at: string | null;
}

export function useGatewayIntegration(provider: GatewayProvider) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? null;

  const queryKey = ["gateway-integration", provider, tenantId];

  /* ── Query: busca integração ── */
  const { data: integration, isLoading: queryLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenantId) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select(
          "id, provider, status, credentials_hint, last_validated_at, last_error, created_at, updated_at",
        )
        .eq("tenant_id", tenantId)
        .eq("provider", provider)
        .maybeSingle();
      if (error) throw error;
      return data as GatewayIntegration | null;
    },
    enabled: !!tenantId,
  });

  const isLoading = queryLoading || !tenantId;

  /* ── Connect: salva credenciais via edge function ── */
  const connectMutation = useMutation({
    mutationFn: async (credentials: Record<string, string>) => {
      const { data } = await invokeEdgeFunction("gateway-connect", {
        body: { provider, tenant_id: tenantId, credentials },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Gateway conectado com sucesso");
    },
    onError: (err: Error) => {
      toast.error(translateEdgeError(err));
    },
  });

  /* ── Update credentials: reconecta com novas credenciais ── */
  const updateCredentialsMutation = useMutation({
    mutationFn: async (credentials: Record<string, string>) => {
      const { data } = await invokeEdgeFunction("gateway-connect", {
        body: { provider, tenant_id: tenantId, credentials },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Credenciais atualizadas");
    },
    onError: (err: Error) => {
      toast.error(translateEdgeError(err));
    },
  });

  /* ── Disconnect: soft delete ── */
  const disconnectMutation = useMutation({
    mutationFn: async () => {
      const { data } = await invokeEdgeFunction("gateway-disconnect", {
        body: { provider, tenant_id: tenantId },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success("Gateway desconectado");
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
    updateCredentials: updateCredentialsMutation.mutateAsync,
    disconnect: disconnectMutation.mutateAsync,
    isConnecting: connectMutation.isPending,
    isUpdating: updateCredentialsMutation.isPending,
    isDisconnecting: disconnectMutation.isPending,
  };
}
