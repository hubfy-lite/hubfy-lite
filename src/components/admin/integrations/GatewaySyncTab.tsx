/**
 * GatewaySyncTab — Aba de sincronização do gateway.
 *
 * Tabs: Produtos (funcional) / Clientes (read-only) / Pedidos (funcional).
 */

import { useState, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Users,
  ShoppingCart,
  Loader2,
  AlertCircle,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Download,
  Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useTenant } from "@/hooks/useTenant";
import {
  useGatewaySync,
  type SyncJob,
  type NormalizedGatewayProduct,
} from "@/hooks/useGatewaySync";
import {
  useGatewaySalesSync,
  type SalesSyncSummary,
} from "@/hooks/useGatewaySalesSync";
import {
  type GatewayProvider,
  hasApiCredentials as checkApiCredentials,
  providerSupportsSyncApi,
} from "@/lib/gateway";
import type { Json } from "@/integrations/supabase/types";

interface GatewaySyncTabProps {
  provider: GatewayProvider;
  integrationId: string;
  credentialsHint: Json | null;
}

export default function GatewaySyncTab({
  provider,
  integrationId,
  credentialsHint,
}: GatewaySyncTabProps) {
  const { t } = useTranslation();
  const hint = credentialsHint as Record<string, string> | null;
  const apiReady = checkApiCredentials(provider, hint);
  const supportsSync = providerSupportsSyncApi(provider);

  return (
    <div className="mx-auto w-full max-w-[1200px] 3xl:max-w-[1600px]">
      <Tabs defaultValue="products">
        <TabsList variant="line" className="w-full shrink-0 border-b border-border">
          <TabsTrigger value="products" className="flex-1">{t("integrations.gateway.tabProducts")}</TabsTrigger>
          <TabsTrigger value="customers" className="flex-1">{t("integrations.gateway.tabCustomers")}</TabsTrigger>
          <TabsTrigger value="orders" className="flex-1">{t("integrations.gateway.tabOrders")}</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="mt-4 space-y-4">
          <ProductsSyncPanel
            provider={provider}
            integrationId={integrationId}
            apiReady={apiReady}
            supportsSync={supportsSync}
          />
        </TabsContent>

        <TabsContent value="customers" className="mt-4 space-y-4">
          <SyncedCustomersPanel
            provider={provider}
            integrationId={integrationId}
          />
        </TabsContent>

        <TabsContent value="orders" className="mt-4 space-y-4">
          <OrdersSyncPanel
            provider={provider}
            integrationId={integrationId}
            apiReady={apiReady}
            supportsSync={supportsSync}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
 * Products Sync Panel (existente, sem mudanças funcionais)
 * ══════════════════════════════════════════════════════════════ */

interface SyncedProduct {
  id: string;
  name: string;
  cover_url: string | null;
  status: string;
  created_at: string;
  external_product_id: string;
}

function ProductsSyncPanel({
  provider,
  integrationId,
  apiReady,
  supportsSync,
}: {
  provider: GatewayProvider;
  integrationId: string;
  apiReady: boolean;
  supportsSync: boolean;
}) {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const sync = useGatewaySync(integrationId);

  const { data: syncedProducts, isLoading } = useQuery({
    queryKey: ["synced-products", integrationId, tenantId, sync.lastJob?.id, sync.importResult?.id],
    queryFn: async () => {
      if (!tenantId) return [];
      const { data: mappings, error } = await supabase
        .from("gateway_product_mappings")
        .select("external_product_id, product_id")
        .eq("integration_id", integrationId);

      if (error || !mappings || mappings.length === 0) return [];

      const productIds = mappings
        .map((m) => m.product_id)
        .filter(Boolean) as string[];

      if (productIds.length === 0) return [];

      const { data: products } = await supabase
        .from("products")
        .select("id, name, cover_url, status, created_at")
        .in("id", productIds)
        .order("created_at", { ascending: false });

      const mappingMap = new Map(
        mappings.map((m) => [m.product_id, m.external_product_id]),
      );

      return (products ?? []).map((p) => ({
        ...p,
        external_product_id: mappingMap.get(p.id) ?? "",
      })) as SyncedProduct[];
    },
    enabled: !!tenantId && !!integrationId,
  });

  return (
    <>
      {(sync.phase === "idle" || sync.phase === "fetching") && (
        <SyncBanner
          provider={provider}
          apiReady={apiReady}
          supportsSync={supportsSync}
          lastJob={sync.lastJob}
          isFetching={sync.phase === "fetching"}
          onFetch={sync.fetchProducts}
          resourceType="products"
        />
      )}

      {sync.phase === "previewing" && (
        <ProductSelectionTable
          products={sync.fetchedProducts}
          provider={provider}
          onImport={sync.importSelected}
          onCancel={sync.reset}
        />
      )}

      {sync.phase === "importing" && (
        <SyncProgress
          count={sync.fetchedProducts.filter((p) => !p.already_imported).length}
          resourceType="products"
        />
      )}

      {sync.phase === "result" && sync.importResult && (
        <SyncResultProducts
          job={sync.importResult}
          onFetchAgain={() => { sync.reset(); sync.fetchProducts(); }}
        />
      )}

      {sync.phase !== "previewing" && (
        <>
          {isLoading ? (
            <Card variant="bordered">
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : syncedProducts && syncedProducts.length > 0 ? (
            <ImportedProductsTable products={syncedProducts} provider={provider} />
          ) : sync.phase === "idle" ? (
            <EmptyState
              icon={Package}
              title={t("integrations.gateway.emptyProducts")}
              description={
                apiReady && supportsSync
                  ? t("integrations.gateway.emptyProductsDesc")
                  : t("integrations.gateway.emptyProductsNoCredentials")
              }
            />
          ) : null}
        </>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
 * Orders Sync Panel (NOVO)
 * ══════════════════════════════════════════════════════════════ */

interface SyncedOrder {
  id: string;
  customer_name: string;
  product_name: string;
  unit_amount: number | null;
  currency: string | null;
  status: string;
  gateway_order_created_at: string | null;
  created_at: string;
}

function OrdersSyncPanel({
  provider,
  integrationId,
  apiReady,
  supportsSync,
}: {
  provider: GatewayProvider;
  integrationId: string;
  apiReady: boolean;
  supportsSync: boolean;
}) {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;
  const sync = useGatewaySalesSync(integrationId);

  // Tabela de pedidos já importados
  const { data: syncedOrders, isLoading } = useQuery({
    queryKey: ["synced-orders", integrationId, tenantId, sync.lastJob?.id, sync.importResult?.id],
    queryFn: async (): Promise<SyncedOrder[]> => {
      if (!tenantId) return [];

      const { data: rawOrders, error } = await supabase
        .from("orders")
        .select("id, unit_amount, currency, status, gateway_order_created_at, created_at, customer_id, product_id")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .eq("source", "external_gateway")
        .order("gateway_order_created_at", { ascending: false, nullsFirst: false })
        .limit(100) as { data: Array<{ id: string; unit_amount: number | null; currency: string | null; status: string; gateway_order_created_at: string | null; created_at: string; customer_id: string | null; product_id: string | null }> | null; error: unknown };

      if (error || !rawOrders || rawOrders.length === 0) return [];

      // Buscar nomes de customers e products
      const customerIds = [...new Set(rawOrders.map((o) => o.customer_id).filter(Boolean))] as string[];
      const productIds = [...new Set(rawOrders.map((o) => o.product_id).filter(Boolean))] as string[];

      const [customersRes, productsRes] = await Promise.all([
        customerIds.length > 0
          ? supabase.from("customers").select("id, name, email").in("id", customerIds)
          : { data: [] as Array<{ id: string; name: string | null; email: string }> },
        productIds.length > 0
          ? supabase.from("products").select("id, name").in("id", productIds)
          : { data: [] as Array<{ id: string; name: string }> },
      ]);

      const customerMap = new Map(
        (customersRes.data ?? []).map((c) => [c.id, c.name || c.email]),
      );
      const productMap = new Map(
        (productsRes.data ?? []).map((p) => [p.id, p.name]),
      );

      return rawOrders.map((o) => ({
        id: o.id,
        customer_name: customerMap.get(o.customer_id ?? "") ?? "—",
        product_name: productMap.get(o.product_id ?? "") ?? "—",
        unit_amount: o.unit_amount,
        currency: o.currency,
        status: o.status,
        gateway_order_created_at: o.gateway_order_created_at,
        created_at: o.created_at,
      }));
    },
    enabled: !!tenantId && !!integrationId,
  });

  return (
    <>
      {/* Banner / controles por fase */}
      {(sync.phase === "idle" || sync.phase === "fetching") && (
        <SyncBanner
          provider={provider}
          apiReady={apiReady}
          supportsSync={supportsSync}
          lastJob={sync.lastJob}
          isFetching={sync.phase === "fetching"}
          onFetch={sync.fetchSales}
          resourceType="orders"
        />
      )}

      {sync.phase === "previewing" && sync.summary && (
        <SalesSummaryCard
          summary={sync.summary}
          provider={provider}
          onImport={sync.importSales}
          onCancel={sync.reset}
        />
      )}

      {sync.phase === "importing" && (
        <SyncProgress
          count={sync.summary?.eligible ?? 0}
          resourceType="orders"
        />
      )}

      {sync.phase === "result" && sync.importResult && (
        <SyncResultOrders
          job={sync.importResult}
          onFetchAgain={() => { sync.reset(); sync.fetchSales(); }}
        />
      )}

      {/* Tabela de pedidos já importados */}
      {sync.phase !== "previewing" && (
        <>
          {isLoading ? (
            <Card variant="bordered">
              <CardContent className="flex items-center justify-center py-12">
                <Loader2 className="size-5 animate-spin text-muted-foreground" />
              </CardContent>
            </Card>
          ) : syncedOrders && syncedOrders.length > 0 ? (
            <ImportedOrdersTable orders={syncedOrders} />
          ) : sync.phase === "idle" ? (
            <EmptyState
              icon={ShoppingCart}
              title={t("integrations.gateway.sync.ordersEmpty")}
              description={
                apiReady && supportsSync
                  ? t("integrations.gateway.sync.ordersEmptyDesc")
                  : t("integrations.gateway.sync.salesCredentialsNeededDesc")
              }
            />
          ) : null}
        </>
      )}
    </>
  );
}

/* ══════════════════════════════════════════════════════════════
 * Synced Customers Panel (NOVO — read-only)
 * ══════════════════════════════════════════════════════════════ */

interface SyncedCustomer {
  id: string;
  name: string | null;
  email: string;
  created_at: string;
  order_count: number;
}

function SyncedCustomersPanel({
  provider,
  integrationId,
}: {
  provider: GatewayProvider;
  integrationId: string;
}) {
  const { t } = useTranslation();
  const { tenant } = useTenant();
  const tenantId = tenant?.id ?? null;

  const { data: customers, isLoading } = useQuery({
    queryKey: ["synced-customers", integrationId, tenantId],
    queryFn: async () => {
      if (!tenantId) return [];

      // Buscar customer_ids com orders deste integration
      const { data: orders, error } = await supabase
        .from("orders")
        .select("customer_id")
        .eq("tenant_id", tenantId)
        .eq("integration_id", integrationId)
        .eq("source", "external_gateway");

      if (error || !orders || orders.length === 0) return [];

      // Contar orders por customer
      const countMap = new Map<string, number>();
      for (const o of orders) {
        if (o.customer_id) {
          countMap.set(o.customer_id, (countMap.get(o.customer_id) ?? 0) + 1);
        }
      }

      const customerIds = [...countMap.keys()];
      if (customerIds.length === 0) return [];

      const { data: customerData } = await supabase
        .from("customers")
        .select("id, name, email, created_at")
        .in("id", customerIds)
        .order("created_at", { ascending: false })
        .limit(100);

      return (customerData ?? []).map((c) => ({
        ...c,
        order_count: countMap.get(c.id) ?? 0,
      })) as SyncedCustomer[];
    },
    enabled: !!tenantId && !!integrationId,
  });

  if (isLoading) {
    return (
      <Card variant="bordered">
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="size-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!customers || customers.length === 0) {
    return (
      <EmptyState
        icon={Users}
        title={t("integrations.gateway.sync.customersEmpty")}
        description={t("integrations.gateway.sync.customersEmptyDesc")}
      />
    );
  }

  return (
    <Card variant="bordered" className="min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="w-full text-xs md:text-sm">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {t("integrations.gateway.sync.customersColName")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {t("integrations.gateway.sync.customersColEmail")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[100px]">
                {t("integrations.gateway.sync.customersColOrders")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[140px]">
                {t("integrations.gateway.sync.customersColCreated")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {customers.map((c) => (
              <TableRow key={c.id} className="hover:bg-muted/30">
                <TableCell className="px-3 py-2.5">
                  <span className="font-medium text-foreground truncate">
                    {c.name || "—"}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {c.email}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground text-center">
                  {c.order_count}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {new Date(c.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ══════════════════════════════════════════════════════════════
 * Shared Components
 * ══════════════════════════════════════════════════════════════ */

/* ── Sync Banner (genericizado por resourceType) ── */

function SyncBanner({
  provider,
  apiReady,
  supportsSync,
  lastJob,
  isFetching,
  onFetch,
  resourceType,
}: {
  provider: GatewayProvider;
  apiReady: boolean;
  supportsSync: boolean;
  lastJob: SyncJob | null;
  isFetching: boolean;
  onFetch: () => void;
  resourceType: "products" | "orders";
}) {
  const { t } = useTranslation();
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);
  const isOrders = resourceType === "orders";

  const fetchLabel = isOrders
    ? t("integrations.gateway.sync.salesFetchButton")
    : t("integrations.gateway.sync.fetchButton");
  const fetchingLabel = isOrders
    ? t("integrations.gateway.sync.salesFetching")
    : t("integrations.gateway.sync.fetching");

  if (!supportsSync) {
    return (
      <Card variant="bordered" className="border-muted">
        <CardContent className="flex items-center gap-3 py-3">
          <AlertCircle className="size-5 text-muted-foreground shrink-0" />
          <p className="text-sm text-muted-foreground">
            {t("integrations.gateway.sync.noSyncApi", { provider: providerLabel })}
          </p>
        </CardContent>
      </Card>
    );
  }

  if (!apiReady) {
    return (
      <Card variant="bordered" className="border-warning/30 bg-warning/5">
        <CardContent className="flex items-center gap-3 py-3">
          <AlertCircle className="size-5 text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t("integrations.gateway.sync.credentialsNeeded")}
            </p>
            <p className="text-xs text-muted-foreground">
              {isOrders
                ? t("integrations.gateway.sync.salesCredentialsNeededDesc")
                : t("integrations.gateway.sync.credentialsNeededDesc")}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Último job falhou
  if (lastJob?.status === "failed") {
    const msg = lastJob.errors?.[0]?.message ?? "Erro desconhecido";
    return (
      <Card variant="bordered" className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center gap-3 py-3">
          <XCircle className="size-5 text-destructive shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {t("integrations.gateway.sync.lastFailed")}
            </p>
            <p className="text-xs text-muted-foreground">{msg}</p>
          </div>
          <Button size="sm" variant="outline" disabled={isFetching} onClick={onFetch}>
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {isFetching ? fetchingLabel : fetchLabel}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Último job completou
  if (lastJob?.status === "completed") {
    const date = new Date(lastJob.completed_at ?? lastJob.started_at);
    const formatted = date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
    const parts: string[] = [];
    if (lastJob.created_count > 0) parts.push(`${lastJob.created_count} criados`);
    if (lastJob.error_count > 0) parts.push(`${lastJob.error_count} erros`);

    return (
      <Card variant="bordered" className="border-green-500/20 bg-green-500/5">
        <CardContent className="flex items-center gap-3 py-3">
          <CheckCircle2 className="size-5 text-green-600 dark:text-green-400 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">
              {isOrders
                ? t("integrations.gateway.sync.salesResultTitle")
                : t("integrations.gateway.sync.resultTitle")}
              {parts.length > 0 && <span className="font-normal text-muted-foreground"> — {parts.join(", ")}</span>}
            </p>
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Clock className="size-3" />
              {formatted}
            </p>
          </div>
          <Button size="sm" variant="outline" disabled={isFetching} onClick={onFetch}>
            {isFetching ? <Loader2 className="size-4 animate-spin" /> : <Search className="size-4" />}
            {isFetching ? fetchingLabel : fetchLabel}
          </Button>
        </CardContent>
      </Card>
    );
  }

  // Nunca sincronizou
  return (
    <Card variant="bordered">
      <CardContent className="flex items-center gap-3 py-3">
        <Download className="size-5 text-muted-foreground shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {isOrders
              ? t("integrations.gateway.sync.salesImportTitle", { provider: providerLabel })
              : t("integrations.gateway.sync.importTitle", { provider: providerLabel })}
          </p>
          <p className="text-xs text-muted-foreground">
            {isOrders
              ? t("integrations.gateway.sync.salesImportDesc", { provider: providerLabel })
              : t("integrations.gateway.sync.importDesc", { provider: providerLabel })}
          </p>
        </div>
        <Button size="sm" disabled={isFetching} onClick={onFetch}>
          {isFetching ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              {fetchingLabel}
            </>
          ) : (
            <>
              <Search className="size-4" />
              {fetchLabel}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}

/* ── Sales Summary Card (prévia antes de importar) ── */

function SalesSummaryCard({
  summary,
  provider,
  onImport,
  onCancel,
}: {
  summary: SalesSyncSummary;
  provider: GatewayProvider;
  onImport: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();

  return (
    <Card variant="bordered" className="border-primary/20">
      <CardContent className="pt-6 space-y-4">
        <div className="space-y-1">
          <p className="text-base font-semibold text-foreground">
            {t("integrations.gateway.sync.salesSummaryTitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <SummaryItem
            label={t("integrations.gateway.sync.salesTotal", { count: summary.capped ? summary.total_fetched : summary.total })}
            variant="default"
          />
          <SummaryItem
            label={t("integrations.gateway.sync.salesEligible", { count: summary.eligible })}
            variant="success"
          />
          {summary.already_imported > 0 && (
            <SummaryItem
              label={t("integrations.gateway.sync.salesAlreadyImported", { count: summary.already_imported })}
              variant="muted"
            />
          )}
          {summary.unmapped_product > 0 && (
            <SummaryItem
              label={t("integrations.gateway.sync.salesUnmapped", { count: summary.unmapped_product })}
              variant="warning"
            />
          )}
          {summary.skipped_status > 0 && (
            <SummaryItem
              label={t("integrations.gateway.sync.salesSkippedStatus", { count: summary.skipped_status })}
              variant="muted"
            />
          )}
          {summary.skipped_no_email > 0 && (
            <SummaryItem
              label={t("integrations.gateway.sync.salesSkippedNoEmail", { count: summary.skipped_no_email })}
              variant="warning"
            />
          )}
          <SummaryItem
            label={t("integrations.gateway.sync.salesUniqueCustomers", { count: summary.unique_customers })}
            variant="default"
          />
        </div>

        {/* Produtos não mapeados */}
        {summary.unmapped_products.length > 0 && (
          <div className="rounded-lg border border-warning/20 bg-warning/5 p-3 space-y-1.5">
            <p className="text-xs font-medium text-foreground">
              {t("integrations.gateway.sync.salesUnmappedProducts")}
            </p>
            <ul className="space-y-0.5">
              {summary.unmapped_products.map((p) => (
                <li key={p.external_id} className="text-xs text-muted-foreground">
                  {t("integrations.gateway.sync.salesUnmappedProductItem", {
                    name: p.name || p.external_id,
                    count: p.count,
                  })}
                </li>
              ))}
            </ul>
            <p className="text-xs text-muted-foreground italic">
              {t("integrations.gateway.sync.salesUnmappedHint")}
            </p>
          </div>
        )}

        {summary.capped && (
          <div className="flex items-center gap-2 text-xs text-warning">
            <AlertCircle className="size-3.5 shrink-0" />
            {t("integrations.gateway.sync.salesCappedWarning")}
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between pt-2 border-t border-border">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t("integrations.gateway.sync.cancelButton")}
          </Button>
          <Button
            size="sm"
            disabled={summary.eligible === 0}
            onClick={onImport}
          >
            {t("integrations.gateway.sync.salesImportButton", { count: summary.eligible })}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SummaryItem({
  label,
  variant,
}: {
  label: string;
  variant: "default" | "success" | "warning" | "muted";
}) {
  const colors = {
    default: "text-foreground",
    success: "text-green-600 dark:text-green-400",
    warning: "text-warning",
    muted: "text-muted-foreground",
  };

  return (
    <p className={`text-sm ${colors[variant]}`}>
      {label}
    </p>
  );
}

/* ── Sync Progress (genericizado) ── */

const PRODUCT_PROGRESS_KEYS = [
  "integrations.gateway.sync.progressMsg1",
  "integrations.gateway.sync.progressMsg2",
  "integrations.gateway.sync.progressMsg3",
];

const SALES_PROGRESS_KEYS = [
  "integrations.gateway.sync.salesProgressMsg1",
  "integrations.gateway.sync.salesProgressMsg2",
  "integrations.gateway.sync.salesProgressMsg3",
];

function SyncProgress({
  count,
  resourceType,
}: {
  count: number;
  resourceType: "products" | "orders";
}) {
  const { t } = useTranslation();
  const [messageIndex, setMessageIndex] = useState(0);
  const [fakeProgress, setFakeProgress] = useState(5);
  const progressKeys = resourceType === "orders" ? SALES_PROGRESS_KEYS : PRODUCT_PROGRESS_KEYS;
  const label = resourceType === "orders"
    ? t("integrations.gateway.sync.salesProgressImporting", { count })
    : t("integrations.gateway.sync.progressImporting", { count });

  useEffect(() => {
    const msgInterval = setInterval(() => {
      setMessageIndex((prev) => (prev < progressKeys.length - 1 ? prev + 1 : prev));
    }, 3000);

    let timer: ReturnType<typeof setTimeout>;
    function tick() {
      setFakeProgress((prev) => {
        if (prev >= 99) return prev;
        let increment: number;
        let delay: number;
        if (prev < 30) { increment = 8; delay = 400; }
        else if (prev < 60) { increment = 4; delay = 500; }
        else if (prev < 90) { increment = 1.5; delay = 700; }
        else { increment = 1; delay = 2000; }
        const next = Math.min(99, prev + increment);
        timer = setTimeout(tick, delay);
        return next;
      });
    }
    timer = setTimeout(tick, 500);

    return () => { clearInterval(msgInterval); clearTimeout(timer); };
  }, []);

  return (
    <Card variant="bordered" className="border-primary/20">
      <CardContent className="pt-6 space-y-4">
        <div className="flex items-center gap-3">
          <Loader2 className="size-5 text-primary animate-spin shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t(progressKeys[messageIndex])}
            </p>
          </div>
        </div>
        <Progress value={fakeProgress} className="h-2" />
        <p className="text-xs text-muted-foreground text-center">
          {t("integrations.gateway.sync.doNotClose")}
        </p>
      </CardContent>
    </Card>
  );
}

/* ── Sync Result — Products ── */

function SyncResultProducts({
  job,
  onFetchAgain,
}: {
  job: SyncJob;
  onFetchAgain: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasErrors = job.error_count > 0;

  return (
    <div className="space-y-4">
      <Card variant="bordered" className={hasErrors ? "border-amber-500/30" : "border-emerald-500/30"}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                {t("integrations.gateway.sync.resultTitle")}
              </p>
              <div className="flex flex-wrap gap-3 mt-2">
                {job.created_count > 0 && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    {t("integrations.gateway.sync.resultCreated", { count: job.created_count })}
                  </Badge>
                )}
                {job.error_count > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-destructive">
                    <AlertCircle className="size-3" />
                    {t("integrations.gateway.sync.resultErrors", { count: job.error_count })}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onFetchAgain} className="gap-2">
          <Search className="size-4" />
          {t("integrations.gateway.sync.fetchAgain")}
        </Button>
        <Button onClick={() => navigate("/admin/products")} className="gap-2">
          {t("integrations.gateway.sync.viewProducts")}
        </Button>
      </div>
    </div>
  );
}

/* ── Sync Result — Orders ── */

function SyncResultOrders({
  job,
  onFetchAgain,
}: {
  job: SyncJob;
  onFetchAgain: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const hasErrors = job.error_count > 0;
  const params = (job as SyncJob & { params?: Record<string, unknown> }).params;
  const customersCreated = (params?.customers_created as number) ?? 0;
  const customersUpdated = (params?.customers_updated as number) ?? 0;

  return (
    <div className="space-y-4">
      <Card variant="bordered" className={hasErrors ? "border-amber-500/30" : "border-emerald-500/30"}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="size-6 text-emerald-600 shrink-0" />
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">
                {t("integrations.gateway.sync.salesResultTitle")}
              </p>
              <div className="flex flex-wrap gap-3 mt-2">
                {job.created_count > 0 && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <CheckCircle2 className="size-3 text-emerald-600" />
                    {t("integrations.gateway.sync.salesResultCreated", { count: job.created_count })}
                  </Badge>
                )}
                {customersCreated > 0 && (
                  <Badge variant="outline" className="text-xs gap-1">
                    <Users className="size-3 text-emerald-600" />
                    {t("integrations.gateway.sync.salesResultCustomersCreated", { count: customersCreated })}
                  </Badge>
                )}
                {customersUpdated > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                    <Users className="size-3" />
                    {t("integrations.gateway.sync.salesResultCustomersUpdated", { count: customersUpdated })}
                  </Badge>
                )}
                {job.updated_count > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
                    {t("integrations.gateway.sync.salesResultSkipped", { count: job.updated_count })}
                  </Badge>
                )}
                {job.error_count > 0 && (
                  <Badge variant="outline" className="text-xs gap-1 text-destructive">
                    <AlertCircle className="size-3" />
                    {t("integrations.gateway.sync.salesResultErrors", { count: job.error_count })}
                  </Badge>
                )}
              </div>

              {/* Info: reconcile-access não é automático */}
              <div className="flex items-start gap-2 mt-3 text-xs text-muted-foreground">
                <Info className="size-3.5 shrink-0 mt-0.5" />
                <p>{t("integrations.gateway.sync.salesResultNoReconcile")}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center gap-3">
        <Button variant="outline" onClick={onFetchAgain} className="gap-2">
          <Search className="size-4" />
          {t("integrations.gateway.sync.salesFetchAgain")}
        </Button>
        <Button onClick={() => navigate("/admin/orders")} className="gap-2">
          {t("integrations.gateway.sync.salesViewOrders")}
        </Button>
      </div>
    </div>
  );
}

/* ── Product Selection Table ── */

function ProductSelectionTable({
  products,
  provider,
  onImport,
  onCancel,
}: {
  products: NormalizedGatewayProduct[];
  provider: GatewayProvider;
  onImport: (ids: string[]) => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const eligible = useMemo(() => products.filter((p) => !p.already_imported), [products]);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const p of eligible) {
      if (p.status === "active") initial.add(p.external_id);
    }
    return initial;
  });

  const allEligibleSelected = eligible.length > 0 && eligible.every((p) => selectedIds.has(p.external_id));
  const someEligibleSelected = eligible.some((p) => selectedIds.has(p.external_id));

  function toggleAll() {
    if (allEligibleSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(eligible.map((p) => p.external_id)));
    }
  }

  function toggleOne(externalId: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(externalId)) next.delete(externalId);
      else next.add(externalId);
      return next;
    });
  }

  return (
    <Card variant="bordered" className="min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="w-full text-xs md:text-sm">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-9 bg-card px-3 w-[44px]">
                <Checkbox
                  checked={allEligibleSelected ? true : someEligibleSelected ? "indeterminate" : false}
                  onCheckedChange={toggleAll}
                />
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {t("integrations.gateway.sync.colProduct")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[100px]">
                {t("integrations.gateway.sync.colGatewayStatus")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[120px]">
                {t("integrations.gateway.sync.colType")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[100px]">
                {t("integrations.gateway.sync.colWarranty")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((p) => {
              const imported = p.already_imported;
              const checked = selectedIds.has(p.external_id);
              return (
                <TableRow
                  key={p.external_id}
                  className={imported ? "opacity-50" : "hover:bg-muted/30"}
                  data-state={checked ? "selected" : undefined}
                >
                  <TableCell className="px-3 py-2.5">
                    <Checkbox
                      checked={imported ? false : checked}
                      disabled={imported}
                      onCheckedChange={() => toggleOne(p.external_id)}
                    />
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground truncate">
                        {p.name}
                      </span>
                      {imported && (
                        <Badge variant="gray" className="text-[10px] shrink-0">
                          {t("integrations.gateway.sync.alreadyImported")}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="px-3 py-2.5">
                    <Badge variant={p.status === "active" ? "success" : "gray"}>
                      {p.status === "active"
                        ? t("integrations.gateway.sync.statusActive")
                        : t("integrations.gateway.sync.statusInactive")}
                    </Badge>
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground">
                    {p.is_subscription
                      ? t("integrations.gateway.sync.subscription")
                      : t("integrations.gateway.sync.oneTime")}
                  </TableCell>
                  <TableCell className="px-3 py-2.5 text-muted-foreground">
                    {p.warranty_days
                      ? t("integrations.gateway.sync.warrantyDays", { days: p.warranty_days })
                      : "—"}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between border-t border-border px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {t("integrations.gateway.sync.selectedCount", {
            selected: selectedIds.size,
            total: eligible.length,
          })}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {t("integrations.gateway.sync.cancelButton")}
          </Button>
          <Button
            size="sm"
            disabled={selectedIds.size === 0}
            onClick={() => onImport(Array.from(selectedIds))}
          >
            {t("integrations.gateway.sync.importButton", { count: selectedIds.size })}
          </Button>
        </div>
      </div>
    </Card>
  );
}

/* ── Imported Products Table ── */

function ImportedProductsTable({
  products,
  provider,
}: {
  products: SyncedProduct[];
  provider: GatewayProvider;
}) {
  const { t } = useTranslation();
  const providerLabel = provider.charAt(0).toUpperCase() + provider.slice(1);

  return (
    <Card variant="bordered" className="min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="w-full text-xs md:text-sm">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                Produto
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[120px]">
                Status
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[160px]">
                ID {providerLabel}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[140px]">
                Criado em
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {products.map((product) => (
              <TableRow key={product.id} className="hover:bg-muted/30">
                <TableCell className="px-3 py-2.5">
                  <div className="flex items-center gap-3">
                    {product.cover_url ? (
                      <img
                        src={product.cover_url}
                        alt={product.name}
                        className="size-8 rounded-md object-cover shrink-0"
                      />
                    ) : (
                      <div className="size-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                        <Package className="size-4 text-muted-foreground" />
                      </div>
                    )}
                    <span className="font-medium text-foreground truncate">
                      {product.name}
                    </span>
                  </div>
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <Badge variant={product.status === "active" ? "success" : product.status === "draft" ? "amber" : "gray"}>
                    {product.status === "active" ? t("products.statusLabels.active") : product.status === "archived" ? t("products.statusLabels.archived") : t("products.statusLabels.draft")}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <code className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                    {product.external_product_id}
                  </code>
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {new Date(product.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ── Imported Orders Table ── */

const ORDER_STATUS_VARIANT: Record<string, string> = {
  approved: "success",
  completed: "success",
  pending: "amber",
  refunded: "gray",
  cancelled: "gray",
  chargeback: "destructive",
  disputed: "destructive",
};

function ImportedOrdersTable({ orders }: { orders: SyncedOrder[] }) {
  const { t } = useTranslation();

  return (
    <Card variant="bordered" className="min-w-0 overflow-hidden">
      <div className="overflow-x-auto">
        <Table className="w-full text-xs md:text-sm">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {t("integrations.gateway.sync.ordersColCustomer")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
                {t("integrations.gateway.sync.ordersColProduct")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[100px]">
                {t("integrations.gateway.sync.ordersColAmount")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[100px]">
                {t("integrations.gateway.sync.ordersColStatus")}
              </TableHead>
              <TableHead className="h-9 bg-card px-3 text-[10px] uppercase tracking-wider text-muted-foreground font-medium w-[120px]">
                {t("integrations.gateway.sync.ordersColDate")}
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {orders.map((order) => (
              <TableRow key={order.id} className="hover:bg-muted/30">
                <TableCell className="px-3 py-2.5">
                  <span className="font-medium text-foreground truncate">
                    {order.customer_name}
                  </span>
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground truncate">
                  {order.product_name}
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {order.unit_amount != null && order.unit_amount > 0
                    ? new Intl.NumberFormat("pt-BR", {
                        style: "currency",
                        currency: order.currency ?? "BRL",
                      }).format(order.unit_amount / 100)
                    : "—"}
                </TableCell>
                <TableCell className="px-3 py-2.5">
                  <Badge variant={(ORDER_STATUS_VARIANT[order.status] ?? "gray") as "success" | "amber" | "gray" | "destructive"}>
                    {order.status}
                  </Badge>
                </TableCell>
                <TableCell className="px-3 py-2.5 text-muted-foreground">
                  {new Date(order.gateway_order_created_at ?? order.created_at).toLocaleDateString("pt-BR")}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}

/* ── Empty State (genérico) ── */

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
}) {
  return (
    <Card variant="bordered">
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Icon className="size-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
        <p className="text-muted-foreground max-w-sm">{description}</p>
      </CardContent>
    </Card>
  );
}
