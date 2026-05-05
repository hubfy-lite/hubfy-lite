import { Building2, Users, DollarSign, TrendingUp, Loader2, ShoppingCart, UserPlus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatDateOnly } from "@/lib/utils";
import SuperadminLayout from "@/components/superadmin/SuperadminLayout";
import { useSuperadminDashboard } from "@/hooks/superadmin/useSuperadminDashboard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Area, AreaChart, XAxis, YAxis } from "recharts";

function formatCurrency(cents: number, currency = "BRL"): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency,
  }).format(cents / 100);
}


export default function SuperadminDashboard() {
  const { metrics, loading } = useSuperadminDashboard();
  const { t, i18n } = useTranslation();
  const lang = i18n.language;

  if (loading) {
    return (
      <SuperadminLayout>
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground animate-pulse">
            {t("superadmin.dashboard.loading")}
          </p>
        </div>
      </SuperadminLayout>
    );
  }

  return (
    <SuperadminLayout>
      <div className="px-4 sm:px-6 lg:px-10 pb-10">
        <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-8">
        {/* Header */}
        <div>
          <h1 className="text-title">{t("superadmin.dashboard.title")}</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {t("superadmin.dashboard.subtitle")}
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <KpiCard
            icon={Building2}
            label={t("superadmin.dashboard.totalTenants")}
            value={metrics?.totalTenants?.toLocaleString("pt-BR") ?? "0"}
            iconBg="bg-primary/10"
            iconColor="text-primary"
          />
          <KpiCard
            icon={Users}
            label={t("superadmin.dashboard.totalCustomers")}
            value={metrics?.totalCustomers?.toLocaleString("pt-BR") ?? "0"}
            iconBg="bg-blue-500/10"
            iconColor="text-blue-500"
          />
          <KpiCard
            icon={DollarSign}
            label={t("superadmin.dashboard.totalRevenue")}
            value={formatCurrency(metrics?.totalRevenue ?? 0)}
            iconBg="bg-success/10"
            iconColor="text-success"
          />
          <KpiCard
            icon={TrendingUp}
            label={t("superadmin.dashboard.mrr")}
            value={formatCurrency(metrics?.totalMrr ?? 0)}
            iconBg="bg-violet-500/10"
            iconColor="text-violet-500"
            subValue={
              metrics?.growthPercent !== null && metrics?.growthPercent !== undefined
                ? `${metrics.growthPercent > 0 ? "+" : ""}${metrics.growthPercent}% ${t("superadmin.dashboard.vsLastMonth")}`
                : undefined
            }
          />
        </div>

        {/* Today metrics */}
        <div className="grid grid-cols-2 gap-4">
          <Card variant="bordered">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-success/10">
                  <ShoppingCart className="size-4 text-success" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("superadmin.dashboard.ordersToday")}</p>
                  <p className="text-2xl font-semibold">{metrics?.ordersToday ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card variant="bordered">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-500/10">
                  <UserPlus className="size-4 text-blue-500" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">{t("superadmin.dashboard.newCustomersToday")}</p>
                  <p className="text-2xl font-semibold">{metrics?.newCustomersToday ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Revenue chart */}
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="text-sm font-medium">{t("superadmin.dashboard.revenueLast30Days")}</CardTitle>
          </CardHeader>
          <CardContent>
            {metrics?.revenueByDay && metrics.revenueByDay.length > 0 ? (
              <ChartContainer
                config={{
                  revenue: { label: t("superadmin.dashboard.revenue"), color: "var(--color-primary)" },
                }}
                className="h-[250px] w-full"
              >
                <AreaChart data={metrics.revenueByDay}>
                  <defs>
                    <linearGradient id="fillRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-primary)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-primary)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    fontSize={10}
                    tickFormatter={(v) => formatCurrency(v)}
                    width={80}
                  />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(Number(value))}
                      />
                    }
                  />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    stroke="var(--color-primary)"
                    fill="url(#fillRevenue)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground py-8 text-center">
                {t("superadmin.dashboard.noRevenueData")}
              </p>
            )}
          </CardContent>
        </Card>

        {/* Top Tenants + Recent Tenants */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Top Tenants */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t("superadmin.dashboard.topTenantsByRevenue")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {metrics?.topTenants && metrics.topTenants.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="h-9 text-xs">{t("superadmin.table.tenant")}</TableHead>
                      <TableHead className="h-9 text-xs text-right">{t("superadmin.table.customers")}</TableHead>
                      <TableHead className="h-9 text-xs text-right">{t("superadmin.table.orders")}</TableHead>
                      <TableHead className="h-9 text-xs text-right">{t("superadmin.table.revenue")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.topTenants.map((t_) => (
                      <TableRow key={t_.id} className="border-border">
                        <TableCell className="py-2">
                          <div>
                            <p className="text-sm font-medium">{t_.name}</p>
                            <p className="text-xs text-muted-foreground">{t_.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm">
                          {t_.customers_count}
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm">
                          {t_.orders_count}
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm font-medium">
                          {formatCurrency(t_.revenue)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t("superadmin.dashboard.noTenantsYet")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Recent Tenants */}
          <Card variant="bordered">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{t("superadmin.dashboard.recentTenants")}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {metrics?.recentTenants && metrics.recentTenants.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow className="border-border hover:bg-transparent">
                      <TableHead className="h-9 text-xs">{t("superadmin.table.tenant")}</TableHead>
                      <TableHead className="h-9 text-xs text-right">{t("superadmin.table.created")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {metrics.recentTenants.map((t_) => (
                      <TableRow key={t_.id} className="border-border">
                        <TableCell className="py-2">
                          <div>
                            <p className="text-sm font-medium">{t_.name}</p>
                            <p className="text-xs text-muted-foreground">{t_.slug}</p>
                          </div>
                        </TableCell>
                        <TableCell className="py-2 text-right text-sm text-muted-foreground">
                          {formatDateOnly(t_.created_at, lang)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-sm text-muted-foreground py-8 text-center">
                  {t("superadmin.dashboard.noTenantsYet")}
                </p>
              )}
            </CardContent>
          </Card>
        </div>
        </div>
      </div>
    </SuperadminLayout>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  iconBg,
  iconColor,
  subValue,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  iconBg: string;
  iconColor: string;
  subValue?: string;
}) {
  return (
    <Card variant="bordered">
      <CardContent className="pt-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${iconBg}`}>
              <Icon className={`size-4 ${iconColor}`} />
            </div>
            <p className="text-sm text-muted-foreground">{label}</p>
          </div>
          <p className="text-2xl font-semibold text-foreground">{value}</p>
          {subValue && (
            <p className="text-xs text-muted-foreground">{subValue}</p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
