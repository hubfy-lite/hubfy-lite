import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Search, Receipt, TrendingUp, DollarSign, Loader2, Eye, X } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { addDays, startOfDay } from "date-fns";
import type { DateRange } from "react-day-picker";
import { formatDateTime } from "@/lib/utils";

import { TableSkeleton } from "@/components/admin/TableSkeleton";
import OrderDetailSheet from "@/components/admin/OrderDetailSheet";
import { ActionsMenu } from "@/components/admin/ActionsMenu";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MultiSelect } from "@/components/ui/multi-select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { supabase } from "@/integrations/supabase/client";
import { translateAppError } from "@/lib/app-error-utils";
import { useOrders, DEFAULT_ORDERS_FILTERS, hasActiveFilters } from "@/hooks/useOrders";
import type { OrdersFilters } from "@/hooks/useOrders";
import { useOrderMetrics } from "@/hooks/useOrderMetrics";
import { useProducts } from "@/hooks/useProducts";
import type { Database } from "@/integrations/supabase/types";

type OrderStatus = Database["public"]["Enums"]["order_status"];

const ORDER_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending:    "amber",
  approved:   "green",
  completed:  "blue",
  refunded:   "gray",
  cancelled:  "red",
  disputed:   "purple",
  chargeback: "red",
};

const ORDER_STATUSES: OrderStatus[] = [
  "pending", "approved", "completed", "refunded", "cancelled", "disputed", "chargeback",
];

const ORDER_SOURCES = [
  "api", "csv_import", "external_gateway", "hubfy", "manual",
] as const;

function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}

/** Read filters from URL search params */
function filtersFromParams(sp: URLSearchParams): OrdersFilters {
  const statusRaw = sp.get("status");
  const productRaw = sp.get("product");
  const sourceRaw = sp.get("source");
  return {
    search: sp.get("q") ?? "",
    status: statusRaw ? statusRaw.split(",").filter(Boolean) : [],
    productId: productRaw ? productRaw.split(",").filter(Boolean) : [],
    source: sourceRaw ? sourceRaw.split(",").filter(Boolean) : [],
    startAt: sp.get("from") ?? null,
    endAt: sp.get("to") ?? null,
  };
}

/** Write filters to URL search params (preserves ?id= for the sheet) */
function filtersToParams(f: OrdersFilters, sp: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams();
  // preserve sheet id
  const sheetId = sp.get("id");
  if (sheetId) next.set("id", sheetId);
  if (f.search) next.set("q", f.search);
  if (f.status.length > 0) next.set("status", f.status.join(","));
  if (f.productId.length > 0) next.set("product", f.productId.join(","));
  if (f.source.length > 0) next.set("source", f.source.join(","));
  if (f.startAt) next.set("from", f.startAt);
  if (f.endAt) next.set("to", f.endAt);
  return next;
}

/** Convert DateRange from calendar to startAt/endAt ISO timestamps (exclusive end).
 *  Single-day click (no `to`) = filter for that one day only. */
function dateRangeToStrings(range: DateRange | undefined): { startAt: string | null; endAt: string | null } {
  if (!range?.from) return { startAt: null, endAt: null };
  const start = startOfDay(range.from);
  const endDay = range.to ? addDays(startOfDay(range.to), 1) : addDays(start, 1);
  return {
    startAt: start.toISOString(),
    endAt: endDay.toISOString(),
  };
}

/** Convert startAt/endAt ISO timestamps back to DateRange for the calendar */
function stringsToDateRange(startAt: string | null, endAt: string | null): DateRange | undefined {
  if (!startAt) return undefined;
  const from = startOfDay(new Date(startAt));
  if (!endAt) return { from };
  const to = addDays(startOfDay(new Date(endAt)), -1);
  // If from === to it was a single-day selection
  if (from.getTime() === to.getTime()) return { from };
  return { from, to };
}


