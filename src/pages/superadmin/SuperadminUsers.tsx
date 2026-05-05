import { useState, useEffect, useCallback } from "react";
import { Search, UserCog, Loader2, ArrowUpDown, ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import SuperadminLayout from "@/components/superadmin/SuperadminLayout";
import { TableSkeleton } from "@/components/admin/TableSkeleton";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSuperadminUsers } from "@/hooks/superadmin/useSuperadminUsers";
import type { SuperadminUser, UserFilters } from "@/hooks/superadmin/useSuperadminUsers";
import { formatDateTime } from "@/lib/utils";

type SortField = "created_at" | "name";

/* ── Main page ─────────────────────────────────────────────── */

export default function SuperadminUsers() {
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  /* state */
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [emailStatusFilter, setEmailStatusFilter] = useState<string[]>([]);
  const [workspaceStatusFilter, setWorkspaceStatusFilter] = useState<string[]>([]);

  const filters: UserFilters = {
    emailStatus: emailStatusFilter,
    workspaceStatus: workspaceStatusFilter,
  };

  const { users, totalCount, loading, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useSuperadminUsers(debouncedSearch, sortBy, sortDir, filters);

  /* debounce search */
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(id);
  }, [searchInput]);

  /* infinite scroll */
  useEffect(() => {
    const onScroll = () => {
      if (
        window.innerHeight + window.scrollY >=
        document.documentElement.scrollHeight - 300
      ) {
        if (hasNextPage && !isFetchingNextPage) fetchNextPage();
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [fetchNextPage, hasNextPage, isFetchingNextPage]);

  /* sort toggle */
  const toggleSort = useCallback((field: SortField) => {
    setSortBy((prev) => {
      if (prev === field) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return prev;
      }
      setSortDir("desc");
      return field;
    });
  }, []);

  /* filters */
  const hasActiveFilters = emailStatusFilter.length > 0 || workspaceStatusFilter.length > 0;

  const clearFilters = useCallback(() => {
    setSearchInput("");
    setDebouncedSearch("");
    setEmailStatusFilter([]);
    setWorkspaceStatusFilter([]);
  }, []);

  const EMAIL_STATUS_OPTIONS = [
    { value: "verified", label: t("superadmin.users.emailVerified") },
    { value: "pending", label: t("superadmin.users.emailPending") },
  ];

  const WORKSPACE_STATUS_OPTIONS = [
    { value: "with_workspace", label: t("superadmin.users.withWorkspace") },
    { value: "without_workspace", label: t("superadmin.users.withoutWorkspace") },
  ];

  return (
    <SuperadminLayout>
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-6">
          {/* Header */}
          <h1 className="text-xl font-semibold tracking-normal text-foreground md:text-2xl">
            {t("superadmin.users.title")}
          </h1>

          {/* Filters toolbar */}
          <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <div className="relative min-w-0 flex-1 max-w-none sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
              <Input
                placeholder={t("superadmin.users.searchPlaceholder")}
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="h-9 pl-8 text-sm md:h-10 md:pl-9"
              />
            </div>

            <MultiSelect
              options={EMAIL_STATUS_OPTIONS}
              value={emailStatusFilter}
              onValueChange={setEmailStatusFilter}
              placeholder={t("superadmin.users.filterEmailStatus")}
              className="h-9 w-full sm:w-[180px] md:h-10"
            />
            <MultiSelect
              options={WORKSPACE_STATUS_OPTIONS}
              value={workspaceStatusFilter}
              onValueChange={setWorkspaceStatusFilter}
              placeholder={t("superadmin.users.filterWorkspace")}
              className="h-9 w-full sm:w-[190px] md:h-10"
            />

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground md:h-10">
                <X className="size-3.5" />
                Limpar filtros
              </Button>
            )}
          </div>

          {/* Table */}
          {loading ? (
            <TableSkeleton rows={5} columns={5} />
          ) : users.length === 0 ? (
            <EmptyState hasFilters={!!debouncedSearch || hasActiveFilters} onClear={clearFilters} t={t} />
          ) : (
            <UsersTable
              users={users}
              totalCount={totalCount}
              sortBy={sortBy}
              sortDir={sortDir}
              toggleSort={toggleSort}
              hasNextPage={hasNextPage}
              isFetchingNextPage={isFetchingNextPage}
              lang={lang}
              t={t}
            />
          )}
        </div>
      </div>
    </SuperadminLayout>
  );
}

/* ── Empty state ───────────────────────────────────────────── */

