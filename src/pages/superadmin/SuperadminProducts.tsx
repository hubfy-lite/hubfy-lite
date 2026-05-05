import { useState, useEffect } from "react";
import { Search, ShoppingBag, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import SuperadminLayout from "@/components/superadmin/SuperadminLayout";
import { TableSkeleton } from "@/components/admin/TableSkeleton";
import { CopyableId } from "@/components/superadmin/CopyableId";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge, type BadgeVariant } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSuperadminProducts } from "@/hooks/superadmin/useSuperadminProducts";
import { formatDateOnly } from "@/lib/utils";

const PRODUCT_STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "amber",
  active: "green",
  archived: "gray",
};

function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}


export default function SuperadminProducts() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const {
    products,
    totalCount,
    loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuperadminProducts(debouncedSearch);

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
              {t("superadmin.products.title")}
            </h1>
            <div className="relative w-full max-w-sm">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
              <Input
                placeholder={t("superadmin.products.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 pl-8 text-sm md:h-10 md:pl-9"
              />
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : products.length === 0 ? (
            <Card variant="bordered">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <ShoppingBag className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("superadmin.products.noProductsFound")}
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  {debouncedSearch
                    ? t("superadmin.products.tryDifferentSearch")
                    : t("superadmin.products.noProductsCreated")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card variant="bordered" className="min-w-0 overflow-hidden">
              <div className="overflow-auto">
                <div className="min-w-[800px]">
                  <Table className="w-full table-fixed text-xs md:text-sm">
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="h-9 w-[68px] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.id")}
                        </TableHead>
                        <TableHead className="h-9 w-[22%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.name")}
                        </TableHead>
                        <TableHead className="h-9 w-[18%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.tenant")}
                        </TableHead>
                        <TableHead className="h-9 w-[13%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.price")}
                        </TableHead>
                        <TableHead className="h-9 w-[12%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.status")}
                        </TableHead>
                        <TableHead className="h-9 w-[12%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.benefit")}
                        </TableHead>
                        <TableHead className="h-9 w-[13%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.created")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {products.map((product) => (
                        <TableRow key={product.id} className="border-border">
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <CopyableId id={product.id} />
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-sm font-medium">
                              {product.name}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-xs text-muted-foreground">
                              {product.tenant_name}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 text-right font-medium md:px-3">
                            <span className="block truncate">
                              {product.unit_amount === 0
                                ? t("superadmin.products.free")
                                : formatCurrency(product.unit_amount, product.currency)}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2.5 md:px-3">
                            <Badge
                              variant={PRODUCT_STATUS_VARIANTS[product.status]}
                              className="text-[10px] md:text-xs"
                            >
                              {t(`products.statusLabels.${product.status}`)}
                            </Badge>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-xs text-muted-foreground">
                              {product.benefit ?? "—"}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2.5 text-right text-muted-foreground md:px-3">
                            {formatDateOnly(product.created_at, lang)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-center py-4">
                    {isFetchingNextPage && (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    )}
                    {!hasNextPage && products.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("superadmin.products.showingOf", { count: products.length, total: totalCount })}
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
