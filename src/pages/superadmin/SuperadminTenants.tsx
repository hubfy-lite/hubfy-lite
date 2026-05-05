import { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { useSearchParams } from "react-router-dom";
import { Search, Building2, Loader2, ArrowUpDown, ExternalLink, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import SuperadminLayout from "@/components/superadmin/SuperadminLayout";
import { TableSkeleton } from "@/components/admin/TableSkeleton";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { BadgeVariant } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MultiSelect } from "@/components/ui/multi-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { useSuperadminTenants } from "@/hooks/superadmin/useSuperadminTenants";
import type { SuperadminTenant, TenantFilters, TenantStats } from "@/hooks/superadmin/useSuperadminTenants";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";
import {
  ONBOARDING_GOALS,
  CUSTOMER_COUNTS,
  REVENUE_RANGES,
  USED_TOOLS,
} from "@/lib/onboarding-steps";

const SuperadminTenantUsers = lazy(() => import("./SuperadminTenantUsers"));

type SortField = "created_at" | "name" | "revenue" | "customers";

/* ── Helpers ───────────────────────────────────────────────── */

function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(cents / 100);
}

/* ── Badge color maps ──────────────────────────────────────── */

const GOAL_BADGE: Record<string, { variant: BadgeVariant; short: string }> = {
  start_fresh: { variant: "green", short: "Do zero" },
  migrate: { variant: "blue", short: "Migrar" },
  exploring: { variant: "gray", short: "Explorando" },
};

const CUSTOMER_BADGE: Record<string, { variant: BadgeVariant; short: string }> = {
  over_5000: { variant: "purple", short: "> 5.000" },
  "1000_5000": { variant: "indigo", short: "1K - 5K" },
  "100_1000": { variant: "blue", short: "100 - 1K" },
  "1_100": { variant: "teal", short: "1 - 100" },
  none: { variant: "gray", short: "Nenhum" },
};

const REVENUE_BADGE: Record<string, { variant: BadgeVariant; short: string }> = {
  over_10m: { variant: "purple", short: "> R$ 10M" },
  "1m_10m": { variant: "indigo", short: "R$ 1M - 10M" },
  "250k_1m": { variant: "blue", short: "R$ 250K - 1M" },
  "100k_250k": { variant: "teal", short: "R$ 100K - 250K" },
  "50k_100k": { variant: "green", short: "R$ 50K - 100K" },
  under_50k: { variant: "gray", short: "< R$ 50K" },
};

/* ── Filter options ────────────────────────────────────────── */

const GOAL_OPTIONS = ONBOARDING_GOALS.map((g) => ({ value: g, label: GOAL_BADGE[g]?.short ?? g }));
const CUSTOMER_OPTIONS = CUSTOMER_COUNTS.map((c) => ({ value: c, label: CUSTOMER_BADGE[c]?.short ?? c }));
const REVENUE_OPTIONS = REVENUE_RANGES.map((r) => ({ value: r, label: REVENUE_BADGE[r]?.short ?? r }));
const TOOLS_OPTIONS = [...USED_TOOLS].sort().map((t) => ({ value: t, label: t }));

/* ── Main page ─────────────────────────────────────────────── */