function EmptyState({ hasFilters, onClear, t }: { hasFilters: boolean; onClear: () => void; t: (k: string) => string }) {
  return (
    <Card variant="bordered">
      <CardContent className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <UserCog className="size-10 text-muted-foreground/40" />
        <p className="text-sm font-medium text-foreground">
          {t(hasFilters ? "superadmin.users.noUsersFound" : "superadmin.users.noUsersCreated")}
        </p>
        <p className="text-xs text-muted-foreground">
          {t(hasFilters ? "superadmin.users.tryDifferentSearch" : "superadmin.users.noUsersCreated")}
        </p>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClear} className="mt-2">
            Limpar filtros
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Users table ───────────────────────────────────────────── */

function UsersTable({
  users, totalCount, sortBy, sortDir, toggleSort, hasNextPage, isFetchingNextPage, lang, t,
}: {
  users: SuperadminUser[];
  totalCount: number;
  sortBy: SortField;
  sortDir: "asc" | "desc";
  toggleSort: (f: SortField) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  lang: string;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <Card variant="bordered" className="overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label={t("superadmin.table.name") + " / " + t("superadmin.table.email")} field="name" currentSort={sortBy} currentDir={sortDir} onToggle={toggleSort} className="min-w-[200px]" />
              <TH>Status</TH>
              <TH>WhatsApp</TH>
              <SortableHead label={t("superadmin.table.created")} field="created_at" currentSort={sortBy} currentDir={sortDir} onToggle={toggleSort} />
              <TH className="min-w-[160px]">Workspace</TH>
            </TableRow>
          </TableHeader>
          <TableBody>
            {users.map((u) => (
              <TableRow key={u.user_id}>
                <TD>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-foreground max-w-[220px] md:text-sm">
                      {u.name ?? u.email}
                    </p>
                    {u.name && u.name !== u.email && (
                      <p className="truncate text-[10px] text-muted-foreground max-w-[220px] md:text-xs">{u.email}</p>
                    )}
                  </div>
                </TD>
                <TD>
                  {u.email_confirmed_at ? (
                    <Badge variant="green">{t("superadmin.users.emailVerified")}</Badge>
                  ) : (
                    <Badge variant="amber">{t("superadmin.users.emailPending")}</Badge>
                  )}
                </TD>
                <TD>
                  {u.whatsapp ? (
                    <span className="text-xs text-foreground">{u.whatsapp}</span>
                  ) : (
                    <Dash />
                  )}
                </TD>
                <TD>
                  <span className="whitespace-nowrap text-xs text-foreground">
                    {formatDateTime(u.created_at, lang)}
                  </span>
                </TD>
                <TD>
                  {u.tenant_name && u.tenant_slug ? (
                    <WorkspaceCell name={u.tenant_name} slug={u.tenant_slug} />
                  ) : (
                    <Dash />
                  )}
                </TD>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
      <PaginationFooter count={users.length} total={totalCount} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} t={t} />
    </Card>
  );
}

/* ── Shared small components ───────────────────────────────── */

function TH({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <TableHead className={`h-9 bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs ${className}`}>
      {children}
    </TableHead>
  );
}

function TD({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <TableCell className={`px-2 py-2.5 md:px-3 ${className}`}>{children}</TableCell>;
}

function Dash() {
  return <span className="text-xs text-muted-foreground">—</span>;
}

function WorkspaceCell({ name, slug }: { name: string; slug: string }) {
  return (
    <div className="min-w-0">
      <span className="block truncate text-xs font-medium max-w-[160px] md:text-sm">{name}</span>
      <a
        href={`/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground md:text-xs"
      >
        <span className="truncate max-w-[140px]">{slug}</span>
        <ExternalLink className="size-2.5 shrink-0 opacity-50" />
      </a>
    </div>
  );
}

function PaginationFooter({ count, total, hasNextPage, isFetchingNextPage, t }: {
  count: number; total: number; hasNextPage: boolean; isFetchingNextPage: boolean;
  t: (k: string, opts?: Record<string, unknown>) => string;
}) {
  return (
    <div className="flex items-center justify-center py-4">
      {isFetchingNextPage && <Loader2 className="size-5 animate-spin text-muted-foreground" />}
      {!hasNextPage && count > 0 && (
        <p className="text-xs text-muted-foreground">
          {t("superadmin.users.showingOf", { count, total })}
        </p>
      )}
    </div>
  );
}

/* ── Sortable header ───────────────────────────────────────── */

function SortableHead({
  label, field, currentSort, currentDir, onToggle, className = "",
}: {
  label: string; field: SortField; currentSort: SortField; currentDir: "asc" | "desc";
  onToggle: (f: SortField) => void; className?: string;
}) {
  const isActive = currentSort === field;
  return (
    <TableHead className={`h-9 bg-card px-2 text-[10px] font-semibold text-muted-foreground md:h-10 md:px-3 md:text-xs ${className}`}>
      <Button variant="ghost" size="sm" className="-ml-3 h-8 text-[10px] font-semibold text-muted-foreground md:text-xs" onClick={() => onToggle(field)}>
        {label}
        <ArrowUpDown className={`ml-1 size-3 ${isActive ? "text-foreground" : "text-muted-foreground/50"}`} />
        {isActive && <span className="ml-0.5 text-[9px] text-foreground">{currentDir === "asc" ? "↑" : "↓"}</span>}
      </Button>
    </TableHead>
  );
}
