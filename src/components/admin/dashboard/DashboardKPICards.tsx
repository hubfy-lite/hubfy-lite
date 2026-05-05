import { DollarSign, ShoppingCart, TrendingUp, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/lib/format";
import type { DashboardMetrics } from "@/hooks/useDashboardMetrics";

interface Props {
  metrics: DashboardMetrics | undefined;
  loading: boolean;
}

export default function DashboardKPICards({ metrics, loading }: Props) {
  const { t } = useTranslation();

  const growthValue = metrics?.growthPercent;
  const isPositive = growthValue !== null && growthValue !== undefined && growthValue >= 0;

  const stats = [
    {
      label: t("dashboard.kpi.totalRevenue"),
      value: metrics ? formatCurrency(metrics.revenueTotal) : null,
      description: t("dashboard.kpi.totalRevenueDesc"),
      icon: DollarSign,
      iconBg: "bg-warning/10",
      iconColor: "text-warning",
    },
    {
      label: t("dashboard.kpi.orders"),
      value: metrics?.ordersCount?.toString() ?? null,
      description: t("dashboard.kpi.ordersDesc"),
      icon: ShoppingCart,
      iconBg: "bg-primary/10",
      iconColor: "text-primary",
    },
    {
      label: t("dashboard.kpi.monthRevenue"),
      value: metrics ? formatCurrency(metrics.revenueThisMonth) : null,
      description: t("dashboard.kpi.monthRevenueDesc"),
      icon: TrendingUp,
      iconBg: "bg-success/10",
      iconColor: "text-success",
    },
    {
      label: t("dashboard.kpi.growth"),
      value:
        growthValue !== null && growthValue !== undefined
          ? `${isPositive ? "+" : ""}${growthValue}%`
          : t("dashboard.kpi.noGrowthData"),
      description: t("dashboard.kpi.growthDesc"),
      icon: isPositive ? ArrowUpRight : ArrowDownRight,
      iconBg: isPositive ? "bg-success/10" : "bg-destructive/10",
      iconColor: isPositive ? "text-success" : "text-destructive",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4" data-tour="dashboard-kpis">
      {stats.map((stat) => (
        <Card key={stat.label} variant="bordered" size="sm">
          <CardContent className="pt-4">
            <div className="flex items-center justify-between pb-2 mb-3">
              <span className="text-label uppercase tracking-wide">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.iconBg}`}>
                <stat.icon className={`size-4 ${stat.iconColor}`} />
              </div>
            </div>
            {loading ? (
              <>
                <Skeleton className="h-7 w-24 mb-1" />
                <Skeleton className="h-3 w-20" />
              </>
            ) : (
              <>
                <div className="text-2xl font-semibold text-foreground">{stat.value}</div>
                <p className="text-support">{stat.description}</p>
              </>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
