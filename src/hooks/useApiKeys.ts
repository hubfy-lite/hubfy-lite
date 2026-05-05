import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { invokeEdgeFunction } from "@/lib/edge-function-utils";
import { useTenant } from "@/hooks/useTenant";

export interface ApiKey {
  id: string;
  key_prefix: string;
  label: string;
  created_at: string;
  last_used_at: string | null;
  revoked_at: string | null;
}

export function useApiKeys() {
  const { tenant, loading: tenantLoading } = useTenant();
  const queryClient = useQueryClient();
  const [actionLoading, setActionLoading] = useState(false);

  const tenantId = tenant?.id ?? null;

  const {
    data: keys = [],
    isLoading,
    error,
    refetch,
  } = useQuery({
    queryKey: ["api-keys", tenantId],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data } = await invokeEdgeFunction<{ keys: ApiKey[] }>(
        "api-key-manage",
        { body: { action: "list", tenant_id: tenantId } },
      );
      return data?.keys ?? [];
    },
    enabled: !!tenantId,
    staleTime: 5 * 60_000,
  });

  const createKey = async (
    label?: string
  ): Promise<{ api_key: string; id: string; key_prefix: string }> => {
    if (!tenantId) throw new Error("Tenant não encontrado");
    setActionLoading(true);
    try {
      const { data } = await invokeEdgeFunction<{
        api_key: string;
        id: string;
        key_prefix: string;
      }>("api-key-manage", {
        body: { action: "create", tenant_id: tenantId, label },
      });

      await queryClient.invalidateQueries({
        queryKey: ["api-keys", tenantId],
      });
      return data;
    } finally {
      setActionLoading(false);
    }
  };

  const revokeKey = async (keyId: string) => {
    if (!tenantId) throw new Error("Tenant não encontrado");
    setActionLoading(true);
    try {
      await invokeEdgeFunction("api-key-manage", {
        body: { action: "revoke", tenant_id: tenantId, key_id: keyId },
      });

      await queryClient.invalidateQueries({
        queryKey: ["api-keys", tenantId],
      });
    } finally {
      setActionLoading(false);
    }
  };

  return {
    keys,
    loading: tenantLoading || isLoading,
    actionLoading,
    error: error as Error | null,
    refetch,
    createKey,
    revokeKey,
  };
}