export default function SuperadminTenants() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;
  const activeTab = searchParams.get("tab") ?? "tenants";

  /* state */
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortField>("created_at");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [goalFilter, setGoalFilter] = useState<string[]>([]);
  const [customerFilter, setCustomerFilter] = useState<string[]>([]);
  const [revenueFilter, setRevenueFilter] = useState<string[]>([]);
  const [toolsFilter, setToolsFilter] = useState<string[]>([]);

  const filters: TenantFilters = {
    goals: goalFilter,
    customerCounts: customerFilter,
    annualRevenues: revenueFilter,
    usedTools: toolsFilter,
  };

  const {
    tenants,
    totalCount,
    stats,
    loading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
    refetch,
  } = useSuperadminTenants(debouncedSearch, sortBy, sortDir, filters);

  /* error toast */
  useEffect(() => {
    if (error) {
      toast.error("Erro ao carregar tenants", {
        action: { label: "Tentar novamente", onClick: () => refetch() },
      });
    }
  }, [error, refetch]);

  /* debounce search */
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchInput), 400);
    return () => clearTimeout(timer);
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

  const hasActiveFilters = goalFilter.length > 0 || customerFilter.length > 0 || revenueFilter.length > 0 || toolsFilter.length > 0;
  const clearFilters = useCallback(() => {
    setGoalFilter([]);
    setCustomerFilter([]);
    setRevenueFilter([]);
    setToolsFilter([]);
  }, []);

  const handleTabChange = (value: string) => {
    clearFilters();
    if (value === "tenants") {
      searchParams.delete("tab");
    } else {
      searchParams.set("tab", value);
    }
    setSearchParams(searchParams, { replace: true });
  };

  /* shared between tenants + engagement tabs */
  const showTenantsData = activeTab === "tenants" || activeTab === "engagement";

  return (
    <SuperadminLayout>
      <div className="p-4 sm:p-6 lg:p-10">
        <div className="mx-auto flex min-w-0 max-w-[1600px] flex-col gap-6">
          {/* Header */}
          <h1 className="text-xl font-semibold tracking-normal text-foreground md:text-2xl">
            {t("superadmin.tenants.title")}
          </h1>

          {/* Stats cards */}
          <StatsCards stats={stats} loading={loading} />

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={handleTabChange}>
            <TabsList variant="line">
              <TabsTrigger value="tenants">{t("superadmin.tenants.tabTenants")}</TabsTrigger>
              <TabsTrigger value="engagement">Engajamento</TabsTrigger>
              <TabsTrigger value="tenant-users">{t("superadmin.tenants.tabTenantUsers")}</TabsTrigger>
            </TabsList>
          </Tabs>

          {/* Tab content */}
          {showTenantsData && (
            <>
              {/* Filters toolbar */}
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
                <div className="relative min-w-0 flex-1 max-w-none sm:max-w-sm">
                  <Search className="absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground md:size-4" />
                  <Input
                    placeholder={t("superadmin.tenants.searchPlaceholder")}
                    value={searchInput}
                    onChange={(e) => setSearchInput(e.target.value)}
                    className="h-9 pl-8 text-sm md:h-10 md:pl-9"
                  />
                </div>

                {activeTab === "tenants" && (
                  <>
                    <MultiSelect options={GOAL_OPTIONS} value={goalFilter} onValueChange={setGoalFilter} placeholder="Objetivo" className="h-9 w-full sm:w-[160px] md:h-10" />
                    <MultiSelect options={CUSTOMER_OPTIONS} value={customerFilter} onValueChange={setCustomerFilter} placeholder="Clientes" className="h-9 w-full sm:w-[160px] md:h-10" />
                    <MultiSelect options={REVENUE_OPTIONS} value={revenueFilter} onValueChange={setRevenueFilter} placeholder="Receita" className="h-9 w-full sm:w-[180px] md:h-10" />
                    <MultiSelect options={TOOLS_OPTIONS} value={toolsFilter} onValueChange={setToolsFilter} placeholder="Ferramentas" className="h-9 w-full sm:w-[180px] md:h-10" />
                  </>
                )}

                {hasActiveFilters && (
                  <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 gap-1.5 text-muted-foreground md:h-10">
                    <X className="size-3.5" />
                    Limpar filtros
                  </Button>
                )}
              </div>

              {/* Table */}
              {loading ? (
                <TableSkeleton rows={5} columns={8} />
              ) : tenants.length === 0 ? (
                <EmptyState
                  hasFilters={!!debouncedSearch || hasActiveFilters}
                  onClear={clearFilters}
                  t={t}
                />
              ) : activeTab === "tenants" ? (
                <TenantsTable
                  tenants={tenants}
                  totalCount={totalCount}
                  sortBy={sortBy}
                  sortDir={sortDir}
                  toggleSort={toggleSort}
                  hasNextPage={hasNextPage}
                  isFetchingNextPage={isFetchingNextPage}
                  lang={lang}
                  t={t}
                />
              ) : (
                <EngagementTable
                  tenants={tenants}
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
            </>
          )}

          {activeTab === "tenant-users" && (
            <Suspense fallback={<TableSkeleton rows={5} columns={8} />}>
              <SuperadminTenantUsers />
            </Suspense>
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
      <CardContent className="flex flex-col items-center justify-center py-16 text-center">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mb-4">
          <Building2 className="size-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {t("superadmin.tenants.noTenantsFound")}
        </h3>
        <p className="text-muted-foreground max-w-sm">
          {hasFilters ? t("superadmin.tenants.tryDifferentSearch") : t("superadmin.tenants.noTenantsCreated")}
        </p>
        {hasFilters && (
          <Button variant="outline" size="sm" onClick={onClear} className="mt-4">
            Limpar filtros
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/* ── Stats cards ───────────────────────────────────────────── */

function StatsCards({ stats, loading }: { stats: TenantStats; loading: boolean }) {
  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <StatCard label="Total de Tenants" value={stats.total} loading={loading} />
      <StatCard label="Querem migrar" value={stats.migrate} loading={loading} />
      <StatCard label="Onboarding completo" value={stats.onboardingComplete} loading={loading} />
      <StatCard label="Últimos 7 dias" value={stats.recent7d} loading={loading} />
    </div>
  );
}

function StatCard({ label, value, loading }: { label: string; value: number; loading: boolean }) {
  return (
    <Card variant="bordered">
      <CardContent className="p-4">
        <p className="text-xs text-muted-foreground">{label}</p>
        {loading ? <Skeleton className="mt-1 h-7 w-12" /> : <p className="text-2xl font-semibold text-foreground">{value}</p>}
      </CardContent>
    </Card>
  );
}

/* ── Tenants table ─────────────────────────────────────────── */

interface TableProps {
  tenants: SuperadminTenant[];
  totalCount: number;
  sortBy: SortField;
  sortDir: "asc" | "desc";
  toggleSort: (f: SortField) => void;
  hasNextPage: boolean;
  isFetchingNextPage: boolean;
  lang: string;
  t: (k: string, opts?: Record<string, unknown>) => string;
}

function TenantsTable({ tenants, totalCount, sortBy, sortDir, toggleSort, hasNextPage, isFetchingNextPage, lang, t }: TableProps) {
  return (
    <Card variant="bordered" className="min-w-0 overflow-hidden">
      <div className="overflow-auto">
        <Table className="w-full text-xs md:text-sm">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <SortableHead label="Workspace" field="name" currentSort={sortBy} currentDir={sortDir} onToggle={toggleSort} />
              <TH>Owner</TH>
              <TH>Objetivo</TH>
              <TH>Como nos conheceu</TH>
              <TH>Clientes</TH>
              <TH>Receita</TH>
              <TH>Ferramentas</TH>
              <SortableHead label={t("superadmin.table.created")} field="created_at" currentSort={sortBy} currentDir={sortDir} onToggle={toggleSort} className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id} className="border-border">
                <TD><TenantNameSlug name={tenant.name} slug={tenant.slug} /></TD>
                <TD><OwnerCell name={tenant.owner_name} email={tenant.owner_email} /></TD>
                <TD>
                  {tenant.onboarding_goal ? (
                    <Badge variant={GOAL_BADGE[tenant.onboarding_goal]?.variant ?? "gray"} className="text-[10px]">
                      {GOAL_BADGE[tenant.onboarding_goal]?.short ?? tenant.onboarding_goal}
                    </Badge>
                  ) : <Dash />}
                </TD>
                <TD>
                  {tenant.referral_source
                    ? <span className="block text-xs text-foreground line-clamp-2 max-w-[160px]">{tenant.referral_source}</span>
                    : <Dash />}
                </TD>
                <TD>
                  {tenant.customer_count ? (
                    <Badge variant={CUSTOMER_BADGE[tenant.customer_count]?.variant ?? "gray"} className="text-[10px]">
                      {CUSTOMER_BADGE[tenant.customer_count]?.short ?? tenant.customer_count}
                    </Badge>
                  ) : <Dash />}
                </TD>
                <TD>
                  {tenant.annual_revenue ? (
                    <Badge variant={REVENUE_BADGE[tenant.annual_revenue]?.variant ?? "gray"} className="text-[10px]">
                      {REVENUE_BADGE[tenant.annual_revenue]?.short ?? tenant.annual_revenue}
                    </Badge>
                  ) : <Dash />}
                </TD>
                <TD>
                  {tenant.used_tools && tenant.used_tools.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {tenant.used_tools.map((tool) => (
                        <Badge key={tool} variant="outline" className="text-[10px]">{tool}</Badge>
                      ))}
                    </div>
                  ) : <Dash />}
                </TD>
                <TD className="text-right">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap md:text-xs">
                    {formatDateTime(tenant.created_at, lang)}
                  </span>
                </TD>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationFooter count={tenants.length} total={totalCount} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} t={t} />
      </div>
    </Card>
  );
}

/* ── Engagement table ──────────────────────────────────────── */

function EngagementTable({ tenants, totalCount, sortBy, sortDir, toggleSort, hasNextPage, isFetchingNextPage, lang, t }: TableProps) {
  return (
    <Card variant="bordered" className="min-w-0 overflow-hidden">
      <div className="overflow-auto">
        <Table className="w-full text-xs md:text-sm">
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <SortableHead label="Workspace" field="name" currentSort={sortBy} currentDir={sortDir} onToggle={toggleSort} />
              <TH>Owner</TH>
              <SortableHead label="Clientes" field="customers" currentSort={sortBy} currentDir={sortDir} onToggle={toggleSort} className="text-right" />
              <TH className="text-right">Produtos</TH>
              <TH className="text-right">Pedidos</TH>
              <SortableHead label="Receita total" field="revenue" currentSort={sortBy} currentDir={sortDir} onToggle={toggleSort} className="text-right" />
              <SortableHead label={t("superadmin.table.created")} field="created_at" currentSort={sortBy} currentDir={sortDir} onToggle={toggleSort} className="text-right" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {tenants.map((tenant) => (
              <TableRow key={tenant.id} className="border-border">
                <TD><TenantNameSlug name={tenant.name} slug={tenant.slug} /></TD>
                <TD>
                  <OwnerCell name={tenant.owner_name} email={tenant.owner_email} whatsapp={tenant.owner_whatsapp} />
                </TD>
                <TD className="text-right">{tenant.customers_count}</TD>
                <TD className="text-right">{tenant.products_count}</TD>
                <TD className="text-right">{tenant.orders_count}</TD>
                <TD className="text-right font-medium">
                  <span className="whitespace-nowrap">{formatCurrency(tenant.revenue_total)}</span>
                </TD>
                <TD className="text-right">
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap md:text-xs">
                    {formatDateTime(tenant.created_at, lang)}
                  </span>
                </TD>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <PaginationFooter count={tenants.length} total={totalCount} hasNextPage={hasNextPage} isFetchingNextPage={isFetchingNextPage} t={t} />
      </div>
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

function TenantNameSlug({ name, slug }: { name: string; slug: string }) {
  return (
    <div className="min-w-0">
      <span className="block truncate text-sm font-medium max-w-[200px]">{name}</span>
      <a
        href={`/${slug}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-[10px] text-muted-foreground transition-colors hover:text-foreground"
      >
        <span className="truncate max-w-[160px]">{slug}</span>
        <ExternalLink className="size-2.5 shrink-0 opacity-50" />
      </a>
    </div>
  );
}

function OwnerCell({ name, email, whatsapp }: { name: string | null; email: string | null; whatsapp?: string | null }) {
  if (!name) return <Dash />;
  return (
    <div className="min-w-0">
      <p className="truncate text-xs font-medium text-foreground max-w-[180px]">{name}</p>
      {email && email !== name && (
        <p className="truncate text-[10px] text-muted-foreground max-w-[180px]">{email}</p>
      )}
      {whatsapp && (
        <p className="truncate text-[10px] text-muted-foreground max-w-[180px]">{whatsapp}</p>
      )}
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
          {t("superadmin.tenants.showingOf", { count, total })}
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
