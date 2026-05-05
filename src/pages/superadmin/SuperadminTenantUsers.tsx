import { useState, useEffect } from "react";
import { Search, UsersRound, Loader2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { TableSkeleton } from "@/components/admin/TableSkeleton";
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
import { useSuperadminTenantUsers } from "@/hooks/superadmin/useSuperadminTenantUsers";
import { formatDateTime } from "@/lib/utils";

const ROLE_VARIANTS: Record<string, BadgeVariant> = {
  owner: "purple",
  editor: "blue",
  member: "gray",
};

export default function SuperadminTenantUsers() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  const {
    users,
    totalCount,
    loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useSuperadminTenantUsers(debouncedSearch);

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
    <>
      {/* Search */}
      <div className="relative w-full max-w-sm">
        <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
        <Input
          placeholder={t("superadmin.tenantUsers.searchPlaceholder")}
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          className="h-9 pl-8 text-sm md:h-10 md:pl-9"
        />
      </div>

      {/* Content */}
      {loading ? (
        <TableSkeleton rows={5} columns={8} />
      ) : users.length === 0 ? (
        <Card variant="bordered">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
              <UsersRound className="size-8 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">
              {t("superadmin.tenantUsers.noUsersFound")}
            </h3>
            <p className="text-muted-foreground max-w-sm">
              {debouncedSearch
                ? t("superadmin.tenantUsers.tryDifferentSearch")
                : t("superadmin.tenantUsers.noUsersCreated")}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card variant="bordered" className="min-w-0 overflow-hidden">
          <div className="overflow-auto">
            <Table className="w-full text-xs md:text-sm">
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TH>{t("superadmin.table.name")}</TH>
                  <TH>WhatsApp</TH>
                  <TH>Workspace</TH>
                  <TH>{t("superadmin.table.role")}</TH>
                  <TH>{t("superadmin.table.status")}</TH>
                  <TH>{t("superadmin.table.account")}</TH>
                  <TH className="text-right">{t("superadmin.table.lastLogin")}</TH>
                  <TH className="text-right">{t("superadmin.table.created")}</TH>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((u) => (
                  <TableRow key={u.id} className="border-border">
                    {/* Name + Email */}
                    <TableCell className="px-2 py-2.5 md:px-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium max-w-[200px]">{u.name}</p>
                        {u.email && u.email !== u.name && (
                          <p className="truncate text-[10px] text-muted-foreground max-w-[200px]">{u.email}</p>
                        )}
                      </div>
                    </TableCell>
                    {/* WhatsApp */}
                    <TableCell className="px-2 py-2.5 md:px-3">
                      {u.whatsapp ? (
                        <span className="text-xs text-muted-foreground whitespace-nowrap">{u.whatsapp}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    {/* Workspace */}
                    <TableCell className="px-2 py-2.5 md:px-3">
                      <span className="block truncate text-xs text-muted-foreground max-w-[160px]">
                        {u.tenant_name}
                      </span>
                    </TableCell>
                    {/* Role */}
                    <TableCell className="px-2 py-2.5 md:px-3">
                      <Badge variant={ROLE_VARIANTS[u.role] ?? ROLE_VARIANTS.member} className="text-[10px] md:text-xs">
                        {u.role}
                      </Badge>
                    </TableCell>
                    {/* Status */}
                    <TableCell className="px-2 py-2.5 md:px-3">
                      {u.status === "active" ? (
                        <Badge variant="green" className="text-[10px] md:text-xs">{t("superadmin.tenantUsers.active")}</Badge>
                      ) : (
                        <Badge variant="amber" className="text-[10px] md:text-xs">{t("superadmin.tenantUsers.pending")}</Badge>
                      )}
                    </TableCell>
                    {/* Account */}
                    <TableCell className="px-2 py-2.5 md:px-3">
                      {u.email_confirmed_at ? (
                        <Badge variant="green" className="text-[10px] md:text-xs">{t("superadmin.tenantUsers.confirmed")}</Badge>
                      ) : (
                        <Badge variant="amber" className="text-[10px] md:text-xs">{t("superadmin.tenantUsers.pending")}</Badge>
                      )}
                    </TableCell>
                    {/* Last Login */}
                    <TableCell className="px-2 py-2.5 text-right md:px-3">
                      <span className="text-[10px] text-muted-foreground whitespace-nowrap md:text-xs">
                        {u.last_sign_in_at ? formatDateTime(u.last_sign_in_at, lang) : t("superadmin.tenantUsers.never")}
                      </span>
                    </TableCell>
                    {/* Created */}
                    <TableCell className="px-2 py-2.5 text-right text-muted-foreground md:px-3">
                      <span className="text-[10px] whitespace-nowrap md:text-xs">
                        {formatDateTime(u.created_at, lang)}
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
              {!hasNextPage && users.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  {t("superadmin.tenantUsers.showingOf", { count: users.length, total: totalCount })}
                </p>
              )}
            </div>
          </div>
        </Card>
      )}
    </>
  );
}

function TH({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <TableHead className={`h-9 bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs ${className}`}>
      {children}
    </TableHead>
  );
}
