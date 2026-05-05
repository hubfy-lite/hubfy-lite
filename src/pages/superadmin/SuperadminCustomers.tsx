import { useState, useEffect } from "react";
import { Search, Users, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import SuperadminLayout from "@/components/superadmin/SuperadminLayout";
import { TableSkeleton } from "@/components/admin/TableSkeleton";
import { CopyableId } from "@/components/superadmin/CopyableId";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSuperadminCustomers } from "@/hooks/superadmin/useSuperadminCustomers";
import { formatDateTime } from "@/lib/utils";

function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}


function AccountBadge({
  userId,
  emailConfirmedAt,
  t,
}: {
  userId: string | null;
  emailConfirmedAt: string | null;
  t: (key: string) => string;
}) {
  if (!userId) {
    return (
      <Badge variant="gray" className="text-[10px] md:text-xs">
        {t("superadmin.customers.noAccount")}
      </Badge>
    );
  }
  if (emailConfirmedAt) {
    return (
      <Badge variant="green" className="text-[10px] md:text-xs">
        {t("superadmin.customers.confirmed")}
      </Badge>
    );
  }
  return (
    <Badge variant="amber" className="text-[10px] md:text-xs">
      {t("superadmin.customers.pending")}
    </Badge>
  );
}

export default function SuperadminCustomers() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [tenantFilter, setTenantFilter] = useState<string | null>(null);

  const {
    customers,
    totalCount,
    loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuperadminCustomers(debouncedSearch, tenantFilter);

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
              {t("superadmin.customers.title")}
            </h1>
            <div className="flex gap-3">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
                <Input
                  placeholder={t("superadmin.customers.searchPlaceholder")}
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  className="h-9 pl-8 text-sm md:h-10 md:pl-9"
                />
              </div>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <TableSkeleton rows={5} columns={9} />
          ) : customers.length === 0 ? (
            <Card variant="bordered">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Users className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("superadmin.customers.noCustomersFound")}
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  {debouncedSearch
                    ? t("superadmin.customers.tryDifferentSearch")
                    : t("superadmin.customers.noCustomersCreated")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card variant="bordered" className="min-w-0 overflow-hidden">
              <div className="overflow-auto">
                <div className="min-w-[1000px]">
                  <Table className="w-full table-fixed text-xs md:text-sm">
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="h-9 w-[68px] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.id")}
                        </TableHead>
                        <TableHead className="h-9 w-[13%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.name")}
                        </TableHead>
                        <TableHead className="h-9 w-[17%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.email")}
                        </TableHead>
                        <TableHead className="h-9 w-[12%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.tenant")}
                        </TableHead>
                        <TableHead className="h-9 w-[9%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.revenue")}
                        </TableHead>
                        <TableHead className="h-9 w-[6%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.orders")}
                        </TableHead>
                        <TableHead className="h-9 w-[9%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.account")}
                        </TableHead>
                        <TableHead className="h-9 w-[11%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.lastLogin")}
                        </TableHead>
                        <TableHead className="h-9 w-[11%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.created")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {customers.map((c) => (
                        <TableRow key={c.id} className="border-border">
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <CopyableId id={c.id} />
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-sm font-medium">
                              {c.name || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-xs text-muted-foreground">
                              {c.email}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-xs text-muted-foreground">
                              {c.tenant_name}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 text-right font-medium md:px-3">
                            <span className="block truncate">
                              {formatCurrency(c.total_revenue_cents)}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2.5 text-right md:px-3">
                            {c.orders_count}
                          </TableCell>
                          <TableCell className="px-2 py-2.5 md:px-3">
                            <AccountBadge
                              userId={c.user_id}
                              emailConfirmedAt={c.email_confirmed_at}
                              t={t}
                            />
                          </TableCell>
                          <TableCell className="px-2 py-2.5 text-right md:px-3">
                            <span className="text-[10px] text-muted-foreground whitespace-nowrap md:text-xs">
                              {c.last_sign_in_at
                                ? formatDateTime(c.last_sign_in_at, lang)
                                : t("superadmin.customers.never")}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2.5 text-right text-muted-foreground md:px-3">
                            <span className="text-[10px] whitespace-nowrap md:text-xs">
                              {formatDateTime(c.created_at, lang)}
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
                    {!hasNextPage && customers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("superadmin.customers.showingOf", { count: customers.length, total: totalCount })}
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