export default function AdminOrders() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // ── Filters from URL ──
  const filters = useMemo(() => filtersFromParams(searchParams), [searchParams]);
  const active = hasActiveFilters(filters);

  // Local input state for debounced search
  const [searchInput, setSearchInput] = useState(filters.search);

  // Re-hydrate searchInput when URL changes externally (back/forward/link)
  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  // Debounced filters: search is debounced, rest are instant
  const [debouncedFilters, setDebouncedFilters] = useState(filters);

  // Refs so the debounce timer always reads current values
  const filtersRef = useRef(filters);
  filtersRef.current = filters;
  const searchParamsRef = useRef(searchParams);
  searchParamsRef.current = searchParams;

  // Sync debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedFilters((prev) => ({ ...prev, search: searchInput }));
      // Read current filters/params via refs to avoid stale closure
      const next = filtersToParams({ ...filtersRef.current, search: searchInput }, searchParamsRef.current);
      setSearchParams(next, { replace: true });
    }, 400);
    return () => clearTimeout(timer);
  }, [searchInput, setSearchParams]);

  // Sync non-search filters immediately
  useEffect(() => {
    setDebouncedFilters((prev) => ({
      ...prev,
      status: filters.status,
      productId: filters.productId,
      source: filters.source,
      startAt: filters.startAt,
      endAt: filters.endAt,
    }));
  }, [filters.status, filters.productId, filters.startAt, filters.endAt]);

  // ── Filter setters ──
  const setFilter = useCallback(
    (patch: Partial<OrdersFilters>) => {
      const updated = { ...filters, ...patch };
      setSearchParams(filtersToParams(updated, searchParams), { replace: true });
    },
    [filters, searchParams, setSearchParams],
  );

  const clearFilters = useCallback(() => {
    setSearchInput("");
    const next = new URLSearchParams();
    const sheetId = searchParams.get("id");
    if (sheetId) next.set("id", sheetId);
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // ── Date range for calendar component ──
  const dateRange = useMemo(
    () => stringsToDateRange(filters.startAt, filters.endAt),
    [filters.startAt, filters.endAt],
  );
  const handleDateRangeChange = useCallback(
    (range: DateRange | undefined) => {
      const { startAt, endAt } = dateRangeToStrings(range);
      setFilter({ startAt, endAt });
    },
    [setFilter],
  );

  // ── Delete state ──
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; customerName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  // ── Data hooks ──
  const {
    orders,
    totalCount,
    loading,
    error: ordersError,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useOrders(debouncedFilters);
  const { metrics, loading: metricsLoading, filtered: metricsFiltered } = useOrderMetrics(debouncedFilters);
  const { products } = useProducts();

  // Query-param driven sheet state
  const selectedOrderId = searchParams.get("id");
  const previewData = orders.find((o) => o.public_id === selectedOrderId) ?? null;

  const handleOpenOrder = (orderId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("id", orderId);
    setSearchParams(next);
  };

  const handleSheetOpenChange = (open: boolean) => {
    if (!open) {
      const next = new URLSearchParams(searchParams);
      next.delete("id");
      setSearchParams(next, { replace: true });
    }
  };

  const handleCopyId = (orderPublicId: string) => {
    navigator.clipboard.writeText(orderPublicId);
    toast.success(t("orders.actions.saleIdCopied"));
  };

  const handleDeleteOrder = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const { error } = await supabase
        .from("orders")
        .delete()
        .eq("id", deleteTarget.id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["orders"] });
      toast.success(t("orderDetail.deleteSuccess"));
    } catch (error: unknown) {
      toast.error(translateAppError(error, t("orderDetail.deleteError")));
    } finally {
      setDeleting(false);
      setDeleteTarget(null);
    }
  };

  // Infinite scroll via window scroll
  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 300
      ) {
        if (hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  return (
    <>
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex min-w-0 max-w-[1200px] 3xl:max-w-[1600px] flex-col gap-6">
        {/* Header */}
        <div className="flex min-w-0 shrink-0 flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <h1 className="min-w-0 truncate text-xl font-semibold tracking-normal text-foreground md:text-2xl">
              {t("orders.title")}
            </h1>
          </div>

        </div>

        {/* Metrics Cards */}
        {metricsFiltered ? (
          /* Filtered mode: 2 cards */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card variant="bordered">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <TrendingUp className="size-4 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t("orders.filters.filteredSales")}</p>
                  </div>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <p className="text-2xl font-semibold text-foreground">
                      {metrics.totalOrders.toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card variant="bordered">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-success/10">
                      <DollarSign className="size-4 text-success" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t("orders.filters.filteredRevenue")}</p>
                  </div>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <p className="text-2xl font-semibold text-foreground">
                      {formatCurrency(metrics.revenueTotal)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        ) : (
          /* Default mode: 3 cards */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card variant="bordered">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <TrendingUp className="size-4 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t("orders.metrics.orders")}</p>
                  </div>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-24" />
                  ) : (
                    <p className="text-2xl font-semibold text-foreground">
                      {metrics.totalOrders.toLocaleString("pt-BR")}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card variant="bordered">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-success/10">
                      <DollarSign className="size-4 text-success" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t("orders.metrics.revenueToday")}</p>
                  </div>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <p className="text-2xl font-semibold text-foreground">
                      {formatCurrency(metrics.revenueToday)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card variant="bordered">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10">
                      <DollarSign className="size-4 text-primary" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t("orders.metrics.revenueTotal")}</p>
                  </div>
                  {metricsLoading ? (
                    <Skeleton className="h-8 w-32" />
                  ) : (
                    <p className="text-2xl font-semibold text-foreground">
                      {formatCurrency(metrics.revenueTotal)}
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Filters toolbar */}
        <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          {/* Search */}
          <div className="relative min-w-0 flex-1 max-w-none sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
            <Input
              placeholder={t("orders.searchPlaceholder")}
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="h-9 pl-8 text-sm md:h-10 md:pl-9"
            />
          </div>

          {/* Status */}
          <MultiSelect
            options={ORDER_STATUSES.map((s) => ({
              value: s,
              label: t(`orders.statusLabels.${s}`),
            }))}
            value={filters.status}
            onValueChange={(v) => setFilter({ status: v })}
            placeholder={t("orders.filters.allStatuses")}
            className="h-9 w-full sm:w-[180px] md:h-10"
          />

          {/* Product */}
          <MultiSelect
            options={products.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
            value={filters.productId}
            onValueChange={(v) => setFilter({ productId: v })}
            placeholder={t("orders.filters.allProducts")}
            className="h-9 w-full sm:w-[220px] md:h-10"
          />

          {/* Source / Origem */}
          <MultiSelect
            options={ORDER_SOURCES.map((s) => ({
              value: s,
              label: t(`orders.sourceLabels.${s}`),
            }))}
            value={filters.source}
            onValueChange={(v) => setFilter({ source: v })}
            placeholder={t("orders.filters.allSources")}
            className="h-9 w-full sm:w-[180px] md:h-10"
          />

          {/* Date range */}
          <DateRangePicker
            value={dateRange}
            onChange={handleDateRangeChange}
            placeholder={t("orders.filters.dateRange")}
          />

          {/* Clear filters */}
          {active && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="h-9 gap-1.5 text-muted-foreground md:h-10"
            >
              <X className="size-3.5" />
              {t("orders.filters.clearFilters")}
            </Button>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <TableSkeleton rows={5} columns={6} />
        ) : ordersError ? (
          <Card variant="bordered">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-16 rounded-2xl bg-destructive/10 flex items-center justify-center mb-4">
                <Receipt className="size-8 text-destructive" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {t("common.error")}
              </h3>
              <p className="text-muted-foreground max-w-sm text-sm">
                {ordersError.message}
              </p>
            </CardContent>
          </Card>
        ) : orders.length === 0 ? (
          <Card variant="bordered">
            <CardContent className="flex flex-col items-center justify-center py-16 text-center">
              <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                <Receipt className="size-8 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                {active ? t("orders.filters.noResults") : t("orders.emptyTitle")}
              </h3>
              <p className="text-muted-foreground max-w-sm">
                {active ? t("orders.filters.noResultsDescription") : t("orders.emptyDescription")}
              </p>
              {active && (
                <Button variant="outline" size="sm" onClick={clearFilters} className="mt-4">
                  {t("orders.filters.clearFilters")}
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <Card variant="bordered" className="min-w-0 overflow-hidden">
            <div className="overflow-auto">
              <div className="min-w-[800px]">
              <Table className="w-full table-fixed text-xs md:text-sm">
                <TableHeader>
                  <TableRow className="border-border hover:bg-transparent">
                    <TableHead className="h-9 w-[50px] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">#</TableHead>
                    <TableHead className="h-9 w-[25%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("orders.columns.customer")}</TableHead>
                    <TableHead className="h-9 w-[31%] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("orders.columns.product")}</TableHead>
                    <TableHead className="h-9 w-[100px] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("orders.columns.amount")}</TableHead>
                    <TableHead className="h-9 w-[120px] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("orders.columns.status")}</TableHead>
                    <TableHead className="h-9 w-[140px] bg-card px-3 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-4 md:text-xs">{t("orders.columns.date")}</TableHead>
                    <TableHead className="h-9 w-[50px] bg-card px-3 md:h-10 md:px-4" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orders.map((order) => (
                    <TableRow
                      key={order.id}
                      className="cursor-pointer border-border hover:bg-muted/30"
                      onClick={() => handleOpenOrder(order.public_id)}
                    >
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <span className="text-xs font-medium text-muted-foreground md:text-sm">
                          {order.order_number ?? "—"}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            <p className="truncate text-xs font-medium text-foreground md:text-sm">
                              {order.customer_name}
                            </p>
                            {order.source === "csv_import" && (
                              <Badge variant="amber" className="shrink-0 text-[10px] px-1.5 py-0">
                                {t("orders.sourceLabels.csv_import")}
                              </Badge>
                            )}
                          </div>
                          <p className="truncate text-[10px] text-muted-foreground md:text-xs">
                            {order.customer_email}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs text-muted-foreground truncate min-w-0 md:text-sm">
                            {order.product_name}
                          </span>
                          {order.is_order_bump && (
                            <Badge variant="outline" className="shrink-0 text-[10px] px-1.5 py-0">
                              bump
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <span className="text-xs font-medium md:text-sm">
                          {order.source === "csv_import"
                            ? "—"
                            : order.unit_amount === 0
                              ? t("common.free")
                              : formatCurrency(order.unit_amount, order.currency)}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <Badge variant={ORDER_STATUS_VARIANTS[order.status] ?? "gray"} className="text-[10px] md:text-xs">
                          {t(`orders.statusLabels.${order.status}`)}
                        </Badge>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4">
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap md:text-xs">
                          {formatDateTime(order.effective_order_at, lang)}
                        </span>
                      </TableCell>
                      <TableCell className="px-3 py-2.5 md:p-4" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-0.5">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => handleOpenOrder(order.public_id)}
                          >
                            <Eye className="size-4" />
                          </Button>
                          <ActionsMenu
                            items={[
                              {
                                label: t("common.copyId"),
                                onClick: () => handleCopyId(order.public_id),
                              },
                              {
                                label: t("orders.actions.viewDetails"),
                                onClick: () => navigate(`/admin/orders/${order.public_id}`),
                              },
                              {
                                label: t("common.delete"),
                                onClick: () => setDeleteTarget({ id: order.id, customerName: order.customer_name }),
                                destructive: true,
                              },
                            ]}
                          />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Infinite scroll sentinel + loader */}
              <div className="flex items-center justify-center py-4">
                {isFetchingNextPage && (
                  <Loader2 className="size-5 animate-spin text-muted-foreground" />
                )}
                {!hasNextPage && orders.length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {t("orders.pagination.showing", {
                      from: orders.length,
                      to: orders.length,
                      total: totalCount,
                    })}
                  </p>
                )}
              </div>
              </div>
            </div>
          </Card>
        )}
        </div>
      </div>

      {/* Order detail sheet */}
      <OrderDetailSheet
        orderId={selectedOrderId}
        previewData={previewData}
        onOpenChange={handleSheetOpenChange}
      />

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("orderDetail.deleteConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("orderDetail.deleteConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteOrder}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                t("orderDetail.deleteOrderCta")
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
