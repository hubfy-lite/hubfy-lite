import { useState, useEffect } from "react";
import { Search, Store, Loader2 } from "lucide-react";
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
import { useSuperadminSellers } from "@/hooks/superadmin/useSuperadminSellers";
import { formatDateOnly } from "@/lib/utils";

const STATUS_VARIANTS: Record<string, BadgeVariant> = {
  draft: "gray",
  pending: "yellow",
  approved: "green",
  rejected: "red",
  disabled: "gray",
  deleted: "gray",
};


function formatDocument(value: string | null, type: "cpf" | "cnpj"): string {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (type === "cpf") return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export default function SuperadminSellers() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  const STATUS_LABELS: Record<string, string> = {
    draft: t("superadmin.sellers.statusDraft"),
    pending: t("superadmin.sellers.statusPending"),
    approved: t("superadmin.sellers.statusApproved"),
    rejected: t("superadmin.sellers.statusRejected"),
    disabled: t("superadmin.sellers.statusDisabled"),
    deleted: t("superadmin.sellers.statusDeleted"),
  };

  const {
    sellers,
    totalCount,
    loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuperadminSellers(debouncedSearch, statusFilter);

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
              {t("superadmin.sellers.title")}
            </h1>
            <div className="flex gap-3 flex-wrap">
              <div className="relative w-full max-w-sm">
                <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
                <Input
                  placeholder={t("superadmin.sellers.searchPlaceholder")}
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
                  <SelectValue placeholder={t("superadmin.table.status")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t("superadmin.sellers.allStatuses")}</SelectItem>
                  {Object.entries(STATUS_LABELS).map(([key, label]) => (
                    <SelectItem key={key} value={key}>{label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Content */}
          {loading ? (
            <TableSkeleton rows={5} columns={7} />
          ) : sellers.length === 0 ? (
            <Card variant="bordered">
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Store className="size-8 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">
                  {t("superadmin.sellers.noSellersFound")}
                </h3>
                <p className="text-muted-foreground max-w-sm">
                  {debouncedSearch || statusFilter
                    ? t("superadmin.sellers.tryDifferentFilters")
                    : t("superadmin.sellers.noSellersCreated")}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card variant="bordered" className="min-w-0 overflow-hidden">
              <div className="overflow-auto">
                <div className="min-w-[900px]">
                  <Table className="w-full table-fixed text-xs md:text-sm">
                    <TableHeader>
                      <TableRow className="border-border hover:bg-transparent">
                        <TableHead className="h-9 w-[18%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.tenant")}
                        </TableHead>
                        <TableHead className="h-9 w-[6%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.type")}
                        </TableHead>
                        <TableHead className="h-9 w-[22%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.nameOrBusinessName")}
                        </TableHead>
                        <TableHead className="h-9 w-[16%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.cpfOrCnpj")}
                        </TableHead>
                        <TableHead className="h-9 w-[12%] bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.status")}
                        </TableHead>
                        <TableHead className="h-9 w-[13%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.submittedAt")}
                        </TableHead>
                        <TableHead className="h-9 w-[13%] bg-card px-2 text-[10px] font-semibold text-muted-foreground text-right md:h-10 md:px-3 md:text-xs">
                          {t("superadmin.table.created")}
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sellers.map((s) => (
                        <TableRow key={s.id} className="border-border">
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-foreground md:text-sm">
                                {s.tenant_name}
                              </p>
                              <CopyableId id={s.tenant_id} />
                            </div>
                          </TableCell>
                          <TableCell className="px-2 py-2.5 md:px-3">
                            <Badge variant="outline" className="text-[10px] md:text-xs">
                              {s.type === "individual" ? t("superadmin.sellers.individual") : t("superadmin.sellers.business")}
                            </Badge>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-xs text-foreground md:text-sm">
                              {s.type === "business"
                                ? s.business_name ?? "—"
                                : `${s.first_name ?? ""} ${s.last_name ?? ""}`.trim() || "—"}
                            </span>
                          </TableCell>
                          <TableCell className="overflow-hidden px-2 py-2.5 md:px-3">
                            <span className="block truncate text-xs text-muted-foreground">
                              {s.type === "business"
                                ? formatDocument(s.ein, "cnpj")
                                : formatDocument(s.taxpayer_id, "cpf")}
                            </span>
                          </TableCell>
                          <TableCell className="px-2 py-2.5 md:px-3">
                            <Badge variant={STATUS_VARIANTS[s.status]} className={`text-[10px] md:text-xs${s.status === "deleted" ? " line-through" : ""}`}>
                              {STATUS_LABELS[s.status] ?? s.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="px-2 py-2.5 text-right text-muted-foreground md:px-3">
                            {formatDateOnly(s.submitted_at, lang)}
                          </TableCell>
                          <TableCell className="px-2 py-2.5 text-right text-muted-foreground md:px-3">
                            {formatDateOnly(s.created_at, lang)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <div className="flex items-center justify-center py-4">
                    {isFetchingNextPage && (
                      <Loader2 className="size-5 animate-spin text-muted-foreground" />
                    )}
                    {!hasNextPage && sellers.length > 0 && (
                      <p className="text-xs text-muted-foreground">
                        {t("superadmin.sellers.showingOf", { count: sellers.length, total: totalCount })}
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
