/**
 * Hook para mapeamento de produtos do gateway.
 *
 * Usa gateway_product_mappings (sistema novo) ao invés de products.gateway_product_ids (legado).
 * CRUD via Supabase direto (RLS protege por tenant).
 */

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useTenant } from "@/hooks/useTenant";
import type { GatewayProvider } from "@/lib/gateway";

export interface GatewayProductMapping {
  id: string;
  integration_id: string;
  product_id: string;
  external_product_id: string;
  created_at: string;
}

export interface TenantProduct {
  id: string;
  public_id: string;
  name: string;
  thumb_url: string | null;
  cover_url: string | null;
  status: string;
}

export interface ProductWithMappings extends TenantProduct {
  mappings: GatewayProductMapping[];
}

export function useGatewayMappings(provider: GatewayProvider, integrationId: string | null) {
  const { tenant } = useTenant();
  const queryClient = useQueryClient();
  const tenantId = tenant?.id ?? null;

  const productsKey = ["gateway-mappings-products", provider, tenantId, integrationId] as const;

  /* ── Buscar produtos + mapeamentos ── */
  const { data: products = [], isLoading } = useQuery<ProductWithMappings[]>({
    queryKey: productsKey,
    enabled: !!tenantId && !!integrationId,
    queryFn: async () => {
      if (!tenantId || !integrationId) return [];

      // Buscar produtos e mapeamentos em paralelo
      const [productsRes, mappingsRes] = await Promise.all([
        supabase
          .from("products")
          .select("id, public_id, name, thumb_url, cover_url, status")
          .eq("tenant_id", tenantId)
          .order("name"),
        supabase
          .from("gateway_product_mappings")
          .select("id, integration_id, product_id, external_product_id, created_at")
          .eq("integration_id", integrationId),
      ]);

      if (productsRes.error) throw productsRes.error;
      if (mappingsRes.error) throw mappingsRes.error;

      const mappings = (mappingsRes.data ?? []) as GatewayProductMapping[];
      const mappingsByProduct = new Map<string, GatewayProductMapping[]>();
      for (const m of mappings) {
        const arr = mappingsByProduct.get(m.product_id) ?? [];
        arr.push(m);
        mappingsByProduct.set(m.product_id, arr);
      }

      return ((productsRes.data ?? []) as TenantProduct[]).map((p) => ({
        ...p,
        mappings: mappingsByProduct.get(p.id) ?? [],
      }));
    },
  });

  /* ── Adicionar mapeamento ── */
  const addMapping = useMutation({
    mutationFn: async ({
      productId,
      externalProductId,
    }: {
      productId: string;
      externalProductId: string;
    }) => {
      if (!integrationId || !tenantId) throw new Error("Integração não encontrada");
      const { error } = await supabase.from("gateway_product_mappings").insert({
        tenant_id: tenantId,
        integration_id: integrationId,
        provider,
        product_id: productId,
        external_product_id: externalProductId,
      });
      if (error) {
        if (error.code === "23505") {
          throw new Error("Esse ID já está vinculado.");
        }
        throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsKey });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao adicionar mapeamento");
    },
  });

  /* ── Remover mapeamento ── */
  const removeMapping = useMutation({
    mutationFn: async (mappingId: string) => {
      const { error } = await supabase
        .from("gateway_product_mappings")
        .delete()
        .eq("id", mappingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: productsKey });
    },
    onError: (err: Error) => {
      toast.error(err.message || "Erro ao remover mapeamento");
    },
  });

  return {
    products,
    isLoading,
    addMapping,
    removeMapping,
  };
}
