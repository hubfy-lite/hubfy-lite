import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { useTenant } from "@/hooks/useTenant";
import type { Json } from "@/integrations/supabase/types";

export type AIProvider = "openai" | "anthropic";

export interface AIIntegration {
  id: string;
  provider: string;
  status: string;
  account_name: string | null;
  credentials_hint: Json | null;
  last_validated_at: string | null;
  last_error: string | null;
}

export function useAIIntegration(provider: AIProvider) {
  const { tenant } = useTenant();
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const queryKey = ["ai-integration", provider, tenant?.id];

  const { data: integration, isLoading } = useQuery({
    queryKey,
    queryFn: async () => {
      if (!tenant?.id) return null;
      const { data, error } = await supabase
        .from("tenant_integrations")
        .select(
          "id, provider, status, account_name, credentials_hint, last_validated_at, last_error",
        )
        .eq("tenant_id", tenant.id)
        .eq("provider", provider)
        .maybeSingle();

      if (error) throw error;
      return data as AIIntegration | null;
    },
    enabled: !!tenant?.id,
  });

  const connectMutation = useMutation({
    mutationFn: async (apiKey: string) => {
      if (!tenant?.id) throw new Error("Tenant não encontrado");
      const { data } = await invokeEdgeFunction("ai-provider-connect", {
        body: { tenant_id: tenant.id, provider, api_key: apiKey },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("integrations.ai.connected", { provider: providerName(provider) }));
    },
    onError: (err: Error) => {
      toast.error(translateEdgeError(err));
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!tenant?.id) throw new Error("Tenant não encontrado");
      const { data } = await invokeEdgeFunction("ai-provider-disconnect", {
        body: { tenant_id: tenant.id, provider },
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey });
      toast.success(t("integrations.ai.disconnected", { provider: providerName(provider) }));
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

function providerName(provider: AIProvider): string {
  return provider === "openai" ? "OpenAI" : "Anthropic";
}
