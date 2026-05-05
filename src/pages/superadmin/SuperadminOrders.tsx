import { useState, useEffect } from "react";
import { Search, Receipt, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import SuperadminLayout from "@/components/superadmin/SuperadminLayout";
import { TableSkeleton } from "@/components/admin/TableSkeleton";
import { CopyableId } from "@/components/superadmin/CopyableId";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSuperadminOrders } from "@/hooks/superadmin/useSuperadminOrders";
import { formatDateTime } from "@/lib/utils";

const ORDER_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  pending:    "amber",
  approved:   "green",
  completed:  "blue",
  refunded:   "gray",
  cancelled:  "red",
  disputed:   "purple",
  chargeback: "red",
};

function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}


export default function SuperadminOrders() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const STATUS_OPTIONS = [
    { value: "all", label: t("superadmin.orders.allStatuses") },
    { value: "pending", label: t("superadmin.orders.statusPending") },
    { value: "approved", label: t("superadmin.orders.statusApproved") },
    { value: "completed", label: t("superadmin.orders.statusCompleted") },
    { value: "refunded", label: t("superadmin.orders.statusRefunded") },
    { value: "cancelled", label: t("superadmin.orders.statusCancelled") },
    { value: "disputed", label: t("superadmin.orders.statusDisputed") },
  ];

  const {
    orders,
    totalCount,
    loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuperadminOrders(debouncedSearch, null, statusFilter);

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
  }, [searchInput]);

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
    <SuperadminLayout>
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-6">
          {/* Header */}
          <div className="flex flex-col gap-3">
            <h1 className="text-xl font-semibold tracking-normal text-foreground md:text-2xl">
              {t("superadmin.orders.title")}
            </h1>
            <div className="flex gap-3 flex-wrap">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
                <Input
                  placeholder={t("superadmin.orders.searchPlaceholder")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 pl-8 text-sm md:h-10 md:pl-9"
                />
              </div>
              <Select
                value={statusFilter ?? "all"}
                onValueChange={(v) => setStatusFilter(v === "all" ? null : v)}
              >
                <SelectTrigger className="h-9 w-[160px] text-sm md:h-10">
                  <SelectValue placeholder={t("superadmin.orders.allStatuses")} />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <TableSkeleton rows={5} columns={8} />
          ) : orders.length === 0 ? (
            <Card variant="bordered">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Receipt className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("superadmin.orders.noOrdersFound")}
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  {debouncedSearch || statusFilter
                    ? t("superadmin.orders.tryDifferentFilters")
                    : t("superadmin.orders.noOrdersCreated")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card variant="bordered" className="min-w-0 overflow-hidden">
              <div className="overflow-auto">
                <div className="min-w-[850px]">
                  <Table className="w-full table-fixed text-xs md:text-sm">
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="h-9 w-[68px] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.id")}
                        </TableHead>
                        <TableHead className="h-9 w-[20%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.customers")}
                        </TableHead>
                        <TableHead className="h-9 w-[22%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.products")}
                        </TableHead>
                        <TableHead className="h-9 w-[14%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.tenant")}
                        </TableHead>
                        <TableHead className="h-9 w-[10%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.amount")}
                        </TableHead>
                        <TableHead className="h-9 w-[9%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.status")}
                        </TableHead>
                        <TableHead className="h-9 w-[12%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.date")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {orders.map((order) => (
                        <TableRow key={order.id} className="border-border">
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <CopyableId id={order.id} />
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground md:text-sm">
                                {order.customer_name}
                              </p>
                              <p className="truncate text-[10px] text-muted-foreground md:text-xs">
                                {order.customer_email}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-xs text-muted-foreground md:text-sm">
                              {order.product_name}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-xs text-muted-foreground">
                              {order.tenant_name}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 text-right font-medium md:px-3">
                            <span className="block truncate text-xs md:text-sm">
                              {order.unit_amount === 0
                                ? t("superadmin.orders.free")
                                : formatCurrency(order.unit_amount, order.currency)}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2.5 md:px-3">
                            <Badge
                              variant={ORDER_STATUS_VARIANTS[order.status] ?? "gray"}
                              className="text-[10px] md:text-xs"
                            >
                              {order.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-2 py-2.5 text-right md:px-3">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap md:text-xs">
                              {formatDateTime(order.effective_order_at, lang)}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-center py-4">
                    {isFetchingNextPage && (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    )}
                    {!hasNextPage && orders.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("superadmin.orders.showingOf", { count: orders.length, total: totalCount })}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          )}
        </div>
      </div>
    </SuperadminLayout>
  );
}
