/**
 * Hook para sincronização de vendas do gateway.
 *
 * State machine: idle → fetching → previewing → importing → result
 *
 * Passo 1 (fetch): busca vendas dos últimos 90 dias, retorna resumo.
 * Passo 2 (import): importa vendas elegíveis, cria orders + customers.
 */

import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdgeFunction, translateEdgeError } from "@/lib/edge-function-utils";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import type { SyncJob } from "@/hooks/useGatewaySync";

/* ─── Types ──────────────────────────────────────────────── */

export interface SalesSyncSummary {
  total: number;
  total_fetched: number;
  eligible: number;
  already_imported: number;
  unmapped_product: number;
  skipped_status: number;
  skipped_no_email: number;
  unique_customers: number;
  unmapped_products: Array<{ external_id: string; name: string; count: number }>;
  capped: boolean;
}

export type SalesSyncPhase = "idle" | "fetching" | "previewing" | "importing" | "result";

/* ─── Hook ───────────────────────────────────────────────── */

export function useGatewaySalesSync(integrationId: string | null) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? null;

  const [phase, setPhase] = useState<SalesSyncPhase>("idle");
  const [summary, setSummary] = useState<SalesSyncSummary | null>(null);
  const [importResult, setImportResult] = useState<SyncJob | null>(null);

  /* ── Query: último job de sync de vendas ── */
  const lastJobKey = ["gateway-sync-job", "orders", tenantId, integrationId];
  const { data: lastJob } = useQuery({
    queryKey: lastJobKey,
    queryFn: async () => {
      if (!tenantId || !integrationId) return null;
      const { data, error } = await supabase
        .from("gateway_sync_jobs")
        .select("*")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .eq("resource_type", "orders")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data as SyncJob | null;
    },
    enabled: !!tenantId && !!integrationId,
  });

  /* ── Passo 1: Buscar resumo de vendas ── */
  const fetchSales = useCallback(async () => {
    if (!tenantId || !integrationId) return;
    setPhase("fetching");
    try {
      const { data } = await invokeEdgeFunction("gateway-sync", {
        body: {
          action: "fetch",
          tenant_id: tenantId,
          integration_id: integrationId,
          resource_type: "orders",
        },
      });

      setSummary(data.summary as SalesSyncSummary);
      setPhase("previewing");
    } catch (err) {
      toast.error(translateEdgeError(err));
      setPhase("idle");
    }
  }, [tenantId, integrationId]);

  /* ── Passo 2: Importar vendas elegíveis ── */
  const importSales = useCallback(async () => {
    if (!tenantId || !integrationId) return;
    setPhase("importing");
    try {
      const { data } = await invokeEdgeFunction("gateway-sync", {
        body: {
          action: "import",
          tenant_id: tenantId,
          integration_id: integrationId,
          resource_type: "orders",
        },
      });

      const job = data.job as SyncJob;
      setImportResult(job);
      setPhase("result");

      // Invalidar queries dependentes
      queryClient.invalidateQueries({ queryKey: lastJobKey });
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      queryClient.invalidateQueries({ queryKey: ["customers"] });
      queryClient.invalidateQueries({ queryKey: ["synced-orders"] });
      queryClient.invalidateQueries({ queryKey: ["synced-customers"] });

      if (job.status === "completed") {
        const parts: string[] = [];
        if (job.created_count > 0) parts.push(`${job.created_count} pedidos criados`);
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
    setSummary(null);
    setImportResult(null);
  }, []);

  return {
    phase,
    summary,
    lastJob: lastJob ?? null,
    importResult,
    fetchSales,
    importSales,
    reset,
  };
}
