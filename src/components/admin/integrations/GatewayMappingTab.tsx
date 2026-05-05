/**
 * Aba de mapeamento genérica para gateways.
 *
 * Usa gateway_product_mappings (sistema novo) ao invés de products.gateway_product_ids.
 * Substitui HotmartMappingTab.
 */

import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  X,
  Plus,
  Loader2,
  Package,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { limitNameLength } from "@/lib/name-limits";
import { NO_AUTOFILL_PROPS } from "@/lib/no-autofill";
import { getCoversOptimizedUrl } from "@/lib/storage-urls";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { useGatewayMappings, type ProductWithMappings } from "@/hooks/useGatewayMappings";
import type { GatewayProvider } from "@/lib/gateway";
import { PROVIDERS } from "@/lib/integration-registry";

interface GatewayMappingTabProps {
  provider: GatewayProvider;
  integrationId: string;
  tenantSlug: string | null;
}

export default function GatewayMappingTab({
  provider,
  integrationId,
  tenantSlug,
}: GatewayMappingTabProps) {
  const { t } = useTranslation();
  const { products, isLoading, addMapping, removeMapping } =
    useGatewayMappings(provider, integrationId);

  const providerName = PROVIDERS[provider as keyof typeof PROVIDERS]?.displayName ?? provider;

  const [addingToId, setAddingToId] = useState<string | null>(null);
  const [draftValue, setDraftValue] = useState("");

  function startAdd(productId: string) {
    setAddingToId(productId);
    setDraftValue("");
  }

  function cancelAdd() {
    setAddingToId(null);
    setDraftValue("");
  }

  async function handleAdd(p: ProductWithMappings) {
    const val = draftValue.trim();
    if (!val) {
      cancelAdd();
      return;
    }
    // Verificar duplicata no mesmo produto
    if (p.mappings.some((m) => m.external_product_id === val)) {
      toast.error("Esse ID já está vinculado a este produto.");
      return;
    }
    // Verificar duplicata em outro produto
    const otherProduct = products.find(
      (other) =>
        other.id !== p.id &&
        other.mappings.some((m) => m.external_product_id === val),
    );
    if (otherProduct) {
      toast.error(
        `Esse ID já está vinculado ao produto "${limitNameLength(otherProduct.name)}". Remova de lá antes de adicionar aqui.`,
      );
      return;
    }
    try {
      await addMapping.mutateAsync({
        productId: p.id,
        externalProductId: val,
      });
      cancelAdd();
    } catch {
      // toast já é mostrado pelo hook
    }
  }

  async function handleRemove(mappingId: string) {
    try {
      await removeMapping.mutateAsync(mappingId);
    } catch {
      // toast já é mostrado pelo hook
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (products.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Package className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Nenhum produto encontrado. Crie um produto primeiro.
        </p>
      </div>
    );
  }

  const isSaving = addMapping.isPending || removeMapping.isPending;

  return (
    <div className="mx-auto w-full max-w-[1200px] 3xl:max-w-[1600px]">
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[40%]">Produto</TableHead>
              <TableHead className="w-[80px]">Status</TableHead>
              <TableHead>ID {providerName}</TableHead>
              <TableHead className="w-[90px]" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const isAdding = addingToId === p.id;
              const thumb = p.cover_url
                ? getCoversOptimizedUrl(p.cover_url, "product-thumb")
                : null;
              const mappings = p.mappings;

              return (
                <TableRow key={p.id}>
                  <TableCell>
                    {tenantSlug ? (
                      <a
                        href={`/${tenantSlug}/products/${p.public_id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex min-w-0 items-center gap-3 hover:opacity-80 transition-opacity"
                      >
                        {thumb ? (
                          <img src={thumb} alt="" className="h-9 w-9 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="block min-w-0 truncate text-sm font-medium underline-offset-2 hover:underline">
                          {limitNameLength(p.name)}
                        </span>
                      </a>
                    ) : (
                      <div className="flex min-w-0 items-center gap-3">
                        {thumb ? (
                          <img src={thumb} alt="" className="h-9 w-9 rounded object-cover shrink-0" />
                        ) : (
                          <div className="h-9 w-9 rounded bg-muted flex items-center justify-center shrink-0">
                            <Package className="h-4 w-4 text-muted-foreground" />
                          </div>
                        )}
                        <span className="block min-w-0 truncate text-sm font-medium">
                          {limitNameLength(p.name)}
                        </span>
                      </div>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant={p.status === "active" ? "success" : p.status === "draft" ? "amber" : "gray"}
                      className="text-xs"
                    >
                      {p.status === "active" ? t("products.statusLabels.active") : p.status === "archived" ? t("products.statusLabels.archived") : t("products.statusLabels.draft")}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {mappings.map((m) => (
                        <Badge
                          key={m.id}
                          variant="secondary"
                          className="gap-1 pl-2 pr-1 text-xs"
                        >
                          {m.external_product_id}
                          <button
                            type="button"
                            onClick={() => handleRemove(m.id)}
                            disabled={isSaving}
                            className="ml-0.5 rounded-full p-0.5 hover:bg-muted-foreground/20 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </Badge>
                      ))}
                      {isAdding && (
                        <div className="flex items-center gap-1.5">
                          <Input
                            {...NO_AUTOFILL_PROPS}
                            value={draftValue}
                            onChange={(e) => setDraftValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") handleAdd(p);
                              if (e.key === "Escape") cancelAdd();
                            }}
                            placeholder="Ex: 12345678"
                            className="h-7 w-[130px] text-xs"
                            disabled={isSaving}
                            autoFocus
                          />
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs"
                            onClick={() => handleAdd(p)}
                            disabled={isSaving}
                          >
                            {isSaving && <Loader2 className="h-3 w-3 animate-spin" />}
                            OK
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="h-7 w-7"
                            onClick={cancelAdd}
                            disabled={isSaving}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                      {mappings.length === 0 && !isAdding && (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </div>
                  </TableCell>

                  <TableCell>
                    {!isAdding && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => startAdd(p.id)}
                      >
                        <Plus className="h-3 w-3 mr-1" />
                        Adicionar
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
