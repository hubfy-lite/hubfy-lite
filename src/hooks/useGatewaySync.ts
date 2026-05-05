/**
 * Hook para sincronização de produtos do gateway.
 *
 * State machine: idle → fetching → previewing → importing → result
 *
 * Passo 1 (fetch): busca produtos do gateway, normaliza, retorna lista.
 * Passo 2 (import): recebe IDs selecionados, cria como draft.
 */

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";

/* ─── Types ──────────────────────────────────────────────── */

export interface NormalizedGatewayProduct {
  external_id: string;
  name: string;
  status: "active" | "inactive" | "draft";
  is_subscription: boolean;
  price_cents: number | null;
  currency: string | null;
  warranty_days: number | null;
  created_at: string | null;
  already_imported: boolean;
  existing_product_id?: string;
}

export interface SyncJob {
  id: string;
  provider: string;
  resource_type: string;
  status: "running" | "completed" | "failed";
  total_items: number | null;
  processed_items: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  error_count: number;
  errors: Array<{ external_id?: string; name?: string; message: string }>;
  params?: Record<string, unknown>;
  started_at: string;
  completed_at: string | null;
  created_at: string;
}

export type SyncPhase = "idle" | "fetching" | "previewing" | "importing" | "result";

/* ─── Hook ───────────────────────────────────────────────── */

export function useGatewaySync(integrationId: string | null = null) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? null;

  const [phase, setPhase] = useState<SyncPhase>("idle");
  const [fetchedProducts, setFetchedProducts] = useState<NormalizedGatewayProduct[]>([]);
  const [importResult, setImportResult] = useState<SyncJob | null>(null);

  /* ── Query: último job de sync ── */
  const lastJobKey = ["gateway-sync-job", "products", tenantId, integrationId];
  const { data: lastJob, isLoading: isLoadingLastJob } = useQuery({
    queryKey: lastJobKey,
    queryFn: async () => {
      if (!tenantId) return null;
      let query = supabase
        .from("gateway_sync_jobs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("resource_type", "products")
        .order("created_at", { ascending: false })
        .limit(1);

      if (integrationId) {
        query = query.eq("integration_id", integrationId);
      }

      const { data, error } = await query.maybeSingle();
      if (error) throw error;
      return data as SyncJob | null;
    },
    enabled: !!tenantId,
  });

  /* ── Passo 1: Buscar produtos do gateway ── */
  const fetchProducts = useCallback(async () => {
    if (!tenantId) return;
    setPhase("fetching");
    try {
      const body: Record<string, unknown> = {
        action: "fetch",
        tenant_id: tenantId,
      };
      if (integrationId) body.integration_id = integrationId;

      const { data } = await invokeEdgeFunction("gateway-sync", { body });

      const products = (data.products ?? []) as NormalizedGatewayProduct[];
      setFetchedProducts(products);
      setPhase("previewing");
    } catch (err) {
      toast.error(translateEdgeError(err));
      setPhase("idle");
    }
  }, [tenantId, integrationId]);

  /* ── Passo 2: Importar produtos selecionados ── */
  const importSelected = useCallback(async (externalIds: string[]) => {
    if (!tenantId || externalIds.length === 0) return;
    setPhase("importing");
    try {
      const body: Record<string, unknown> = {
        action: "import",
        tenant_id: tenantId,
        selected_external_ids: externalIds,
      };
      if (integrationId) body.integration_id = integrationId;

      const { data } = await invokeEdgeFunction("gateway-sync", { body });

      const job = data.job as SyncJob;
      setImportResult(job);
      setPhase("result");

      // Invalidar queries dependentes
      queryClient.invalidateQueries({ queryKey: lastJobKey });
      queryClient.invalidateQueries({ queryKey: ["products"] });
      queryClient.invalidateQueries({ queryKey: ["synced-products"] });

      if (job.status === "completed") {
        const parts: string[] = [];
        if (job.created_count > 0) parts.push(`${job.created_count} criados`);
        if (job.error_count > 0) parts.push(`${job.error_count} erros`);
        toast.success(
          parts.length > 0
            ? `Importação concluída: ${parts.join(", ")}`
            : "Importação concluída",
        );
      } else if (job.status === "failed") {
        const msg = job.errors?.[0]?.message ?? "Erro desconhecido";
        toast.error(`Importação falhou: ${msg}`);
      }
    } catch (err) {
      toast.error(translateEdgeError(err));
      setPhase("previewing");
    }
  }, [tenantId, integrationId, queryClient, lastJobKey]);

  /* ── Reset ── */
  const reset = useCallback(() => {
    setPhase("idle");
    setFetchedProducts([]);
    setImportResult(null);
  }, []);

  return {
    phase,
    fetchedProducts,
    lastJob: lastJob ?? null,
    importResult,
    isLoadingLastJob,
    fetchProducts,
    importSelected,
    reset,
  };
}
